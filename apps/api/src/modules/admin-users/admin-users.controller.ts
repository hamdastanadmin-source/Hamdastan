import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../shared/response';
import { parseRequest } from '../../shared/validate';
import { adminUsersSchemas } from './admin-users.schema';
import { adminUsersService } from './admin-users.service';

/**
 * HTTP adapter for admin-user management.
 *
 * It parses the request, calls `adminUsersService` and shapes the reply. It
 * decides nothing — including who is allowed in: that is the guard on the
 * route, so a handler cannot be reached by an admin who lacks the permission
 * it needs.
 */
export const adminUsersController = {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const query = parseRequest(adminUsersSchemas.list, request.query);
    return reply.send(ok(await adminUsersService.list(query)));
  },

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(adminUsersSchemas.params, request.params);
    return reply.send(ok({ user: await adminUsersService.getById(id) }));
  },

  async create(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const input = parseRequest(adminUsersSchemas.create, request.body);
    return reply.status(201).send(ok(await adminUsersService.create(input)));
  },

  async update(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(adminUsersSchemas.params, request.params);
    const patch = parseRequest(adminUsersSchemas.update, request.body);
    return reply.send(ok({ user: await adminUsersService.update(id, patch) }));
  },

  /**
   * Backs both «بازنشانی رمز موقت» and «ارسال مجدد اطلاعات ورود»: they are the
   * same operation, because the previous password cannot be read back to be
   * re-sent — see the service.
   */
  async resetPassword(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(adminUsersSchemas.params, request.params);
    return reply.send(ok(await adminUsersService.resetTemporaryPassword(id)));
  },
};
