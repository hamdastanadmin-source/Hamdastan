import type { FastifyReply, FastifyRequest } from 'fastify';

import { currentUser } from '../../middleware';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { onboardingSchemas as schemas } from './onboarding.schema';
import { onboardingService as service } from './onboarding.service';

const idOf = (request: FastifyRequest) => parseBody(schemas.byId.params, request.params).id;

/**
 * HTTP adapter for the Onboarding module. Every questionnaire handler but the
 * event sink answers with the same `QuestionnaireState`, so the screen has
 * one shape to hold after any call; every panel write answers with the whole
 * list it changed.
 */
export const onboardingController = {
  async interests(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.getInterests(currentUser(request))));
  },

  async saveInterests(request: FastifyRequest, reply: FastifyReply) {
    const { interestIds } = parseBody(schemas.interests.body, request.body);
    return reply.send(ok(await service.saveInterests(currentUser(request), interestIds)));
  },

  async questionnaire(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.getQuestionnaire(currentUser(request))));
  },

  async saveAnswer(request: FastifyRequest, reply: FastifyReply) {
    const { questionId } = parseBody(schemas.answer.params, request.params);
    const { answer } = parseBody(schemas.answer.body(await service.question(questionId)), request.body);
    return reply.send(ok(await service.saveAnswer(currentUser(request), questionId, answer)));
  },

  async complete(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.complete(currentUser(request))));
  },

  async recordEvent(request: FastifyRequest, reply: FastifyReply) {
    await service.recordEvent(currentUser(request).id, parseBody(schemas.event.body, request.body));
    return reply.send(ok(null));
  },

  // ─── The panel ─────────────────────────────────────────────────────────
  async adminInterestCategories(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.adminInterestCategories()));
  },

  async createInterestCategory(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.category.body, request.body);
    return reply.status(201).send(ok(await service.createInterestCategory(input)));
  },

  async updateInterestCategory(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.category.body, request.body);
    return reply.send(ok(await service.updateInterestCategory(idOf(request), input)));
  },

  async importInterests(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.interestImport.body, request.body);
    return reply.status(201).send(ok(await service.importInterests(input)));
  },

  async reorderInterestCategories(request: FastifyRequest, reply: FastifyReply) {
    const { ids } = parseBody(schemas.reorder.body, request.body);
    return reply.send(ok(await service.reorderInterestCategories(ids)));
  },

  async removeInterestCategory(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.removeInterestCategory(idOf(request))));
  },

  async adminQuestions(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.adminQuestions()));
  },

  async createQuestion(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.question.body, request.body);
    return reply.status(201).send(ok(await service.createQuestion(input)));
  },

  async updateQuestion(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.question.body, request.body);
    return reply.send(ok(await service.updateQuestion(idOf(request), input)));
  },

  async importQuestions(request: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(schemas.questionImport.body, request.body);
    return reply.status(201).send(ok(await service.importQuestions(input)));
  },

  async reorderQuestions(request: FastifyRequest, reply: FastifyReply) {
    const { ids } = parseBody(schemas.reorder.body, request.body);
    return reply.send(ok(await service.reorderQuestions(ids)));
  },

  async removeQuestion(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(ok(await service.removeQuestion(idOf(request))));
  },
};
