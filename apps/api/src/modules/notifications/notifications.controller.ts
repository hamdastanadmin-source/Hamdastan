import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentAdmin, currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { notificationsSchemas as schemas } from './notifications.schema';
import { notificationsService as service } from './notifications.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/** HTTP adapter for the Notifications module: parse, call the service, send. */
export const notificationsController = {
  // ─── Product ───────────────────────────────────────────────────────────
  async inbox(request: FastifyRequest, reply: FastifyReply) {
    const { filter, before } = parseBody(schemas.inbox.query, request.query);
    return reply.send(ok(await service.inbox(currentUser(request), filter, before)));
  },

  async unread(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.unread(currentUser(request))));
  },

  async markRead(request: FastifyRequest, reply: FastifyReply) {
    const { ids } = parseBody(schemas.read.body, request.body ?? {});
    return reply.send(ok(await service.markRead(currentUser(request), ids ?? 'all')));
  },

  async open(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.open(currentUser(request), idOf(request))));
  },

  async dismiss(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.dismiss(currentUser(request), idOf(request))));
  },

  async preferences(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.preferences(currentUser(request))));
  },

  async savePreferences(request: FastifyRequest, reply: FastifyReply) {
    const { categories } = parseBody(schemas.preferences.body, request.body);
    return reply.send(ok(await service.savePreferences(currentUser(request), categories)));
  },

  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.subscribe.body, request.body);
    const userAgent = String(request.headers['user-agent'] ?? '');
    return reply.status(201).send(ok(await service.subscribe(currentUser(request), input, userAgent)));
  },

  async unsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { endpoint } = parseBody(schemas.unsubscribe.body, request.body);
    return reply.send(ok(await service.unsubscribe(currentUser(request), endpoint)));
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async overview(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.overview()));
  },

  async options(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.options()));
  },

  async estimate(request: FastifyRequest, reply: FastifyReply) {
    const { audience, category, destination } = parseBody(schemas.estimate.body, request.body);
    return reply.send(ok(await service.estimate(audience, category, destination)));
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.listCampaigns(parseBody(schemas.campaigns.query, request.query))));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.getCampaign(idOf(request))));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.campaign.body, request.body);
    return reply.status(201).send(ok(await service.createCampaign(currentAdmin(request), input)));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const input = parseBody(schemas.campaign.body, request.body);
    return reply.send(ok(await service.updateCampaign(currentAdmin(request), id, input)));
  },

  async duplicate(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(201).send(ok(await service.duplicate(currentAdmin(request), idOf(request))));
  },

  async send(request: FastifyRequest, reply: FastifyReply) {
    const id = idOf(request);
    const { scheduledAt } = parseBody(schemas.send.body, request.body);
    return reply.send(ok(await service.send(currentAdmin(request), id, scheduledAt)));
  },

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.cancel(currentAdmin(request), idOf(request))));
  },

  async stopPush(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.stopPush(currentAdmin(request), idOf(request))));
  },

  async archive(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.archive(currentAdmin(request), idOf(request))));
  },

  async report(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.report(idOf(request))));
  },

  async history(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.history(idOf(request))));
  },
};
