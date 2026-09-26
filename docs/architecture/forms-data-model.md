# Forms data model

**Nothing here is implemented in a database.** No database, ORM or persistence
technology has been chosen for this project, and none has been added. This is
the design the eventual data layer has to satisfy, and the contract the
in-memory stand-in in `apps/api/src/modules/forms/forms.repository.ts` already
implements.

The port a data layer plugs into is `FormsRepository` in that file. Nothing
below is a migration — see [the rule on database changes](#applying-this-later).

---

## 1. Entities

```
+------------------------------+          +--------------------------+
|  Form                        |          |  FormTemplate            |
|------------------------------|          |--------------------------|
| id                  PK       |          | id            PK         |
| title                        |  copied  | title                    |
| description        nullable  |<---------| description              |
| status                       |  at      | category                 |
| category                     |  create  | pages         json       |
| owner_id           FK → admin|          | questions     json       |
| owner_username               |          +--------------------------+
| owner_name                   |
| pages               json     |
| questions           json     |
| conditional_logic   json     |
| audience            json     |
| settings            json     |
| created_at / updated_at      |
| published_at       nullable  |
+------------------------------+
            |
            | 1:N   ON DELETE CASCADE
            v
+------------------------------+     +--------------------------+
|  FormResponse                |     |  FormAsset               |
|------------------------------|     |--------------------------|
| id                  PK       |     | id            PK         |
| form_id             FK       |     | form_id       FK         |
| respondent_id      nullable  |
| respondent_name    nullable  |
| status                       |
| answers             json     |
| started_at                   |
| submitted_at       nullable  |
| completion_seconds nullable  |     | content_type             |
+------------------------------+     | bytes → object store     |
                                     +--------------------------+
```

Four tables, and the shape of the first is the design decision worth
explaining.

### Why the form is one document

A form's pages, questions, logic and settings are **always** read and written
together: the builder holds the whole thing and autosaves what changed, and a
respondent's screen renders all of it from one request. Nothing ever asks for
"question 4 of form 7" on its own.

Splitting them into `form_pages`, `form_questions`, `form_options` and
`form_logic_rules` would buy referential integrity between rows that are only
ever handled as a unit, and cost a five-table join on every read plus a
transaction on every keystroke-debounced save.

So: **`pages`, `questions`, `conditional_logic`, `audience` and `settings` are
JSON columns** (`jsonb` on Postgres, a subdocument on a document store). Their
shapes are `FormPage[]`, `FormQuestion[]`, `LogicRule[]`, `FormAudience` and
`FormSettings` from `@hamdastan/types`, which is the schema — validated by
`packages/validation/forms.ts` on the way in, on both sides.

The one thing this gives up is a foreign key between a rule and the question it
targets. The service compensates: deleting a question drops the rules that
mention it, and a rule pointing at a question that is gone simply never fires.

An answer is stored the same way, for the same reason: `answers` is
`FormAnswer[]`, and one response is read or written whole.

---

## 2. Form

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key. |
| `title` | string(160) | yes | 2–160 characters. |
| `description` | text | no | Up to 2000 characters. |
| `status` | enum | yes | `DRAFT` \| `PUBLISHED` \| `CLOSED`. **Not** the whole answer — see below. |
| `category` | enum | yes | `FEEDBACK` \| `SURVEY` \| `CHECKLIST` \| `REQUEST` \| `ASSESSMENT` \| `OTHER`. |
| `owner_id` | uuid | yes | `FK → AdminUser(id)`. The admin who created it. |
| `owner_username` | string(32) | yes | Denormalised. What the dashboard shows, because a username is what identifies an admin account. |
| `owner_name` | string(100) | yes | Denormalised too, for anywhere a person's name reads better. A stale copy is a cosmetic problem; a join on every row is not. |
| `pages` | json | yes | `FormPage[]`, at least one. |
| `questions` | json | yes | `FormQuestion[]`, up to 300. |
| `conditional_logic` | json | yes | `LogicRule[]`, up to 200. Empty by default. |
| `audience` | json | yes | `FormAudience`. Defaults to `{ mode: 'EVERYONE' }`. |
| `settings` | json | yes | `FormSettings` — welcome, thank-you, availability, responses, notifications. |
| `created_at` / `updated_at` | timestamp | yes | |
| `published_at` | timestamp | no | Set on the first publish and kept across later ones, so "since when has this been live" survives an unpublish. |

### Status is stored; answerability is computed

`status` says what an admin decided. Whether a form is **answerable right now**
is computed from it plus `settings.availability`:

```
PUBLISHED + alwaysAvailable                → answerable
PUBLISHED + today < publishAt              → not yet open
PUBLISHED + today > closeAt                → closed
```

Evaluated in `Asia/Tehran` (`shared/dates.ts`). Nothing has to run at midnight
to close a form, and no scheduled job can be the reason a form stayed open.

Whoever implements this must **not** add a trigger or a cron that rewrites
`status` from the dates — two sources of truth for the same question.

### Constraints and indexes

| | |
| --- | --- |
| `INDEX (status)` | The dashboard filters by it. |
| `INDEX (updated_at DESC)` | The default sort. |
| `INDEX (owner_id)` | "My forms", when that screen exists. |
| GIN on `questions` | Only if question-level search is ever needed. It is not today. |

Full-text search over `title` and `description` is the natural upgrade to the
`LIKE`-style search the stand-in does.

---

## 3. FormResponse

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key. |
| `form_id` | uuid | yes | `FK → Form(id)`, `ON DELETE CASCADE` — a response without its form is unreadable. |
| `respondent_id` | uuid | no | The product's user. **Null when the form collects answers anonymously**, even for a signed-in respondent: the setting is applied where the row is written, so an anonymous form cannot later be de-anonymised from its rows. |
| `respondent_name` | string(100) | no | Denormalised for the responses table. Null with `respondent_id`. |
| `status` | enum | yes | `COMPLETE` \| `PARTIAL`. Partial is somebody mid-way between pages. |
| `answers` | json | yes | `FormAnswer[]` — `{ questionId, value }`, where `value` is a string, number, string array or object keyed by matrix row. |
| `started_at` | timestamp | yes | |
| `submitted_at` | timestamp | no | Null while partial. |
| `completion_seconds` | int | no | Reported by the client, so it is a statistic and not an audit record. |

### Constraints and indexes

| | |
| --- | --- |
| `INDEX (form_id, submitted_at DESC)` | Every responses query starts here. |
| `UNIQUE (form_id, respondent_id) WHERE respondent_id IS NOT NULL` | Enforces «یک پاسخ برای هر کاربر» as a constraint rather than as a check-then-write race. Partial, because anonymous rows all have `NULL` and must not collide. |

That unique index is the one place the current stand-in is weaker than the
design: it looks the response up and then writes, which two devices could race.
A database should settle it.

### Retention

Responses are personal data as soon as a form is not anonymous. Nothing deletes
them today except deleting the form. Before this carries real answers, decide:
how long responses are kept, whether deleting a product user deletes theirs
(`ON DELETE SET NULL` versus `CASCADE`), and who may export.

---

## 4. FormTemplate

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string(64) | yes | Primary key. Stable and readable (`tpl-customer-satisfaction`), because the panel references it. |
| `title` / `description` | string | yes | |
| `category` | enum | yes | Same set as a form's. |
| `pages` / `questions` | json | yes | Same shapes as a form's. |

Templates are **copied, never referenced**: creating a form from one
regenerates every page, question and option id. Two forms from one template
therefore share no ids, which is what keeps their answers distinguishable, and
editing a template never changes a form somebody already built.

Seeded rather than authored today. A template editor would be the same builder
with the owner and audience fields hidden.

---

## 4.5 FormAsset

An image an author uploaded for a question's background.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key, and the whole public URL (`/api/v1/forms/assets/{id}`). |
| `form_id` | uuid | yes | `FK → Form(id)`, `ON DELETE CASCADE`. |
| `filename` | string(200) | yes | What the author called it. Display only. |
| `content_type` | string(64) | yes | One of the four allowed image types. |
| `bytes` | bytea / object key | yes | **The one field that should not stay in the database.** See below. |
| `created_at` | timestamp | yes | |

The stand-in keeps the bytes in memory, which is fine for a Map and wrong for a
database: images belong in an object store, and this row should hold its key
rather than its contents. `saveAsset` / `findAsset` on the port are the two
methods that change when one is chosen — nothing else moves.

A form references an asset **by URL inside a question's settings**, not by
foreign key, for the same reason the logic rules are JSON: the question document
is edited as a whole. Deleting a form takes its assets with it; an asset whose
question no longer mentions it is orphaned and wants the same sweep as a
partial response.

## 5. What is not modelled yet

- **Uploaded files.** `FILE_UPLOAD` stores a file *name*. Real uploads need an
  object store, a server-enforced size limit and a scanning policy, plus a
  `form_attachments` table keyed by response and question.
- **Answer history.** Editing a response overwrites it. If "what did they say
  before" matters, that is a fifth table, not a column.
- **Partial-response expiry.** A `PARTIAL` row lives forever. A sweep, or a TTL,
  belongs with the retention decision above.
- **Groups.** `audience.mode = 'GROUPS'` is designed and matches nobody,
  because the product has no group entity. It fails closed.
- **Per-question permissions.** Not a requirement, and a bad idea to add
  speculatively.

---

## Applying this later

Per `RULES.md`, no schema may be created or changed without being handed over
first. When a database is chosen:

1. write the migration from this document — three tables, five JSON columns;
2. hand it over for review and execution — it is not run from here;
3. implement `FormsRepository` against it, honouring the partial unique index
   and the cascade;
4. bind it in `apps/api/src/server.ts` and delete
   `createInMemoryFormsRepository` along with its sample data;
5. seed `form_templates` from `sampleTemplates()` in that file, which is where
   the six starting points are written today.

Nothing in `forms.service.ts`, `forms.controller.ts` or `forms.routes.ts` should
need to change. See `database/README.md`.
