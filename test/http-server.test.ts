import { request as httpRequest } from 'node:http';
import { describe, expect, it } from 'vitest';

import { loadHttpServerConfig, startPraetorHttpServer, type HttpServerConfig, type PraetorHttpServerHandle } from '../src/httpServer.js';

const applicationKey = 'test-application-key-123456';

const config: HttpServerConfig = {
  host: '127.0.0.1',
  port: 0,
  maxBodyBytes: 128,
  maxConcurrentRequests: 1,
  requestTimeoutMs: 500,
  allowedHosts: ['127.0.0.1', 'localhost'],
  allowedOrigins: ['127.0.0.1', 'localhost'],
  applicationKey,
  writesEnabled: false
};

async function withServer(run: (baseUrl: string, handle: PraetorHttpServerHandle) => Promise<void>): Promise<void> {
  const handle = await startPraetorHttpServer(config);
  try {
    await run(`http://127.0.0.1:${handle.address.port}`, handle);
  } finally {
    await handle.close();
  }
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function rawRequest(url: string, headers: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  return await new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

describe('opt-in HTTP transport', () => {
  it('fails closed when HTTP is enabled without a valid application credential', () => {
    expect(() => loadHttpServerConfig({ PRAETOR_HTTP_KEY: 'too-short' })).toThrow(/16 to 512/);
  });

  it('serves an unauthenticated local health check', async () => {
    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/healthz`);
      expect(response.status).toBe(200);
      expect(await responseJson(response)).toMatchObject({ status: 'ok', writes_enabled: false });
    });
  });

  it('requires the dedicated application key and does not accept Authorization alone', async () => {
    await withServer(async baseUrl => {
      const missing = await fetch(`${baseUrl}/mcp`, { method: 'POST', body: '{}' });
      expect(missing.status).toBe(401);

      const bearerOnly = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { authorization: 'Bearer ignored' },
        body: '{}'
      });
      expect(bearerOnly.status).toBe(401);

      const accepted = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'x-praetor-key': applicationKey, authorization: 'Bearer ignored', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      });
      expect(accepted.status).toBe(200);
      expect(await accepted.text()).toContain('tools');
    });
  });

  it('rejects unapproved Host and Origin headers', async () => {
    await withServer(async baseUrl => {
      const badHost = await rawRequest(`${baseUrl}/healthz`, { host: 'evil.example' });
      expect(badHost.status).toBe(403);
      expect(badHost.body).toMatchObject({ error: { code: 'invalid_host' } });

      const badOrigin = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'x-praetor-key': applicationKey, origin: 'https://evil.example', 'content-type': 'application/json' },
        body: '{}'
      });
      expect(badOrigin.status).toBe(403);
      expect(await responseJson(badOrigin)).toMatchObject({ error: { code: 'invalid_origin' } });
    });
  });

  it('bounds request bodies before dispatch and keeps HTTP writes disabled', async () => {
    await withServer(async baseUrl => {
      const oversized = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'x-praetor-key': applicationKey, 'content-type': 'application/json' },
        body: 'x'.repeat(129)
      });
      expect(oversized.status).toBe(413);

      const write = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'x-praetor-key': applicationKey, 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'submit_review_advisory_packet' } })
      });
      expect(write.status).toBe(403);
      expect(await responseJson(write)).toMatchObject({ error: { code: 'http_writes_disabled' } });
    });
  });

  it('returns a bounded concurrency response while another request is incomplete', async () => {
    await withServer(async baseUrl => {
      let pendingRequest: ReturnType<typeof httpRequest> | undefined;
      const firstRequest = new Promise<void>(resolve => {
        pendingRequest = httpRequest(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            host: '127.0.0.1',
            'x-praetor-key': applicationKey,
            'content-type': 'application/json',
            'content-length': '4'
          }
        }, response => {
          response.resume();
          response.on('end', () => resolve());
        });
        pendingRequest.on('error', () => resolve());
        pendingRequest.write('{');
      });

      await new Promise(resolve => setTimeout(resolve, 25));
      const second = await fetch(`${baseUrl}/healthz`);
      expect(second.status).toBe(503);

      pendingRequest?.destroy();
      await firstRequest;
    });
  });
});
