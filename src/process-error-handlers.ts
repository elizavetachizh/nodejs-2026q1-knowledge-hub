import { INestApplication, LoggerService } from '@nestjs/common';

export function registerProcessErrorHandlers(
  logger: LoggerService,
  getApp: () => INestApplication | undefined,
): void {
  let shuttingDown = false;

  const shutdown = async (reason: string, err: unknown): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(`${reason}: ${message}`, stack, 'Process');

    try {
      const app = getApp();
      if (app) await app.close();
    } catch (closeErr) {
      logger.error(
        `Shutdown failed: ${
          closeErr instanceof Error ? closeErr.message : String(closeErr)
        }`,
        closeErr instanceof Error ? closeErr.stack : undefined,
        'Process',
      );
    }
    process.exit(1);
  };

  process.on('uncaughtException', (error: Error) => {
    void shutdown('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    void shutdown('unhandledRejection', err);
  });
}
