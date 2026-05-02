import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AllExceptionsFilter } from '../../all-exceptions.filter';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../errors/app-http.error';

function mockResponse() {
  const headerStore = new Map<string, string>();
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return {
    status,
    json,
    headersSent: false,
    get(name: string) {
      return headerStore.get(String(name).toLowerCase());
    },
    setHeader(name: string, value: string | number) {
      headerStore.set(String(name).toLowerCase(), String(value));
    },
    __headers: headerStore,
  };
}

function mockHost(req: { method: string; url: string }) {
  const res = mockResponse();
  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    },
    res,
  };
}

describe('AllExceptionsFilter', () => {
  let logger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    logger = { warn: vi.fn(), error: vi.fn() };
    filter = new AllExceptionsFilter(logger as never);
  });

  describe('AppHttpError', () => {
    it.each([
      [new NotFoundError('gone'), 404, 'Not Found', 'gone'],
      [new ValidationError('invalid'), 400, 'Bad Request', 'invalid'],
      [new UnauthorizedError('who'), 401, 'Unauthorized', 'who'],
      [new ForbiddenError('nope'), 403, 'Forbidden', 'nope'],
    ])('maps %s to %i', (err, code, phrase, msg) => {
      const { host, res } = mockHost({ method: 'GET', url: '/r' });
      filter.catch(err, host as never);

      expect(logger.warn).toHaveBeenCalledWith(
        `GET /r -> ${code} ${msg}`,
        'ExceptionFilter',
      );
      expect(logger.error).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(code);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: code,
        error: phrase,
        message: msg,
      });
    });

    it('merges ValidationError.extras into JSON body', () => {
      const { host, res } = mockHost({ method: 'POST', url: '/signup' });
      filter.catch(
        new ValidationError('Login already taken', { id: 'user-1' }),
        host as never,
      );
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Login already taken',
        id: 'user-1',
      });
    });
  });

  describe('HttpException', () => {
    it('passes through object body from getResponse()', () => {
      const { host, res } = mockHost({ method: 'POST', url: '/y' });
      const body = {
        statusCode: 400,
        message: ['a', 'b'],
        error: 'Bad Request',
      };
      filter.catch(new HttpException(body, 400), host as never);

      expect(logger.warn).toHaveBeenCalledWith(
        'POST /y -> 400 Http Exception',
        'ExceptionFilter',
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(body);
    });

    it('wraps string body in statusCode + message', () => {
      const { host, res } = mockHost({ method: 'GET', url: '/z' });
      filter.catch(new HttpException('nope', 403), host as never);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'nope',
      });
    });

    it('uses fallback label when message is empty', () => {
      const { host, res } = mockHost({ method: 'PATCH', url: '/p' });
      const ex = new HttpException({ statusCode: 422 }, 422);
      vi.spyOn(ex, 'message', 'get').mockReturnValue('');

      filter.catch(ex, host as never);

      expect(logger.warn).toHaveBeenCalledWith(
        'PATCH /p -> 422 HttpException',
        'ExceptionFilter',
      );
      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('sets Retry-After on 429 using X-RateLimit-Reset', () => {
      const { host, res } = mockHost({ method: 'POST', url: '/ai/x' });
      res.__headers!.set('x-ratelimit-reset', '41');
      const setSpy = vi.spyOn(res, 'setHeader');

      filter.catch(
        new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
        host as never,
      );

      expect(setSpy).toHaveBeenCalledWith('Retry-After', '41');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('does not force Retry-After on non-429 HttpException', () => {
      const { host, res } = mockHost({ method: 'GET', url: '/k' });
      const setSpy = vi.spyOn(res, 'setHeader');
      filter.catch(
        new HttpException('no', HttpStatus.BAD_REQUEST),
        host as never,
      );
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe('unhandled errors', () => {
    it('maps unknown Error to 500 and logs stack', () => {
      const { host, res } = mockHost({ method: 'GET', url: '/boom' });
      const err = new Error('fail');
      err.stack = 'stack-trace';

      filter.catch(err, host as never);

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'GET /boom unhandled: fail',
        'stack-trace',
        'ExceptionFilter',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    });

    it('maps non-Error throw to 500 without stack', () => {
      const { host, res } = mockHost({ method: 'GET', url: '/weird' });
      filter.catch('string-throw', host as never);

      expect(logger.error).toHaveBeenCalledWith(
        'GET /weird unhandled: string-throw',
        undefined,
        'ExceptionFilter',
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    });

    it('handles Error without stack', () => {
      const { host } = mockHost({ method: 'DELETE', url: '/d' });
      const err = new Error('x');
      delete err.stack;

      filter.catch(err, host as never);

      expect(logger.error).toHaveBeenCalledWith(
        'DELETE /d unhandled: x',
        undefined,
        'ExceptionFilter',
      );
    });
  });
});
