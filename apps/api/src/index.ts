import { stateFile } from '../../../packages/config.js';
import { TutorStore } from '../../../packages/tutor-state.js';
import { createApiApp } from './app.js';

const port = Number(process.env.API_PORT ?? 8787);
const app = createApiApp(new TutorStore(stateFile));
// Only the token-protected MCP bridge should be tunneled, never this local API.
app.listen(port, '127.0.0.1', () => console.log(`[api] http://127.0.0.1:${port} — Go tools, no model API`));
