import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AvatarConfig } from '@hamdastan/config';

import { currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { accountSchemas } from './account.schema';
import { accountService } from './account.service';

/**
 * HTTP adapter for the Account module. Every write answers with the whole
 * overview and the XP it earned, so the screen has one shape to hold after
 * any call.
 */
export const accountController = {
  async overview(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await accountService.getOverview(currentUser(request).id)));
  },

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    const fields = parseBody(accountSchemas.profile.body, request.body);
    return reply.send(ok(await accountService.updateProfile(currentUser(request).id, fields)));
  },

  async saveAvatar(request: FastifyRequest, reply: FastifyReply) {
    const avatar = parseBody(accountSchemas.avatar.body, request.body) as AvatarConfig;
    return reply.send(ok(await accountService.saveAvatar(currentUser(request).id, avatar)));
  },

  async saveSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = parseBody(accountSchemas.settings.body, request.body);
    return reply.send(ok(await accountService.saveSettings(currentUser(request).id, settings)));
  },
};
