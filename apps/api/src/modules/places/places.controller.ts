import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin, currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { placesSchemas as schemas } from './places.schema';
import { placesService as service } from './places.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/** HTTP adapter for the Places module: parse, call the service, send. */
export const placesController = {
  // ─── Admin ─────────────────────────────────────────────────────────────
  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list()));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.get(idOf(request))));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.create.body, request.body);
    return reply.status(201).send(ok(await service.create(currentAdmin(request), input)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.update(currentAdmin(request), id, parseBody(schemas.write.body, request.body))));
  },

  async changeStatus(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.changeStatus(id, parseBody(schemas.status.body, request.body).action)));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.remove(idOf(request))));
  },

  // ─── Product ───────────────────────────────────────────────────────────
  async map(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = parseBody(schemas.world.params, request.params);
    return reply.send(ok(await service.map(currentUser(request), slug)));
  },

  async view(request: FastifyRequest, reply: FastifyReply) {
    const { slug, id } = parseBody(schemas.place.params, request.params);
    return reply.send(ok(await service.view(currentUser(request), slug, id)));
  },
};
