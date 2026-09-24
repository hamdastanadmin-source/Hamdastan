import type { FastifyError, FastifyInstance } from 'fastify';

import { AppError } from '../shared/errors';
import { fail } from '../shared/response';

/**
 * The single place a thrown error becomes an HTTP response.
 *
 * Services throw domain errors (`NotFoundError`, `ValidationError`, …) and
 * stay unaware of status codes; everything unrecognised becomes a 500 with
 * its details logged rather than returned.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((caught, request, reply) => {
    if (caught instanceof AppError) {
      if (caught.status >= 500) {
        request.log.error({ err: caught }, 'request failed');
      } else {
        request.log.info({ code: caught.code }, 'request rejected');
      }
      reply
        .status(caught.status)
        .send(fail(caught.code, caught.message, caught.details));
      return;
    }

    // Fastify's own failures (schema validation, malformed body) arrive with
    // a status already decided. Anything else is ours and is a bug.
    const { statusCode, message } = (caught ?? {}) as Partial<FastifyError>;

    if (typeof statusCode === 'number' && statusCode < 500) {
      reply.status(statusCode).send(fail('BAD_REQUEST', message ?? 'درخواست نامعتبر است'));
      return;
    }

    request.log.error({ err: caught }, 'unhandled error');
    reply.status(500).send(fail('INTERNAL_ERROR', 'خطای غیرمنتظره‌ای رخ داد'));
  });

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(fail('ROUTE_NOT_FOUND', `مسیر ${request.method} ${request.url} وجود ندارد`));
  });
}
