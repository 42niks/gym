import { createApp } from './app.js';
import { createD1AppDatabase } from './db/client.js';

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    const db = createD1AppDatabase(env.DB);
    const app = createApp(db, { secureCookies: true, allowPasswordlessLogin: false });
    return app.fetch(request, env, executionCtx);
  },
};
