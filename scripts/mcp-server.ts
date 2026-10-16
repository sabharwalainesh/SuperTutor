import '../packages/config.js';
import { createMcpApp } from './mcp/server.js';
const port = Number(process.env.MCP_PORT ?? 8788);
const apiBaseUrl = process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;
const token = process.env.MCP_BEARER_TOKEN ?? '';
createMcpApp({ token, apiBaseUrl }).listen(port, '127.0.0.1', () => {
  console.log(`[mcp] http://127.0.0.1:${port}/mcp — authenticated, Go performs tutoring`);
});
