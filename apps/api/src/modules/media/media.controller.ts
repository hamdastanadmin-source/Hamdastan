import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { mediaSchemas as schemas } from './media.schema';
import { mediaService as service } from './media.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/** HTTP adapter for the Media module: parse, call the service, send. */
export const mediaController = {
  // ─── Admin ─────────────────────────────────────────────────────────────
  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list(parseBody(schemas.list.query, request.query))));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.get(idOf(request))));
  },

  async upload(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.upload.body, request.body);
    return reply.status(201).send(ok(await service.upload(currentAdmin(request), input)));
  },

  async replace(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { data } = parseBody(schemas.replace.body, request.body);
    return reply.send(ok(await service.replace(currentAdmin(request), id, data)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.update(currentAdmin(request), id, parseBody(schemas.update.body, request.body))));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.remove(idOf(request))));
  },

  // ─── Public ────────────────────────────────────────────────────────────
  /**
   * The file itself. Revalidated after five minutes, so a replaced file
   * reaches everyone soon; an unchanged one answers 304 from its hash.
   */
  async file(request: FastifyRequest, reply: FastifyReply) {
    const found = await service.file(idOf(request));
    if (!found) return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'فایل پیدا نشد' } });

    reply
      .header('Cache-Control', 'public, max-age=300')
      .header('ETag', found.etag)
      // Drawn by both apps, which in development sit on other ports of the same site.
      .header('Cross-Origin-Resource-Policy', 'same-site')
      // A file is only ever an image, a video or animation data: never a document to run.
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .header('X-Content-Type-Options', 'nosniff');
    if (request.headers['if-none-match'] === found.etag) return reply.status(304).send();
    return reply.type(found.mime).send(found.bytes);
  },

  async lottie(request: FastifyRequest, reply: FastifyReply) {
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.send(ok(await service.lottie(idOf(request))));
  },
};
