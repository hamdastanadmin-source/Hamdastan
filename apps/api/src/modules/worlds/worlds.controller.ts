import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin, currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { worldsSchemas as schemas } from './worlds.schema';
import { worldsService as service } from './worlds.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;
const slugOf = (request: FastifyRequest) => parseBody(schemas.bySlug.params, request.params).slug;

/** HTTP adapter for the Worlds module: parse, call the service, send. */
export const worldsController = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list()));
  },

  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.getBySlug(slugOf(request))));
  },

  async home(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.home(currentUser(request), slugOf(request))));
  },

  async activities(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.activities(currentUser(request), slugOf(request))));
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async listAll(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.listAll()));
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
    const { action } = parseBody(schemas.status.body, request.body);
    return reply.send(ok(await service.changeStatus(currentAdmin(request), id, action)));
  },

  async reorder(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.reorder(parseBody(schemas.reorder.body, request.body).ids)));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.remove(currentAdmin(request), idOf(request))));
  },

  async getHome(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.getHome(idOf(request))));
  },

  async saveHome(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.saveHome(currentAdmin(request), id, parseBody(schemas.home.body, request.body))));
  },

  async candidates(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { kind, q } = parseBody(schemas.candidates.query, request.query);
    return reply.send(ok(await service.candidates(id, kind, q)));
  },

  async preview(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.preview(idOf(request))));
  },
};
