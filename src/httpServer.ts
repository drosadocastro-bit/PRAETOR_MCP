import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { createMcpHandler, validateHostHeader, validateOriginHeader } from '@modelcontextprotocol/server';

import { buildPraetorServer } from './server.js';
import { PraetorError } from './errors.js';

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 32;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

export interface HttpServerConfig {
  host: string;
  port: number;
  maxBodyBytes: number;
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  allowedHosts: string[];
  allowedOrigins: string[];
  applicationKey: string;
  writesEnabled: boolean;
}

export interface PraetorHttpServerHandle {
  server: Server;
  config: HttpServerConfig;
  address: { host: string; port: number };
  close(): Promise<void>;
}

function parsePositiveInteger(name: string, value: string | undefined, fallback: number, allowZero = false): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < (allowZero ? 0 : 1) || parsed > 2_147_483_647) {
    throw new PraetorError('configuration_error', `${name} must be a bounded integer.`);
  }
  return parsed;
}

function parseHostList(value: string | undefined, fallback: string[]): string[] {
  const values = value?.split(',').map(item => item.trim()).filter(Boolean) ?? fallback;
  if (values.length === 0 || values.some(item => item.includes('://') || item.includes(':') && !item.startsWith('['))) {
    throw new PraetorError('configuration_error', 'HTTP host allowlists must contain hostnames only.');
  }
  return [...new Set(values)];
}

export function loadHttpServerConfig(env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  const host = env.PRAETOR_HTTP_HOST?.trim() || '127.0.0.1';
  const port = parsePositiveInteger('PRAETOR_HTTP_PORT', env.PRAETOR_HTTP_PORT, 3000, true);
  const allowedHosts = parseHostList(env.PRAETOR_HTTP_ALLOWED_HOSTS, host === '0.0.0.0' ? LOCAL_HOSTS : [host, ...LOCAL_HOSTS]);
  const allowedOrigins = parseHostList(env.PRAETOR_HTTP_ALLOWED_ORIGINS, allowedHosts);
  const applicationKey = env.PRAETOR_HTTP_KEY?.trim();

  if (!applicationKey || applicationKey.length < 16 || applicationKey.length > 512) {
    throw new PraetorError('configuration_error', 'PRAETOR_HTTP_KEY must be 16 to 512 characters when HTTP is enabled.');
  }

  return {
    host,
    port,
    maxBodyBytes: parsePositiveInteger('PRAETOR_HTTP_MAX_BODY_BYTES', env.PRAETOR_HTTP_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES),
    maxConcurrentRequests: parsePositiveInteger('PRAETOR_HTTP_MAX_CONCURRENT_REQUESTS', env.PRAETOR_HTTP_MAX_CONCURRENT_REQUESTS, DEFAULT_MAX_CONCURRENT_REQUESTS),
    requestTimeoutMs: parsePositiveInteger('PRAETOR_HTTP_REQUEST_TIMEOUT_MS', env.PRAETOR_HTTP_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
    allowedHosts,
    allowedOrigins,
    applicationKey,
    writesEnabled: env.PRAETOR_HTTP_WRITES === 'true'
  };
}

function writeJson(response: ServerResponse, status: number, payload: Record<string, unknown>, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers
  });
  response.end(body);
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isWriteRequest(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(message => {
    if (!message || typeof message !== 'object') {
      return false;
    }
    const candidate = message as { method?: unknown; params?: { name?: unknown } };
    return candidate.method === 'tools/call' && candidate.params?.name === 'submit_review_advisory_packet';
  });
}

async function readBody(request: IncomingMessage, maxBytes: number, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    let settled = false;
    const timer = setTimeout(() => finish(new PraetorError('configuration_error', 'HTTP request timed out.')), timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      request.removeAllListeners('data');
      request.removeAllListeners('end');
      request.removeAllListeners('error');
      request.removeAllListeners('aborted');
    };
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (error) {
        request.resume();
        reject(error);
      } else {
        resolve(Buffer.concat(chunks));
      }
    };

    request.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > maxBytes) {
        finish(new PraetorError('configuration_error', `HTTP request body exceeds the ${maxBytes}-byte limit.`));
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => finish());
    request.on('error', error => finish(error));
    request.on('aborted', () => finish(new PraetorError('configuration_error', 'HTTP request was aborted.')));
  });
}

function toWebHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  return headers;
}

async function toNodeResponse(response: Response, nodeResponse: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = Buffer.from(await response.arrayBuffer());
  nodeResponse.writeHead(response.status, { ...headers, 'content-length': body.length });
  nodeResponse.end(body);
}

function matchesApplicationKey(supplied: string | undefined, expected: string): boolean {
  if (!supplied) {
    return false;
  }
  const suppliedBytes = Buffer.from(supplied, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PraetorError('configuration_error', 'HTTP request timed out.')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function errorStatus(error: unknown): number {
  if (error instanceof PraetorError && error.code === 'configuration_error') {
    return error.message.includes('body exceeds') ? 413 : error.message.includes('timed out') ? 408 : 400;
  }
  return 500;
}

function errorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof PraetorError) {
    return { error: { code: error.code, detail: error.message } };
  }
  console.error('[http_error]', error);
  return { error: { code: 'internal_error', detail: 'An internal error occurred.' } };
}

export async function startPraetorHttpServer(config = loadHttpServerConfig()): Promise<PraetorHttpServerHandle> {
  const handler = createMcpHandler(() => buildPraetorServer(), {
    legacy: 'stateless',
    onerror: error => console.error('[mcp_http_error]', error)
  });
  let activeRequests = 0;

  const server = createServer((request, response) => {
    void (async () => {
      if (activeRequests >= config.maxConcurrentRequests) {
        writeJson(response, 503, { error: { code: 'concurrency_limit', detail: 'The HTTP concurrency limit was reached.' } }, { 'retry-after': '1' });
        return;
      }
      activeRequests += 1;

      try {
        const hostValidation = validateHostHeader(headerValue(request, 'host'), config.allowedHosts);
        if (!hostValidation.ok) {
          writeJson(response, 403, { error: { code: 'invalid_host', detail: 'The HTTP Host header is not allowed.' } });
          return;
        }
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (requestUrl.pathname === '/healthz') {
          if (request.method !== 'GET') {
            writeJson(response, 405, { error: { code: 'method_not_allowed', detail: 'Health checks require GET.' } }, { allow: 'GET' });
            return;
          }
          writeJson(response, 200, { status: 'ok', service: 'praetor-mcp', transport: 'http', writes_enabled: config.writesEnabled });
          return;
        }
        if (requestUrl.pathname !== '/mcp') {
          writeJson(response, 404, { error: { code: 'not_found', detail: 'The requested HTTP route was not found.' } });
          return;
        }

        const originValidation = validateOriginHeader(headerValue(request, 'origin'), config.allowedOrigins);
        if (!originValidation.ok) {
          writeJson(response, 403, { error: { code: 'invalid_origin', detail: 'The HTTP Origin header is not allowed.' } });
          return;
        }

        const suppliedKey = headerValue(request, 'x-praetor-key');
        if (!matchesApplicationKey(suppliedKey, config.applicationKey)) {
          writeJson(response, 401, { error: { code: 'application_auth_required', detail: 'A valid X-Praetor-Key is required.' } }, { 'www-authenticate': 'X-Praetor-Key' });
          return;
        }

        const body = await readBody(request, config.maxBodyBytes, config.requestTimeoutMs);
        let parsedBody: unknown;
        if (body.length > 0 && (headerValue(request, 'content-type') ?? '').toLowerCase().startsWith('application/json')) {
          try {
            parsedBody = JSON.parse(body.toString('utf8'));
          } catch {
            parsedBody = undefined;
          }
        }
        if (!config.writesEnabled && isWriteRequest(parsedBody)) {
          writeJson(response, 403, { error: { code: 'http_writes_disabled', detail: 'HTTP write operations are disabled by default.' } });
          return;
        }

        const webRequest = new Request(requestUrl, {
          method: request.method,
          headers: toWebHeaders(request),
          body: body.length > 0 ? body.toString('utf8') : undefined
        });
        const mcpResponse = await withTimeout(
          handler.fetch(webRequest, parsedBody === undefined ? undefined : { parsedBody }),
          config.requestTimeoutMs
        );
        await toNodeResponse(mcpResponse, response);
      } catch (error) {
        if (!response.headersSent) {
          writeJson(response, errorStatus(error), errorPayload(error));
        } else {
          response.destroy(error instanceof Error ? error : undefined);
        }
      } finally {
        activeRequests -= 1;
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(config.port, config.host);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await handler.close();
    throw new PraetorError('configuration_error', 'HTTP server did not expose a TCP address.');
  }

  let closed = false;
  return {
    server,
    config,
    address: { host: address.address, port: address.port },
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await handler.close();
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  };
}
