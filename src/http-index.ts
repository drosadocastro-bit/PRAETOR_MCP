import { loadHttpServerConfig, startPraetorHttpServer } from './httpServer.js';

const shutdown = async (handle: Awaited<ReturnType<typeof startPraetorHttpServer>>, signal: string) => {
  console.error(`PRAETOR-MCP HTTP shutdown requested by ${signal}`);
  await handle.close();
  process.exit(0);
};

try {
  const handle = await startPraetorHttpServer(loadHttpServerConfig());
  console.error(`PRAETOR-MCP HTTP server running on http://${handle.address.host}:${handle.address.port}/mcp`);
  process.once('SIGINT', () => void shutdown(handle, 'SIGINT'));
  process.once('SIGTERM', () => void shutdown(handle, 'SIGTERM'));
} catch (error) {
  console.error('[startup_error]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
