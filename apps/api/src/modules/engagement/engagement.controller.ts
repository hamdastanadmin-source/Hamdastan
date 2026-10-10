import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin, currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { engagementSchemas as schemas } from './engagement.schema';
import { engagementService as service } from './engagement.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/**
 * HTTP adapter for the Engagement module: parse, call the service, send.
 * It decides nothing — not even what an admin may see of a response.
 */
export const engagementController = {
  // ─── Admin ─────────────────────────────────────────────────────────────
  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list(parseBody(schemas.list.query, request.query))));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.get(idOf(request))));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.write.body, request.body);
    return reply.status(201).send(ok(await service.create(currentAdmin(request), input)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const input = parseBody(schemas.write.body, request.body);
    return reply.send(ok(await service.update(currentAdmin(request), id, input)));
  },

  async changeStatus(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { action } = parseBody(schemas.status.body, request.body);
    return reply.send(ok(await service.changeStatus(currentAdmin(request), id, action)));
  },

  async duplicate(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(201).send(ok(await service.duplicate(currentAdmin(request), idOf(request))));
  },

  async previewAudience(request: FastifyRequest, reply: FastifyReply) {
    const { audience } = parseBody(schemas.audience.body, request.body);
    return reply.send(ok(await service.previewAudience(audience)));
  },

  async results(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.results(id, parseBody(schemas.results.query, request.query))));
  },

  async exportCsv(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.exportCsv(id, parseBody(schemas.results.query, request.query))));
  },

  async submissions(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.submissions(id, parseBody(schemas.submissions.query, request.query))));
  },

  async review(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { decision, note } = parseBody(schemas.review.body, request.body);
    return reply.send(ok(await service.review(currentAdmin(request), id, decision, note)));
  },

  async grants(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.grants(id, parseBody(schemas.grants.query, request.query))));
  },

  async revokeXp(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseBody(schemas.revoke.params, request.params);
    const { reason } = parseBody(schemas.revoke.body, request.body);
    return reply.send(ok(await service.revokeXp(currentAdmin(request), id, reason)));
  },

  async history(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.history(idOf(request))));
  },

  // ─── Product ───────────────────────────────────────────────────────────
  async listMine(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.listMine(currentUser(request))));
  },

  async getMine(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.getMine(currentUser(request), idOf(request))));
  },

  async saveDraft(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { answers } = parseBody(schemas.draft.body, request.body);
    return reply.send(ok(await service.saveDraft(currentUser(request), id, answers)));
  },

  async submit(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const input = parseBody(schemas.submit.body, request.body);
    return reply.send(ok(await service.submit(currentUser(request), id, input)));
  },
};
