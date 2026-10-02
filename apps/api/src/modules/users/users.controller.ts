import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { usersSchemas } from './users.schema';
import { toOnboardingInterests, toSession, usersService } from './users.service';

/**
 * HTTP adapter for the Users module.
 *
 * Both handlers answer with the same `{ user, nextStep }` envelope the verify
 * endpoint returns, so the front-end has one shape to hold and one field to
 * route on however it arrived there.
 */
export const usersController = {
  /** The session, re-read. This is what the front-end calls on every load. */
  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await usersService.getById(currentUser(request).id);
    return reply.send(ok(toSession(user)));
  },

  async updateBasicInfo(request: FastifyRequest, reply: FastifyReply) {
    const info = parseBody(usersSchemas.basicInfo.body, request.body);
    const updated = await usersService.saveBasicInfo(currentUser(request).id, info);
    return reply.send(ok(toSession(updated)));
  },

  async completeOnboarding(request: FastifyRequest, reply: FastifyReply) {
    const updated = await usersService.completeOnboarding(currentUser(request).id);
    return reply.send(ok(toSession(updated)));
  },

  async onboardingInterests(request: FastifyRequest, reply: FastifyReply) {
    const record = await usersService.getOnboardingInterests(currentUser(request).id);
    return reply.send(ok(toOnboardingInterests(record)));
  },

  async saveOnboardingInterests(request: FastifyRequest, reply: FastifyReply) {
    const { interestIds } = parseBody(usersSchemas.interests.body, request.body);
    const record = await usersService.saveInterests(currentUser(request).id, interestIds);
    return reply.send(ok(toOnboardingInterests(record)));
  },
};
