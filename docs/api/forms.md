# API — forms & surveys

Two base paths, because two different audiences use this module:

| | |
| --- | --- |
| `/api/v1/admin/forms` | authoring — guarded by admin permissions |
| `/api/v1/forms` | answering — open to whoever a form's audience allows |

Every response is the `ApiResponse<T>` envelope from `@hamdastan/types`, with
one deliberate exception: the export, which is a file.

```json
{ "ok": true,  "data": { … } }
{ "ok": false, "error": { "code": "…", "message": "…", "details": { … } } }
```

`message` is Persian and safe to show. **The client switches on `code`.**

Request bodies are validated in `forms.controller.ts` against the schemas in
`packages/validation/forms.ts`, the same ones the builder and the public form
parse against. What those schemas cannot check — whether an answer suits the
question that asked for it — is checked by the service against the question
itself.

The module is described in
[../architecture/forms-module.md](../architecture/forms-module.md); the future
schema is in
[../architecture/forms-data-model.md](../architecture/forms-data-model.md).

---

## The admin half

Every route is guarded by `requireAdmin(permission)`, which requires all five:
authenticated, active, in date, past the forced password change, and permitted.
See [admin-users.md](./admin-users.md#what-every-route-checks-first) for the
refusals, which are identical here.

| Route | Permission |
| --- | --- |
| `GET /admin/forms/overview` | `forms.view` |
| `GET /admin/forms/templates` | `forms.view` |
| `GET /admin/forms` | `forms.view` |
| `POST /admin/forms` | `forms.create` |
| `GET /admin/forms/:id` | `forms.view` |
| `PATCH /admin/forms/:id` | `forms.edit` |
| `DELETE /admin/forms/:id` | `forms.delete` |
| `POST /admin/forms/:id/publish` · `/unpublish` · `/close` | `forms.publish` |
| `POST /admin/forms/:id/duplicate` | `forms.create` |
| `POST /admin/forms/:id/assets` | `forms.edit` |
| `GET /admin/forms/:id/responses` · `/responses/stats` · `/responses/:responseId` | `forms.responses.view` |
| `GET /admin/forms/:id/responses/export` | `forms.responses.export` |

### GET /admin/forms/overview

The four cards above the dashboard, counted over every form.

```json
{ "ok": true, "data": { "totalForms": 4, "publishedForms": 2, "draftForms": 1, "totalResponses": 48 } }
```

`publishedForms` counts what is *answerable right now*: a published form whose
closing date has passed is not among them, without anything having run at
midnight to change its status.

### GET /admin/forms

| Query | Default | Notes |
| --- | --- | --- |
| `search` | — | Title, description or owner |
| `status` | — | `DRAFT` \| `PUBLISHED` \| `CLOSED` |
| `sort` | `RECENT` | `RECENT` \| `TITLE` \| `RESPONSES` |
| `page`, `pageSize` | `1`, `20` | `pageSize` max 100 |

**200** — a `Paginated<FormSummary>`: the document without its body, plus
`questionCount` (layout blocks excluded) and `responseCount`.

### GET /admin/forms/templates

**200** — `{ "templates": FormTemplate[] }`. Six starting points; copying one is
`POST /admin/forms` with its id.

### POST /admin/forms

```json
{ "title": "نظرسنجی رضایت مشتریان", "templateId": "tpl-customer-satisfaction" }
```

**201** — `{ "form": Form }`, always a `DRAFT`.

With a `templateId`, the template's pages and questions are copied and **every
id inside is regenerated**, so two forms from one template never share a
question id — their answers would otherwise be indistinguishable.

| Failure | Status | Code |
| --- | --- | --- |
| Title missing or too short | 400 | `VALIDATION_ERROR` |
| No such template | 404 | `NOT_FOUND` |

### PATCH /admin/forms/:id

The builder's autosave. Every field is optional and **replaces** what is
stored; an empty body is refused.

```json
{
  "title": "…",
  "pages": [{ "id": "…", "title": "صفحهٔ ۱", "order": 0 }],
  "questions": [{ "id": "…", "pageId": "…", "type": "RATING_STARS", "title": "…", "required": true, "order": 0 }],
  "conditionalLogic": [{ "id": "…", "whenQuestionId": "…", "operator": "EQUALS", "value": "بله", "action": "SHOW", "targetQuestionId": "…" }],
  "audience": { "mode": "EVERYONE" },
  "settings": { "…": "FormSettings" }
}
```

Questions and pages are sent whole rather than one at a time: the builder holds
the document, so reordering forty questions is one request.

### POST /admin/forms/:id/publish

**200** — `{ "form": Form }` with `status: "PUBLISHED"` and `publishedAt` set
(kept from a previous publish if there was one).

| Failure | Status | Code |
| --- | --- | --- |
| The form has no answerable question | 400 | `FORM_HAS_NO_QUESTIONS` |

`unpublish` returns it to `DRAFT` and clears `publishedAt`; `close` stops new
answers without hiding the old ones. **Neither touches the responses.**

There are three statuses and no fourth: an "archived" state was built and
removed, because it did what closing already does and left forms in a place
nobody could explain.

### DELETE /admin/forms/:id

**200** — `{ "deleted": true }`. Deletes the form **and its responses**, which
is why the panel asks first and says how many answers go with it. Closing a form
is the reversible alternative.

### POST /admin/forms/:id/assets

An image for a question's background.

```json
{ "filename": "cover.png", "contentType": "image/png", "data": "iVBORw0KGgo…" }
```

base64 rather than multipart, so the panel keeps using the one JSON client it
has and no upload library is added. PNG, JPEG, WEBP or GIF, up to 2 MB measured
on the **decoded** bytes — base64 inflates by a third, so a limit on the string
would let a larger file through.

**201**

```json
{ "ok": true, "data": { "url": "/api/v1/forms/assets/152cce3c-…" } }
```

The URL is relative on purpose: the API's origin is deployment configuration and
does not belong inside a saved form. Put it straight into the question's
`settings.backgroundImageUrl`; the design system resolves it when it renders.

| Failure | Status | Code |
| --- | --- | --- |
| Not an allowed image type | 400 | `VALIDATION_ERROR` |
| Larger than 2 MB decoded | 400 | `FORM_ASSET_TOO_LARGE` |
| Unreadable base64 | 400 | `FORM_ASSET_INVALID` |

### GET /forms/assets/:assetId

The image itself — public, cached hard, and outside the envelope. It answers
with `Cross-Origin-Resource-Policy: cross-origin`, because both front-ends are
served from a different origin than the API and the default would stop the
browser painting it.

### GET /admin/forms/:id/responses/stats

Every statistic the responses dashboard shows, computed over every response —
not over a page of them.

```json
{
  "totalResponses": 48,
  "completedResponses": 41,
  "incompleteResponses": 7,
  "completionRate": 85.4,
  "averageCompletionSeconds": 163,
  "trend": [{ "date": "2026-09-13", "count": 3 }],
  "questions": [
    { "questionId": "…", "type": "RATING_STARS", "answerCount": 48, "skippedCount": 0, "average": 4.1,
      "breakdown": [{ "label": "5", "count": 18, "percentage": 37.5 }] },
    { "questionId": "…", "type": "NPS", "average": 7.8, "npsScore": 21,
      "breakdown": [{ "label": "مروجان (۹–۱۰)", "count": 22, "percentage": 45.8 }] },
    { "questionId": "…", "type": "LONG_TEXT", "textAnswers": ["پاسخ‌گویی سریع بود، ممنون."] }
  ]
}
```

What each question type reduces to:

| Type | Shape |
| --- | --- |
| Choice, dropdown, image choice, yes/no | `breakdown` — count and percentage per option |
| Multiple choice | `breakdown`, as a share of **respondents**, so it exceeds 100% |
| Rating, scale, slider, number | `average` plus a `breakdown` by value |
| NPS | `average`, `npsScore` (−100…100) and the three groups |
| Everything else | `textAnswers`, newest first, capped at 100 |

### GET /admin/forms/:id/responses/export

**Not an envelope** — a file.

| Query | Default | |
| --- | --- | --- |
| `format` | `CSV` | `CSV` \| `EXCEL` |

One row per response; one column per question, in the form's order, after
`شناسهٔ پاسخ`, `پاسخ‌دهنده`, `وضعیت`, `تاریخ ثبت` and `مدت پاسخ‌گویی`.

Both formats are CSV. `EXCEL` adds a `sep=,` hint so Excel opens it as columns
in every locale; both start with a byte order mark, which is what makes Excel
read Persian rather than mojibake. **A real `.xlsx` needs a library and none has
been chosen** — PDF is the browser's print dialogue from the responses screen,
for the same reason. See
[../architecture/forms-module.md](../architecture/forms-module.md#what-is-left).

---

## The respondent's half

No permission, no admin session. `attachSessionUser` resolves the product's
session cookie if there is one and leaves `null` if there is not; the service
decides from the form's own audience.

### GET /forms/:id

The form, if this visitor may answer it right now.

**200** — `{ "form": Form }`, the whole document: pages, questions, logic and
settings, because the respondent's screen renders all of it.

| Failure | Status | Code |
| --- | --- | --- |
| Never published | 400 | `FORM_NOT_PUBLISHED` |
| Window has not opened | 400 | `FORM_NOT_YET_OPEN` |
| Window has closed | 400 | `FORM_CLOSED` |
| Audience excludes this visitor (or they are signed out) | 403 | `FORM_AUDIENCE_DENIED` |
| Already answered, and editing is off | 400 | `FORM_ALREADY_ANSWERED` |
| Archived, or no such form | 404 | `NOT_FOUND` |

### POST /forms/:id/responses

```json
{
  "complete": true,
  "elapsedSeconds": 96,
  "answers": [
    { "questionId": "…", "value": 5 },
    { "questionId": "…", "value": ["تماس تلفنی", "ایمیل"] },
    { "questionId": "…", "value": "پاسخ‌گویی سریع بود." }
  ]
}
```

**201** when `complete`, **200** for a draft between pages — `{ "response": FormResponse }`.

`value` is a string, a number, a list of strings (multiple choice, ranking) or
an object keyed by row (matrix). What is acceptable depends on the question, and
is checked against it:

- required questions must be answered — but **only if logic is showing them**,
  so a hidden question can never block a submission;
- lengths, ranges, email, phone, URL and date shapes;
- a chosen option must be one the question offers, unless it allows «سایر»;
- an answer to a question this form does not have is dropped, not stored.

Everything the browser checked is checked again here. The window, the audience
and the one-response rule are re-read on submission, so a form that closed while
somebody was filling it in refuses the answer.

| Failure | Status | Code |
| --- | --- | --- |
| Any answer fails its question's rules | 400 | `FORM_ANSWER_INVALID` (with `details.questionId`) |
| Not published, closed, not yet open | 400 | `FORM_NOT_PUBLISHED` / `FORM_CLOSED` / `FORM_NOT_YET_OPEN` |
| Already answered | 400 | `FORM_ALREADY_ANSWERED` |
| Not in the audience | 403 | `FORM_AUDIENCE_DENIED` |

When the form collects answers anonymously, `respondentId` and `respondentName`
are stored as `null` even for a signed-in visitor — the setting is applied where
the row is written, not where it is read.
