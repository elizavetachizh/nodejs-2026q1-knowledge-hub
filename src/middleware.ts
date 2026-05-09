import { LoggerService } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { sanitizeForLog } from './common/logging/sanitize-for-log';

const HTTP_CTX = 'HTTP';

export function createHttpLoggingMiddleware(logger: LoggerService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    const incoming = {
      event: 'request' as const,
      method: req.method,
      url: req.originalUrl,
      query: sanitizeForLog(req.query),
      body: sanitizeForLog(req.body),
    };

    logger.log(JSON.stringify(incoming), HTTP_CTX);

    res.on('finish', () => {
      const outgoing = {
        event: 'response' as const,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTimeMs: Date.now() - start,
      };
      logger.log(JSON.stringify(outgoing), HTTP_CTX);
    });

    next();
  };
}
