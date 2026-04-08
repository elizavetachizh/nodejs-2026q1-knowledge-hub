import { NextFunction, Request, Response } from 'express';
// Middleware for request logging
export const loggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();
  const method = req.method;
  const url = req.originalUrl;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    console.log(`${method} ${url} ${statusCode} ${duration}ms`);
  });
  next();
};
