# Forms & surveys

How «فرم‌ها و نظرسنجی‌ها» is put together: who builds a form, who answers it,
and which half of the system decides what.

The endpoints are in [../api/forms.md](../api/forms.md); the future schema is in
[forms-data-model.md](./forms-data-model.md).

---

## 1. Three surfaces, one document

```
apps/admin                    apps/api                      apps/web
──────────                    ────────                      ────────
/forms            ─────────→  GET  /admin/forms
  dashboard                   GET  /admin/forms/overview
                              GET  /admin/forms/templates

/forms/:id/edit   ─────────→  GET   /admin/forms/:id
  builder          autosave   PATCH /admin/forms/:id
                              POST  /admin/forms/:id/publish
                                        │
                                        │ publishes
                                        ▼
                              GET  /forms/:id           ←───  /forms/:id
                              POST /forms/:id/responses  ←───   the respondent
                                        │
/forms/:id/responses ──────→  GET  /admin/forms/:id/responses
  statistics                  GET  .../responses/stats
                              GET  .../responses/export
```

One form is one document — pages, questions, logic, audience and settings
together. That is how the builder edits it (so an autosave is a single PATCH),
how a respondent receives it (one GET renders the whole form), and how a
document store would keep it.

Responses are separate rows: there are many of them, they are written by a
different audience, and nothing about a form changes when one arrives.

---

## 2. Where each decision lives

| Decision | Where |
| --- | --- |
| May this admin author forms? | `middleware/admin-guard.ts` → the role catalogue |
| Can this form be published? | `forms.service.ts` — at least one real question |
| Is this form answerable right now? | `forms.service.ts` — status **and** window |
| May this visitor answer it? | `forms.service.ts` — the form's audience |
| Is this answer acceptable? | `forms.service.ts` — against the question itself |
| Which questions are being asked? | `@hamdastan/shared/forms/logic` |
| What do the answers add up to? | `forms.service.ts` — over every response |
| Which screen shows what | `apps/admin/src/features/forms` |

Only the last row is in a front-end. Everything a respondent could lie about —
what is required, what the options were, whether the form was still open — is
decided in `apps/api` and re-checked on submission.

### The one piece deliberately shared

Conditional logic is evaluated in **three** places: the respondent's screen (to
decide what to render), the admin's preview, and the backend (to decide whether
a required answer is missing). Three implementations would drift, and the drift
would show up as a respondent unable to submit a form that looks complete.

So there is one, in `packages/shared/forms/logic.ts`, and all three import it.
The backend still has the final say — it evaluates the same rules against the
answers it was actually sent.

---

## 3. The builder

```
┌──────────────┬────────────────────────────────┬──────────────┐
│ config       │            canvas              │   palette    │
│ (left)       │           (centre)             │   (right)    │
│              │                                │              │
│ the selected │ welcome → pages → thank-you    │ 25 question  │
│ question's   │ each question as the control   │ types, in    │
│ settings     │ that will answer it            │ five groups  │
└──────────────┴────────────────────────────────┴──────────────┘
      toolbar: back · title · save state · tabs · save · publish
```

The palette is on the **right** because the layout is RTL and that is where a
hand reaches first. Both side panels collapse; the canvas keeps the room.

Four tabs share the centre — ساخت, منطق, تنظیمات, پیش‌نمایش — rather than four
routes, so switching never loses unsaved work or scroll position.

### Drag and drop

The browser's own. The palette's cards set
`application/x-hamdastan-question-type` on the drag; a question card sets
`application/x-hamdastan-question-id`; the drop zones between cards accept
either, and ask the builder to add or move. No drag library: HTML5 drag events
already do this, and a dependency added for it would have to be maintained.

Clicking a palette card appends to the current page — dragging is the
discoverable gesture, clicking is the fast one.

### Autosave

`use-form-builder.ts` holds the document. Every change applies locally first, so
the canvas never waits for the network, and a debounced PATCH follows 900 ms
later with the merged patch — reordering forty questions is one request.

The toolbar says which of four states the save is in (`ذخیره شد`, `در حال
ذخیره…`, `ذخیره‌نشده`, `ذخیره نشد`). A failed save leaves the editing alone and
says so, because throwing away work to match the server is worse than being out
of step with it. Publishing flushes first: publishing a version the server has
not seen would publish the previous one.

### The canvas is the form

Each question renders through `QuestionField` from the design system — the same
component the respondent gets, `disabled`. So the canvas is the form rather than
a diagram of one, and a question type that renders correctly there renders
correctly everywhere.

---

## 4. Preview, and why it is honest

`FormRunner` in `packages/ui/patterns` walks a form: pages, progress, what logic
shows, what is still missing, the thank-you screen. The admin's preview and the
public page in `apps/web` are **the same component**; the only difference is one
prop:

```tsx
<FormRunner form={form} preview />              // admin — submits nothing
<FormRunner form={form} onSubmit={submit} />    // apps/web — the real thing
```

"Preview shows exactly what end users see" is therefore a fact about the code
rather than an intention. The three device widths are widths, not pictures of
phones: what changes between a desktop and a phone is how much room the
questions get.

---

## 5. The respondent's page

`apps/web/src/app/forms/[id]` — outside the product's navigation on purpose:
somebody arriving from a shared link is here to answer a form.

The page asks the backend for the form and renders whichever answer it gets: the
form, or the reason there is none. It decides nothing itself — not whether the
window is open, not whether this visitor is in the audience, not whether they
have already answered.

The link an admin shares is `{WEB_BASE_URL}/forms/{id}`, built in the panel's
share dialog from the config value, because the form lives in the product and
not in the panel.

---

## 6. Permissions

Seven, so that reading answers can be separated from authoring and exporting
from reading:

```
forms.view · forms.create · forms.edit · forms.publish · forms.delete
forms.responses.view · forms.responses.export
```

| Role | Forms access |
| --- | --- |
| `super_admin` | all of them |
| `form_manager` | all of them (and nothing to do with admin accounts) |
| `user_manager` | none |
| `support` | none |

`form_manager` exists to make the separation real: it can build, publish and
read answers, and `GET /admin/users` answers it 403.

---

## 7. Where the code lives

```
apps/api/src/
├── modules/forms/                 the whole module, seven files
└── middleware/session-user.ts     resolves the product's cookie, demands nothing

apps/admin/src/
├── app/(dashboard)/forms/         three routes: list, edit, responses
└── features/forms/
    ├── components/                dashboard, share dialog
    ├── components/builder/        palette, canvas, config, logic, settings, preview
    ├── components/responses/      overview, per-question analysis, individual
    ├── hooks/use-form-builder.ts  the document, and the autosave
    ├── services/                  the only files that name a route
    └── types/question-catalogue.ts  the 25 types, their icons and their defaults

apps/web/src/
├── app/forms/[id]/                the respondent's page, no product chrome
└── features/forms/

packages/
├── types/forms.ts                 the contract
├── validation/forms.ts            the rules both sides apply
├── shared/forms/logic.ts          conditional logic, evaluated once
└── ui/patterns/
    ├── QuestionField.tsx          one question as its control
    ├── FormRunner.tsx             a form, as it is answered
    └── JalaliDateField.tsx        a date, in the calendar people read
```

---

## 7.5 Images

A question can carry a background image. The author picks a file, the browser
reads it and `POST /admin/forms/:id/assets` sends it as base64 to **our
backend** — no third-party uploader, in keeping with the rule that the
front-end talks to `apps/api` and to nothing else. What comes back is a URL; the
form document holds the reference and never the bytes.

The bytes live in the same kind of stand-in as everything else — a Map, bound
only outside production — and `saveAsset` / `findAsset` on the repository port
are the two methods that point at an object store when one is chosen.

Two details that are easy to get wrong and are handled:

- the URL is stored **relative** (`/api/v1/forms/assets/…`), because the API's
  origin is deployment configuration and has no business inside a saved form;
  `resolveAssetUrl` in the design system prefixes it at render time;
- the image response sets `Cross-Origin-Resource-Policy: cross-origin`, since
  both front-ends are served from a different origin than the API and helmet's
  default would otherwise stop the browser painting it.

## 8. What is left

- **A data layer.** Forms and the answers people took the trouble to write live
  in a `Map` and are lost on restart. The schema to implement is in
  [forms-data-model.md](./forms-data-model.md). In production the repository
  stays unbound and every forms route answers 501, which is the honest failure.
- **Respondent file uploads.** `FILE_UPLOAD` collects a file *name*, not a
  file. Question **backgrounds** are stored (see below), but an answer's
  attachment is a different problem: it arrives from the public internet, needs
  a scanning policy, and grows without bound. The question type and its settings
  are ready for it.
- **A real `.xlsx` and a real PDF.** Both exports are CSV today (with the byte
  order mark and separator hint that make Excel open Persian correctly), and PDF
  is the browser's print dialogue. Both would need a library, which is a
  dependency decision rather than a detail.
- **A chart library.** The bars and the trend columns are CSS widths and
  heights. That is enough for proportions and a fortnight of counts; a
  distribution histogram or a date-range picker would want a real one, and
  `packages/ui` has a note where it goes.
- **Notifications.** The two switches are stored and nothing sends anything yet.
  When they do, it is through `integrations/sms` (and whatever is chosen for
  email), never from the browser.
- **Audience by group.** Designed and refused: `GROUPS` matches nobody, because
  groups are not an entity in this product yet. It fails closed on purpose.
- **Answer-level audit.** A response records who and when, not what was changed
  after the fact. Editing an existing answer overwrites it.
