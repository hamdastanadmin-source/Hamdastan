import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../shared/response';
import { parseRequest } from '../../shared/validate';
import { formsSchemas } from './forms.schema';
import { formsService, type Respondent } from './forms.service';

/**
 * HTTP adapter for the Forms module.
 *
 * It parses the request, calls `formsService` and shapes the reply. It decides
 * nothing — not who may author a form (the guard on the route), and not who may
 * answer one (the service, from the form's own audience).
 *
 * Two audiences share it: the admin routes act as the signed-in admin, and the
 * public routes act as whoever the product's session cookie resolves to, which
 * may be nobody at all.
 */

/** The acting admin, for the fields a form records about its author. */
function actingAdmin(
  request: FastifyRequest
): { id: string; username: string; name: string } {
  // Guarded routes always have one — `requireAdmin` put it there.
  const admin = request.admin!;
  return { id: admin.id, username: admin.username, name: admin.fullName };
}

/** Whoever is answering, as the service understands them. */
function respondent(request: FastifyRequest): Respondent {
  const user = request.user;
  return user ? { id: user.id, name: user.fullName, role: user.role } : null;
}

export const formsController = {
  // ─── The admin's side ─────────────────────────────────────────────────────

  async overview(_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return reply.send(ok(await formsService.overview()));
  },

  async templates(_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return reply.send(ok({ templates: await formsService.templates() }));
  },

  async list(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const query = parseRequest(formsSchemas.list, request.query);
    return reply.send(ok(await formsService.list(query)));
  },

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    return reply.send(ok({ form: await formsService.getById(id) }));
  },

  async create(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const input = parseRequest(formsSchemas.create, request.body);
    const form = await formsService.create(input, actingAdmin(request));
    return reply.status(201).send(ok({ form }));
  },

  /** The builder's autosave. */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const patch = parseRequest(formsSchemas.update, request.body);
    return reply.send(ok({ form: await formsService.update(id, patch) }));
  },

  async publish(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    return reply.send(ok({ form: await formsService.publish(id) }));
  },

  async unpublish(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    return reply.send(ok({ form: await formsService.unpublish(id) }));
  },

  async close(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    return reply.send(ok({ form: await formsService.close(id) }));
  },

  async duplicate(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const form = await formsService.duplicate(id, actingAdmin(request));
    return reply.status(201).send(ok({ form }));
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    await formsService.remove(id);
    return reply.send(ok({ deleted: true }));
  },

  /** Uploading a background image for a question. */
  async uploadAsset(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const input = parseRequest(formsSchemas.uploadAsset, request.body);
    return reply.status(201).send(ok(await formsService.uploadAsset(id, input)));
  },

  // ─── Responses ────────────────────────────────────────────────────────────

  async listResponses(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const { page, pageSize } = parseRequest(formsSchemas.responses, request.query);
    return reply.send(ok(await formsService.listResponses(id, page, pageSize)));
  },

  async stats(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    return reply.send(ok(await formsService.stats(id)));
  },

  async getResponse(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id, responseId } = parseRequest(formsSchemas.responseParams, request.params);
    return reply.send(ok({ response: await formsService.getResponse(id, responseId) }));
  },

  /**
   * The responses as a file.
   *
   * The one route that does not answer in the `ApiResponse` envelope: what
   * comes back is the download itself. `EXCEL` is the same CSV with a byte
   * order mark and a separator hint, which is what makes Excel open it as
   * columns and read Persian correctly — a real `.xlsx` needs a library, and
   * none has been chosen. See `docs/api/forms.md`.
   */
  async exportResponses(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const { format } = parseRequest(formsSchemas.export, request.query);
    const { filename, rows } = await formsService.exportResponses(id);

    const body = rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n');
    const prefix = format === 'EXCEL' ? '﻿sep=,\r\n' : '﻿';

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        // The filename is Persian, so it goes in the RFC 5987 form; the plain
        // one is an ASCII fallback for clients that ignore it.
        `attachment; filename="responses.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`
      )
      .send(`${prefix}${body}`);
  },

  // ─── The respondent's side ────────────────────────────────────────────────

  /**
   * An uploaded image.
   *
   * Public, and outside the envelope: it is the image itself, rendered inside a
   * form that whoever is looking at it can already see. Cached hard because the
   * id is content-specific — a new upload gets a new id.
   */
  async getAsset(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { assetId } = parseRequest(formsSchemas.assetParams, request.params);
    const { contentType, bytes } = await formsService.getAsset(assetId);

    return (
      reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        /**
         * Helmet defaults every response to `same-origin`, which is right for
         * JSON and wrong for an image: both front-ends are served from a
         * different origin than the API, so the browser would refuse to paint
         * it. Loosened on this route alone, and only because the bytes are
         * already public to anybody who can open the form.
         */
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(bytes)
    );
  },

  async getPublished(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const form = await formsService.getPublished(id, respondent(request));
    return reply.send(ok({ form }));
  },

  async submitResponse(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = parseRequest(formsSchemas.params, request.params);
    const input = parseRequest(formsSchemas.submit, request.body);
    const response = await formsService.submitResponse(id, input, respondent(request));
    return reply.status(input.complete ? 201 : 200).send(ok({ response }));
  },
};

/** Quotes a cell the way every spreadsheet expects. */
function toCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped;
}
