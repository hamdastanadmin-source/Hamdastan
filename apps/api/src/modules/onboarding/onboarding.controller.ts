import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { onboardingSchemas } from './onboarding.schema';
import { onboardingService } from './onboarding.service';

/**
 * HTTP adapter for the Onboarding module. Every handler but the event sink
 * answers with the same `QuestionnaireState`, so the screen has one shape to
 * hold after any call.
 */
export const onboardingController = {
  async questionnaire(request: FastifyRequest, reply: FastifyReply) {
    const state = await onboardingService.getQuestionnaire(currentUser(request).id);
    return reply.send(ok(state));
  },

  async saveAnswer(request: FastifyRequest, reply: FastifyReply) {
    const { questionId } = parseBody(onboardingSchemas.answer.params, request.params);
    const { answer } = parseBody(onboardingSchemas.answer.body(questionId), request.body);
    const state = await onboardingService.saveAnswer(currentUser(request).id, questionId, answer);
    return reply.send(ok(state));
  },

  async complete(request: FastifyRequest, reply: FastifyReply) {
    const state = await onboardingService.complete(currentUser(request).id);
    return reply.send(ok(state));
  },

  async recordEvent(request: FastifyRequest, reply: FastifyReply) {
    const body = parseBody(onboardingSchemas.event.body, request.body);
    await onboardingService.recordEvent(currentUser(request).id, body);
    return reply.send(ok(null));
  },
};
