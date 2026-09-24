/**
 * HTTP adapter for the Events module.
 *
 * Reads the request, calls eventsService, shapes the reply with the helpers
 * in `shared/response`. It makes no decisions and touches no repository —
 * moving either one in here is what turns a controller into a second,
 * competing service.
 *
 *   async getById(request, reply) {
 *     const item = await eventsService.getById(request.params.id);
 *     return reply.send(ok(item));
 *   }
 */
export const eventsController = {
  // One handler per route.
};
