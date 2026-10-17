import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { worldsSchemas as schemas } from './worlds.schema';
import { worldsService as service } from './worlds.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/** HTTP adapter for the Worlds module: parse, call the service, send. */
export const worldsController = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list()));
  },

  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = parseBody(schemas.bySlug.params, request.params);
    return reply.send(ok(await service.getBySlug(slug)));
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async listAll(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.listAll()));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const fields = parseBody(schemas.write.body, request.body);
    return reply.status(201).send(ok(await service.create(currentAdmin(request), fields)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.update(currentAdmin(request), id, parseBody(schemas.write.body, request.body))));
  },

  async reorder(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.reorder(parseBody(schemas.reorder.body, request.body).ids)));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.remove(currentAdmin(request), idOf(request))));
  },
};
