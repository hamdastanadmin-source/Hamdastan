/**
 * HTTP adapter for the Community module.
 *
 * Reads the request, calls communityService, shapes the reply with the helpers
 * in `shared/response`. It makes no decisions and touches no repository —
 * moving either one in here is what turns a controller into a second,
 * competing service.
 *
 *   async getById(request, reply) {
 *     const item = await communityService.getById(request.params.id);
 *     return reply.send(ok(item));
 *   }
 */
export const communityController = {
  // One handler per route.
};
