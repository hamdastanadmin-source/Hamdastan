import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin, currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { eventsSchemas as schemas } from './events.schema';
import { eventsService as service } from './events.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;
const slugOf = (request: FastifyRequest) => parseBody(schemas.bySlug.params, request.params).slug;

/** HTTP adapter for the Events module: parse, call the service, send. */
export const eventsController = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.list(currentUser(request), parseBody(schemas.list.query, request.query))));
  },

  async calendar(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.calendar(currentUser(request), parseBody(schemas.calendar.query, request.query))));
  },

  async categories(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.categories()));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.get(currentUser(request), slugOf(request))));
  },

  async related(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.related(currentUser(request), slugOf(request))));
  },

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    const { tab } = parseBody(schemas.mine.query, request.query);
    return reply.send(ok(await service.listMine(currentUser(request), tab)));
  },

  async setInterest(request: FastifyRequest, reply: FastifyReply) {
    const { remindInApp } = parseBody(schemas.interest.body, request.body);
    return reply.send(ok(await service.setInterest(currentUser(request), idOf(request), remindInApp)));
  },

  async removeInterest(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.removeInterest(currentUser(request), idOf(request))));
  },

  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.booking.body, request.body);
    return reply.status(201).send(ok(await service.register(currentUser(request), idOf(request), input)));
  },

  async cancelRegistration(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.cancelRegistration(currentUser(request), idOf(request))));
  },

  async handoff(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.booking.body, request.body);
    return reply.send(ok(await service.handoff(currentUser(request), idOf(request), input)));
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
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

  async duplicate(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(201).send(ok(await service.duplicate(currentAdmin(request), idOf(request))));
  },

  async preview(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.preview(idOf(request))));
  },

  async history(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.history(idOf(request))));
  },

  async previewAudience(request: FastifyRequest, reply: FastifyReply) {
    const { audience } = parseBody(schemas.audience.body, request.body);
    return reply.send(ok(await service.previewAudience(audience)));
  },

  async listBookings(request: FastifyRequest, reply: FastifyReply) {
    const { page, pageSize } = parseBody(schemas.bookings.query, request.query);
    return reply.send(ok(await service.listBookings(idOf(request), page, pageSize)));
  },

  async reviewBooking(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.reviewBooking(currentAdmin(request), id, parseBody(schemas.review.body, request.body))));
  },

  // ─── Categories ────────────────────────────────────────────────────────
  async adminCategories(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.adminCategories()));
  },

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const fields = parseBody(schemas.category.body, request.body);
    return reply.status(201).send(ok(await service.createCategory(currentAdmin(request), fields)));
  },

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    return reply.send(ok(await service.updateCategory(currentAdmin(request), id, parseBody(schemas.category.body, request.body))));
  },

  async reorderCategories(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.reorderCategories(parseBody(schemas.reorder.body, request.body).ids)));
  },

  async removeCategory(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.removeCategory(currentAdmin(request), idOf(request))));
  },
};
