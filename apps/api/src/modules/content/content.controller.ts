import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { contentSchemas as schemas } from './content.schema';
import { contentService as service } from './content.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/** HTTP adapter for the Content module: parse, call the service, send. */
export const contentController = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list(parseBody(schemas.list.query, request.query))));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = parseBody(schemas.bySlug.params, request.params);
    return reply.send(ok(await service.get(slug)));
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async index(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.index(parseBody(schemas.index.query, request.query))));
  },

  async adminList(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.adminList(parseBody(schemas.adminList.query, request.query))));
  },

  async adminGet(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.adminGet(idOf(request))));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const fields = parseBody(schemas.write.body, request.body);
    return reply.status(201).send(ok(await service.create(currentAdmin(request), fields)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.update(currentAdmin(request), id, parseBody(schemas.write.body, request.body))));
  },

  async changeStatus(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { action, publishAt } = parseBody(schemas.status.body, request.body);
    return reply.send(ok(await service.changeStatus(currentAdmin(request), id, action, publishAt)));
  },

  async preview(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.preview(idOf(request))));
  },

  async history(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.history(idOf(request))));
  },
};
