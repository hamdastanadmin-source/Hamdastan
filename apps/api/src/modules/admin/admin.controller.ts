import type { FastifyReply, FastifyRequest } from 'fastify';

import { ADMIN_SESSION } from '@hamdastan/config';

import { currentAdmin } from '../../middleware';
import { clearAdminSessionCookie, setAdminSessionCookie } from '../../shared/cookies';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { adminSchemas } from './admin.schema';
import { adminService, toAdminUser } from './admin.service';

/**
 * HTTP adapter for the Admin module: parse, call the service, and move the
 * session token into its cookie. It decides nothing.
 */
export const adminController = {
  async requestOtp(request: FastifyRequest, reply: FastifyReply) {
    const { phone } = parseBody(adminSchemas.otpRequest.body, request.body);
    return reply.send(ok(await adminService.requestOtp(phone, request.ip || null)));
  },

  async verifyOtp(request: FastifyRequest, reply: FastifyReply) {
    const { phone, code } = parseBody(adminSchemas.otpVerify.body, request.body);
    const { session, token, expiresAt } = await adminService.verifyOtp(phone, code);
    setAdminSessionCookie(reply, token, expiresAt);
    return reply.send(ok(session));
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    await adminService.logout(request.cookies[ADMIN_SESSION.COOKIE]);
    clearAdminSessionCookie(reply);
    return reply.send(ok({ loggedOut: true }));
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok({ admin: toAdminUser(currentAdmin(request)) }));
  },

  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const query = parseBody(adminSchemas.listUsers.query, request.query);
    return reply.send(ok(await adminService.list(query)));
  },

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const fields = parseBody(adminSchemas.createUser.body, request.body);
    return reply.status(201).send(ok(await adminService.create(fields)));
  },

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseBody(adminSchemas.updateUser.params, request.params);
    const fields = parseBody(adminSchemas.updateUser.body, request.body);
    return reply.send(ok(await adminService.update(currentAdmin(request), id, fields)));
  },

  async lookupAppUser(request: FastifyRequest, reply: FastifyReply) {
    const { phone } = parseBody(adminSchemas.lookupAppUser.body, request.body);
    return reply.send(ok(await adminService.findAppUserSessions(phone)));
  },

  async appUserSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = parseBody(adminSchemas.appUserSessions.params, request.params);
    return reply.send(ok(await adminService.appUserSessions(userId)));
  },

  async revokeAppUserSession(request: FastifyRequest, reply: FastifyReply) {
    const { userId, sessionId } = parseBody(adminSchemas.revokeAppUserSession.params, request.params);
    await adminService.revokeAppUserSession(currentAdmin(request), userId, sessionId, request.log);
    return reply.send(ok({ revoked: 1 }));
  },

  async revokeAllAppUserSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = parseBody(adminSchemas.appUserSessions.params, request.params);
    return reply.send(ok(await adminService.revokeAllAppUserSessions(currentAdmin(request), userId, request.log)));
  },

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseBody(adminSchemas.deleteUser.params, request.params);
    await adminService.delete(currentAdmin(request), id);
    return reply.send(ok({ deleted: true }));
  },
};
