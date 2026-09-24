import { buildApp } from './app';
import { env } from './config';

/**
 * Process entry point: build the server, listen, and shut down cleanly.
 *
 * All wiring lives in `app.ts`. This file owns the process — and, once a data
 * layer is chosen, this is where its repository implementations get bound,
 * before `listen`.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'shutting down');
      void app.close().then(() => process.exit(0));
    });
  }

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (error) {
    app.log.fatal({ err: error }, 'failed to start');
    process.exit(1);
  }
}

void main();
