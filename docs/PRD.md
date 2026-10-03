# Product Requirements Document — هم‌داستان

**Product:** هم‌داستان (Hamdastan)
**Version:** 1.0
**Last Updated:** 2026-09-29
**Status:** Active Development

---

## 1. Product Overview

هم‌داستان is a Persian-language **mobile web application (PWA)** for fans of
story worlds — books, films, series. People play, score points and compete
with other fans of the same world.

It is a mobile product wherever it is opened. On a laptop it is the same phone
screen, centred in a 430px column — never a dashboard. That is a product
decision, and it is enforced by `MobileShell` and by a Playwright test.

### 1.1 Target Users

- **The fan** — 13 to 80 years old, arrives on a phone, knows a story world
  well and wants to prove it. Signs in with a mobile number; there is no
  password anywhere in the product.
- **The operator** — runs content and moderation from `apps/admin`, a separate
  app with its own sign-in.

### 1.2 Core Value Proposition

- Play against the stories you already love, not against a generic quiz.
- Score, rank and compete with other fans of the same world.
- Nothing to install and nothing to remember: a phone number and a six-digit
  code, on a page that installs to the home screen if you want it to.

### 1.3 Language & Locale

- **Primary UI Language:** Persian (Farsi) — RTL layout throughout.
- **Locale:** `fa-IR`, Timezone: `Asia/Tehran`.
- Persian numerals for anything the user reads; Latin digits for anything the
  user types or the system stores (phone numbers, one-time codes).
- Dates are entered and displayed in the **Jalali** calendar and stored as
  Gregorian `date` — the conversion lives in `@hamdastan/shared/format/jalali`
  and happens in exactly two places.

---

## 2. System Architecture Summary

| Layer         | Technology                                       |
|---------------|--------------------------------------------------|
| Frontend      | Next.js 16 (App Router), React 19, Tailwind 4    |
| UI            | shadcn/ui on Radix, with local RTL wrappers      |
| Backend       | Fastify (`apps/api`), one-way layered modules    |
| Database      | PostgreSQL 17, no ORM — see RULES.md and database/ |
| Auth          | Phone + OTP, httpOnly cookie sessions in `apps/api` |
| SMS           | Kaveh-Negar (not yet connected) behind `SmsSender` |
| Deployment    | Docker Compose behind nginx, one host — see deploy/ |

The front-end calls `apps/api` and nothing else. See `docs/ARCHITECTURE.md`.

---

## 3. Domain Terminology

| Term | Meaning |
|------|---------|
| **World (دنیا)** | A story universe — a book series, a film franchise. |
| **OTP / کد تأیید** | The six-digit code that proves someone owns a number. |
| **Basic info (اطلاعات پایه)** | First name, last name, birth date, gender. Mandatory, collected once, immediately after the first successful verification. |
| **Onboarding (آنبوردینگ)** | The three stages that follow basic info and end in the person's avatar. The intro, stage 1 (interests) and stage 2 (the social questionnaire) are built. |
| **Social profile (پروفایل اجتماعی)** | What stage 2 derives from the questionnaire's raw answers: fourteen 1–10 dimensions, categorical outputs and role scores, under a `scoring_version`. Used for matching; the person sees only a simplified result card. |
| **Interest (علاقه‌مندی)** | One pickable interest, inside one of six categories. Identified by a stable English slug; the Persian label is display only. |
| **nextStep** | Where the server says this account goes: `basic_info`, `onboarding` or `home`. The client never computes it. |
| **MobileShell** | The 430px column every screen renders inside. |

---

## 4. Modules & Features

### 4.1 Authentication — ورود و ثبت‌نام

**Purpose:** get a person from first visit to a usable account, with no
password and no separate registration.

**Features:**

- One path for everybody. The screen never asks "sign in or sign up?" —
  the server answers that after the code verifies, and answering it earlier
  would leak which numbers have accounts.
- **The account is created at verification**, not at the end of the form. A
  person who abandons the profile form still has a verified number on file and
  returns to the same account.
- Six-digit code, valid two minutes, five attempts, resend after two minutes.
  Three sends per number and ten per IP in a ten-minute window.
- Only a hash of the code is stored, bound to the phone number it was issued
  for.
- Sessions are two `httpOnly` cookies: a 15-minute access token and a 30-day
  rolling refresh token that rotates on every use. Nothing in `localStorage`.
- Until Kaveh-Negar is connected, `OTP_DEBUG_DISPLAY=true` returns the code in
  the API response and shows it on the verification screen. Turning it off is
  the whole deployment step; no code changes with it.
- The basic-info screen has no back and no sign-out control: the account
  already exists, and the routing table returns an unfinished one to this
  screen, so there is nothing to leave to before the profile is complete.

**Not in this module:** the onboarding steps themselves, and the admin panel's
username/password sign-in.

### 4.2 Onboarding — ساخت دنیای من

Three stages between basic info and home, framed as building the person's
world and avatar rather than as a questionnaire. Built so far: the intro,
stage 1 and stage 2. Code lives in `apps/web/src/features/onboarding`.

**Intro — `/onboarding`.** «بیا دنیای تو رو بسازیم», what the stages are for,
and one action, «شروع ساخت دنیای من», to stage 1. The screen is black
(`--surface-stage`; the plain background in the light theme). The text is
top-aligned a fixed distance under the header, start-aligned (right, in RTL),
and descends in weight: bold title, body, then a quieter
line. It streams in in that order a word at a time — about two seconds in
all — and the action appears last; with reduced motion it is all there at
once. Under the text, an animated illustration (`onboarding-intro.webp`,
source in `assets/illustrations/`) arrives with the action; reduced motion
gets its first frame. The header has no control: the button is the only way on, and stage 1
has its own back to this screen.

**Stage 1, interests — `/onboarding/interests`.**

- «مرحله ۱ از ۳» over a progress bar, the title «به چه چیزهایی علاقه داری؟»,
  and a quiet line that every pick shapes the avatar.
- Six categories, each a card holding its interests as wrapping chips:
  موسیقی و اجرا، هنر و خلاقیت، آموزش و مهارت، تفریح و سبک زندگی،
  اجتماعی و کسب‌وکار، آنلاین. The catalog, with its ids, is
  `packages/config/app/onboarding.config.ts`, shared with `apps/api`.
- A chip toggles on tap. Selected is a brand tint, a brand border **and** a
  check mark, so it does not rely on colour; each chip is a stock
  `ToggleGroupItem` and announces `aria-pressed`.
- **The rule is breadth, not volume:** interests from at least **three
  different categories**. There is no maximum. Ten music picks and five
  sports picks is two categories and does not pass.
- The sticky footer shows «n از ۳ دسته انتخاب شده», then «عالیه! آماده‌ای
  بریم مرحله بعد» once the rule is met, above «ادامه», which is disabled
  until then. The status line is a polite live region.
- «ادامه» sends the selected interest ids to `PUT /me/onboarding/interests`.
  The API checks them against the same `interestsSchema` the button uses
  (every id in the catalog, three categories or more), derives each
  interest's category itself, replaces the saved set and marks stage 1
  finished. The page reads the saved set on the server, so coming back shows
  the earlier picks. A successful save goes on to stage 2.

**Stage 2, the social questionnaire — `/onboarding/questionnaire`.**

Twenty questions that must not feel like twenty: «بیا یکم بیشتر بشناسیمت»,
then four short chapters of one decision per screen. The screen never shows a
question count — only «داریم بیشتر می‌شناسیمت» over a continuous bar.

- **Journey.** Intro («حدود ۵ دقیقه», «شروع کنیم», «بعداً انجام می‌دم») →
  Section 1 *Social energy* (Q2, Q4, Q5, Q19, Q3) → reward (25%) → Section 2
  *Connection style* (Q6, Q7, Q18, Q20, Q1, then Q1's ranking) → reward
  (50%) → Section 3 *Experience style* (Q8, Q9, Q11, Q12, Q13) → reward
  (75%) → Section 4 *Group compatibility* (Q10, Q14, Q15, Q16, Q17) →
  «داریم پروفایلت رو می‌سازیم» → result → «تجربه‌های من رو ببین» → home.
- **Ids versus order.** Questions keep the source ids `Q1`–`Q20`; the order
  above is presentation only (`QUESTIONNAIRE_ORDER`). Nothing is scored by
  position. The questions, option codes and copy are
  `packages/config/app/questionnaire.config.ts`.
- **Interaction.** A single-choice tap saves, shows the selection for a beat,
  and advances on its own. Multi-select (Q3 ≤ 2, Q6 ≤ 3, Q20 ≤ 3, Q1 ≤ 3,
  Q15 any) enables «ادامه» at the first pick and disables the remaining
  options at the cap. A slider enables «ادامه» once it has been touched; 1 is
  at the reading start (right). Q1 with more than one pick is followed by a
  ranking screen of only those picks, reordered with buttons rather than a
  drag. A question screen holds the question and its answers and nothing else
  — no chapter name, no number; there is no separate chapter screen.
- **Intro motion.** On a first visit the intro's lines write themselves in a
  word at a time and its actions arrive once they have finished — the same
  `StreamedText`, at the same pace (`STREAM_PACE`), as the onboarding intro.
  Coming back to it from a question shows the text at once.
- **Look.** Calm and mostly neutral: the whole flow sits on `surface-stage`
  (near-black in the dark theme, white in the light one), like the onboarding
  intro. The accent is spent only on the selected answer (a soft border, a
  light tint and a check mark), the filled part of the 2px progress line, the
  primary action, the section mark's newest dot and the result's eyebrow.
  Questions use `ScreenTitle size="prompt"` (20px, semibold, relaxed leading);
  answers are regular weight. Content is top-aligned a fixed distance under
  the progress line, so every question sits in the same high place whatever
  the phone or the number of answers.
- **Sliders.** Two semantic end labels, a thin neutral track and a 24px
  thumb that turns to the accent once touched. The number appears only while
  dragging and for a moment after, above the thumb — rendered inside the
  thumb, so layout keeps it centred over it at every value; the parts are
  styled through the `Slider` primitive's `thumbClassName`, `trackClassName`
  and `rangeClassName`, never by reaching into its markup. Only the first slider
  (Q4) carries the hint «نقطه رو جابه‌جا کن و جایی بذار که بیشتر بهت
  نزدیکه.» The 1–10 values are unchanged.
- **Multi-select limits.** The helper states the limit («حداکثر ۳ مورد»);
  at the limit it reads «۳ مورد انتخاب شد» (a polite live region) and the
  remaining options fade and stop taking taps. No error.
- **Motion.** The outgoing screen fades and lifts (150ms), the next fades and
  rises in (200ms); the bar eases to its new width; a pressed answer scales to
  0.98. A single-choice tap reaches the next question in about 300ms. Section
  transitions draw the section mark — four dots on a line — filling the next
  dot (≈800ms). Nothing moves with reduced motion.
- **Section transitions.** After 1: «کم‌کم داریم می‌شناسیمت.» / «حالا
  ببینیم چطور با آدم‌ها ارتباط می‌گیری.» / «ادامه». After 2: «خوبه، نصف
  راه.» / «حالا بریم سراغ تجربه‌هایی که بیشتر باهات جورند.» / «ادامه». After
  3: «تقریباً کامل شد.» / «فقط چند انتخاب آخر مونده.» / «بریم بخش آخر».
- **Back and edit.** Back is always available and shows the stored answer
  selected. Every save rewrites the answer and rebuilds the whole profile
  from all stored answers, so an edited answer replaces its contribution
  instead of adding to it.
- **Autosave and resume.** Every answer is saved as it is given. Reopening
  the page — after a refresh or a closed tab — lands on the first unanswered
  question in presentation order; a finished questionnaire lands on its
  result.
- **Putting it off.** Only before starting: «بعداً انجام می‌دم» on the intro
  returns to the onboarding intro. Once the journey has begun there is no
  "later" action — the header holds back and nothing else.
- **Processing.** «داریم پروفایلت رو می‌سازیم» / «جواب‌هات رو کنار هم
  می‌ذاریم.» for as long as the request takes, held to 0.8s — no spinner; the
  section mark's last dot fills.
- **Result — meaning first, numbers last.** «پروفایل اجتماعی تو», a title
  and at most two sentences built from whichever of the person's dimensions
  are furthest from the middle of the scale (joined with «و», or «ولی» when
  they pull opposite ways). Then three plain-language insights, each the end
  of its label's sentence: «بیشتر انرژی می‌گیری از» (SE: آدم‌ها و تعامل /
  جمع‌های صمیمی و به‌اندازه / جمع‌های کوچیک و آروم), «توی تجربه‌ها دنبال»
  (NV: تازگی / تنوع / آشنایی, with AO: فعالیت / حس خوب جمع / گفتگو) and
  «توی گروه ترجیح می‌دی» (ST: برنامه‌ی مشخص / ساختار منعطف / تصمیم‌های
  لحظه‌ای), high ≥ 7, low ≤ 4. The five bars (انرژی اجتماعی، تجربه‌های
  تازه، گفتگو ↔ فعالیت، رقابت، برنامه‌ریزی ↔ بداهه) wait behind
  «جزئیات بیشتر». Then the value line «از این شناخت استفاده می‌کنیم تا
  آدم‌ها، گروه‌ها و تجربه‌هایی که بیشتر بهت می‌خورن رو پیشنهاد بدیم.» and
  «تجربه‌های من رو ببین». No internal codes and no diagnostic language. It
  is a simplification, built in `onboarding.result.ts`; the stored profile is
  never reduced to it.
- **Finishing.** `POST /me/onboarding/questionnaire/complete` refuses until
  all twenty are answered, then marks the questionnaire done and
  `onboarding_stage` 2. «تجربه‌های من رو ببین» calls `POST /me/onboarding/complete`,
  which now refuses before stage 2, and follows the `nextStep` it returns.
  Stage 3 is not built, so for now that is home.
- **Analytics.** `quiz_started`, `quiz_question_viewed`,
  `quiz_question_answered` (answer type, time spent, selection count),
  `quiz_back_clicked`, `quiz_section_completed`, `quiz_abandoned` (the intro's «بعداً»),
  `quiz_resumed`, `quiz_completed`, `quiz_result_viewed`,
  `quiz_result_continue_clicked`, sent to `POST /me/onboarding/events` and
  stored in `v2_onboarding_events`. Sending never blocks the flow. A tab
  closed mid-question sends nothing; the drop-off point is the last
  `quiz_question_viewed` without a matching answer.

**Scoring — `social-matching-v1`.** One pure function in `apps/api`
(`modules/onboarding/onboarding.scoring.ts`) from the raw answers to the
profile; the same answers always give the same profile, so a new version is
a recompute, not a re-ask.

| Question | Contribution |
|----------|--------------|
| Q1 | ranked motivations SOCIAL … MEMORABLE, 3 / 2 / 1 by rank |
| Q2 | SI / SE / Listening: 4/2/0, 2/2/1, 1/1/2, 0/0/4 |
| Q3 | +3 to each picked role |
| Q4, Q8, Q9, Q16, Q17 | SE, SP, AO, BP, PU = the slider value (not normalised again) |
| Q5 | WU 10 / 7 / 4 / 1 |
| Q6 | +3 to each picked conversation type; DEEP also CD +2, STORY CD +1 |
| Q7 | CD / Listening / Debate: 1/4/0, 2/0/0, 3/1/4, 1/2/−2 |
| Q10 | ST 9 / 6 / 2 |
| Q11 + Q12 | CP_base = slider; CO 10/8/5, CP_support 2/6/9; CP = 0.65·CP_base + 0.35·CP_support |
| Q13 | NV 2 / 6 / 10 |
| Q14 | FL 10 / 7 / 3 |
| Q15 | availability: morning / afternoon / evening / weekend booleans |
| Q18 | SO 2 / 6 / 8 |
| Q19 | preferred group size SMALL / MEDIUM / LARGE / XL |
| Q20 | conflict sensitivities (penalty triggers, not scores) |

Accumulated dimensions are normalised as `raw / max × 10` and held to 1–10.
Roles (Initiator, Facilitator, Energizer, Organizer, Listener, Analyst,
Ideator) are computed once every question is answered; all seven scores are
kept, the highest is primary, and the second is kept only at ≥ 70% of it.

*v1 choices where the brief was open* — change them in the scoring file and
bump the version:

- SE is Q4's slider alone. Q2's SE contribution is stored in the raw data
  but not mixed in, since SE is defined as the slider value.
- Maxima: SI 4 (Q2), CD 6 (Q6 3 + Q7 3), Listening 8 (Q2 4 + Q7 4),
  Debate 4 (Q7; its −2 floors at 0). A raw 0 is 1 on the 1–10 scale.
- Each role is the equal-weight mean of its signals on 0–10, a Q3 pick
  counting 10: Initiator (Q2 SI, Q3), Facilitator (Q3, CO, Listening),
  Energizer (Q3, SE, SP), Organizer (Q3, ST, PU), Listener (Q2 Listening,
  Q3, Q7 Listening), Analyst (Q3, Q6 depth, Debate), Ideator (Q3, NV,
  DEEP/INTEREST picked). Ties go to that order.

### 4.3 Home, Worlds, Play, Community, …

Skeletons. Each has a directory under `apps/web/src/features` and a module
under `apps/api/src/modules`, and each returns 501 until its repository is
bound. `/` renders a placeholder screen so the routing table has a real
destination.

---

## 5. User Flows

### 5.1 The routing table

Evaluated on **every** request by `apps/web/src/proxy.ts`, from the `nextStep`
that `GET /me` returns.

| State | Destination |
|-------|-------------|
| Not signed in | `/welcome` |
| Signed in, profile incomplete | `/auth/basic-info` |
| Signed in, onboarding unfinished | `/onboarding` and the pages under it |
| Signed in, everything complete | `/` |

An unfinished account is pinned to its step: it can be on that step's page,
or a page beneath it (the onboarding stages live under `/onboarding/`), and
nowhere else.
A finished one may go anywhere except back through `/welcome`, `/auth/*` —
or into `/onboarding/*`, which it has been through.

### 5.2 A new number

```
/welcome
  └─ «شروع کنیم»
     └─ /auth/phone ── POST /auth/otp/request ──┐
                                                 │  code sent (or echoed)
        /auth/verify?phone=09… ─────────────────┘
          └─ sixth digit auto-submits ── POST /auth/otp/verify
             │  the account is created here
             └─ nextStep = basic_info
                └─ /auth/basic-info ── PUT /me/basic-info
                   └─ nextStep = onboarding
                      └─ /onboarding
                         └─ /onboarding/interests ── PUT /me/onboarding/interests
                            └─ /onboarding/questionnaire
                               ├─ PUT …/questionnaire/answers/:questionId  (every answer)
                               ├─ POST …/questionnaire/complete
                               └─ POST /me/onboarding/complete
                                  └─ nextStep = home → /
```

### 5.3 A returning number

Identical up to verification. `nextStep` comes back as `home` (or
`onboarding`), and the profile form is never seen.

### 5.4 Sessions after the first visit

```
navigation → proxy.ts → GET /me ──ok──→ render
                          │
                          └─401──→ POST /auth/refresh ──ok──→ Set-Cookie, render
                                     │
                                     └─fail──→ cookies cleared, /welcome
```

Refreshing is done in `proxy.ts` because it is the only place in a Next app
that can set a cookie on the way to a page.

A screen that stays open — the questionnaire is one page of many steps —
outlives the fifteen-minute access token without navigating. Its calls go
from the browser, so `apps/web/src/services/api-client.ts` answers a 401 by
calling `POST /auth/refresh` once (the browser sends and receives the
`httpOnly` cookies itself) and sending the request again. Calls that fail
together share one refresh. If `apps/api` does not answer at all, `proxy.ts`
decides nothing and keeps the cookies rather than signing the visitor out.

---

## 6. Data Model

### 6.1 Entity Relationship Diagram

```
+-------------------+       +-------------------+       +----------------------+
|     v2_users      |--1:N--|    v2_sessions    |--1:N--|   v2_access_tokens   |
+-------------------+       +-------------------+       +----------------------+
         |                           |
         |                           +--1:N--+----------------------+
         |                                   |  v2_refresh_tokens   |
         |                                   +----------------------+
         |--1:N--+----------------------+
         |       |  v2_user_interests   |
         |       +----------------------+
         |--1:N--+--------------------------+
         |       | v2_questionnaire_answers |   raw answers — the source of truth
         |       +--------------------------+
         |--1:1--+--------------------------+
         |       |    v2_social_profiles    |   derived from the answers
         |       +--------------------------+
         |--1:N--+--------------------------+
         |       |   v2_onboarding_events   |   funnel analytics
         |       +--------------------------+
         |
   (by phone, not FK)
         |
+-------------------+       +-------------------+
| v2_otp_challenges |       |    v2_otp_sends   |
+-------------------+       +-------------------+
```

### 6.2 Key relationships and why they are shaped that way

- **`v2_users`** — one row per verified phone number. Every profile column is
  nullable, because a row exists from the moment a code verifies, which is
  before the product knows anything about the person. `onboarding_step`
  (`basic_info` → `onboarding` → `done`) is what says so.
- **`v2_users.onboarding_stage`** — the last onboarding stage finished,
  `0`–`3`. It only moves forward, so editing stage 1 again does not undo a
  later stage.
- **`v2_user_interests`** — one row per selected interest, keyed by
  `(user_id, interest_id)`. The catalog is not a table: it is
  `@hamdastan/config`, and the API refuses ids outside it. `category_id` is
  stored for querying and is always derived by the API, never taken from
  the client. Saving stage 1 replaces the whole set in one transaction.
- **`v2_otp_challenges`** — keyed by phone, so at most one live code per
  number: issuing a code replaces the row, which is what invalidates the last
  one. Stores `sha256(phone:code)` and never the code.
- **`v2_otp_sends`** — kept apart from the challenge because the challenge is
  overwritten on every send and the limits have to count sends it no longer
  remembers; and because one limit counts by IP, which is not a property of a
  phone number.
- **`v2_sessions`** — a sign-in as one long-lived thing. Tokens come and go
  inside it; revoking the session kills every token at once.
- **`v2_refresh_tokens`** — each is spent once. A spent token presented
  again more than `REFRESH_REUSE_GRACE_SECONDS` (30s) later is a replay, and
  the service revokes the whole session on it. Within that window it is one
  client racing itself — a navigation sends the page and its prefetches
  through `proxy.ts` at once, each refreshing with the same cookie — and it
  gets a fresh pair in the same session. Without the window, every expired
  access token ended the session on the next navigation.

- **`v2_questionnaire_answers`** — one row per `(user_id, question_id)`,
  holding the option codes (never labels) as `jsonb`, the presentation index
  it was shown at, and when it was first and last answered. An edit is an
  upsert, never a second row. This table is the source of truth.
- **`v2_social_profiles`** — one row per person: where to resume
  (`current_question_id`, `current_section`, `progress`), whether the
  questionnaire is finished, and everything derived — each answer's raw
  contribution, the raw totals, the internal signals, the fourteen dimensions
  as `numeric` columns (matching will query them), motivation profile,
  conversation preferences, group size, four availability booleans, conflict
  sensitivities, all role scores and the primary and secondary role. Rewritten
  whole, in the same transaction as the answer, on every save, under
  `scoring_version`. Editing after finishing recomputes the profile but does
  not un-finish it.
- **`v2_onboarding_events`** — append-only funnel events. The presentation
  index is filled in by the API from the question id.

The schema is `database/migrations/0001_users_profile_and_sessions.sql`,
`0002_user_interests.sql` and `0004_social_questionnaire.sql`.

---

## 7. API Endpoints

All under `/api/v1`. Every response is `ApiResponse<T>` from
`@hamdastan/types`.

| Method | Endpoint | Auth | Body | Returns |
|--------|----------|------|------|---------|
| POST | `/auth/otp/request` | — | `{ phone }` | `{ resendIn, debugCode? }`, or 429 with `retryAfter` |
| POST | `/auth/otp/verify` | — | `{ phone, code }` | `{ user, nextStep, isNew }` + session cookies |
| POST | `/auth/refresh` | refresh cookie | — | `{ user, nextStep }` + rotated cookies |
| POST | `/auth/logout` | refresh cookie | — | `{ loggedOut }`, cookies cleared |
| GET | `/me` | access cookie | — | `{ user, nextStep }` |
| PUT | `/me/basic-info` | access cookie | `{ firstName, lastName, birthDate, gender }` | `{ user, nextStep }` |
| POST | `/me/onboarding/complete` | access cookie | — | `{ user, nextStep }` |
| GET | `/me/onboarding/interests` | access cookie | — | `{ onboardingStage, selectedCategories, selectedInterests }` |
| PUT | `/me/onboarding/interests` | access cookie | `{ interestIds }` | `{ onboardingStage, selectedCategories, selectedInterests }` |
| GET | `/me/onboarding/questionnaire` | access cookie | — | `QuestionnaireState`: `{ answers, resumeQuestionId, progress, completed, result }` — `result` is `{ title, description, insights, dimensions }`; 403 before stage 1 |
| PUT | `/me/onboarding/questionnaire/answers/:questionId` | access cookie | `{ answer }` (shape per question) | `QuestionnaireState` |
| POST | `/me/onboarding/questionnaire/complete` | access cookie | — | `QuestionnaireState` with `result`; 400 until every question is answered |
| POST | `/me/onboarding/events` | access cookie | `{ event, questionId?, sectionId?, properties? }` | `null` |

`POST /me/onboarding/complete` answers 403 until stage 2 is finished.

`birthDate` is sent as Jalali parts (`{ year, month, day }`) and stored as a
Gregorian date.

Error codes the UI switches on: `OTP_RATE_LIMITED`, `OTP_NOT_FOUND`,
`OTP_EXPIRED`, `OTP_INVALID`, `OTP_LOCKED`, `VALIDATION_ERROR`,
`UNAUTHORIZED`.

### 7.1 Server Actions (RPC)

None. The sign-in flow is plain calls from `apps/web/src/services` to
`apps/api`, because the session cookies are set by the API and the browser
reaches it on the same origin.

---

## 8. Validation Rules

Written once in `packages/validation` (`auth.ts`, `onboarding.ts`, `questionnaire.ts`); the forms and the API parse
against the same objects, including the Persian messages.

| Field | Rule | Message |
|-------|------|---------|
| Mobile | `09…`, `9…`, `+98…`, `0098…` accepted; normalised to `09XXXXXXXXX` | «شماره موبایل معتبر نیست» |
| First name | 2–30 characters, Persian letters, space and ZWNJ | «نام رو به فارسی وارد کن» |
| Last name | 2–40, same rule | «نام خانوادگی رو به فارسی وارد کن» |
| Birth date | A real Jalali date; age 13–80 | «تاریخ تولد رو کامل انتخاب کن» |
| Gender | `male` / `female` / `other` | «یکی از گزینه‌ها رو انتخاب کن» |
| OTP | Exactly 6 digits | «کد اشتباهه، دوباره امتحان کن» |
| Interests | Every id in the catalog; duplicates dropped; at least 3 categories (`packages/validation/onboarding.ts`) | «حداقل از ۳ دسته انتخاب کن» |
| Questionnaire answer | Shape by question: one option code, a list of codes (≥ 1, no repeats, within the cap), a ranked list, or an integer 1–10 (`packages/validation/questionnaire.ts`) | «یک گزینه رو انتخاب کن» / «حداکثر n مورد می‌تونی انتخاب کنی» |

The mobile field itself accepts digits only, eleven at most: letters and
symbols are dropped as they are typed, and a full number pasted in any accepted
form is normalised to `09XXXXXXXXX` rather than truncated.

Every field is normalised before it is validated: Persian and Arabic-Indic
digits become `0-9`, Arabic ي/ك become Persian ی/ک, and leading and trailing
whitespace is dropped.

---

## 9. UI Component System

### 9.1 Design tokens

| Token | Value |
|-------|-------|
| Brand | `--brand-hue: 270`, `--brand-saturation: 70%` (violet) |
| Background (dark) | `hsl(265 24% 9%)` — tinted toward the brand, not neutral grey |
| Font | Yekan Bakh (variable), loaded with `next/font/local` |
| Radius | `--radius: 0.75rem` |
| Column width | `--shell-max-width: 430px`, as `max-w-shell` and the `shell:` breakpoint |
| Theme | Dark, as a `.dark` class on `<html>` |
| Layout | RTL |

Colours are derived from the two brand variables at the top of
`packages/ui/tokens/tokens.css`. Nothing in a screen names a colour.

### 9.2 Rules for a screen

- Components come from `@hamdastan/ui` (shadcn/ui), and where shadcn has a
  component it is the one used — no hand-written stand-ins. No screen imports
  Radix.
- **No `sm:`, `md:`, `lg:` or `xl:` inside a page**, and no width cap either:
  the only breakpoint in the app is in `MobileShell`, and it is the only thing
  that decides how wide anything is. At 1440, 1920 or 2560 the product is the
  same 430px column, centred — never a dashboard.
- Primary buttons and form controls are 48px tall (`Button size="xl"`); the
  page gutter is 20px. Every control a finger reaches for clears 44px,
  including the back and sign-out controls in a header.
- A disabled primary button drops to the muted surface rather than fading the
  brand fill — a 50%-opacity violet button with a washed-out label reads as
  enabled-but-broken instead of not-yet.
- A form's primary button stays disabled until every required field is
  filled and valid — on the phone screen and on basic info alike.
- Each screen has one `h1`, rendered by `ScreenTitle`. A screen whose content
  does not fill the column centres it (`ScreenBody center`) rather than
  leaving a void above the action bar.
- The dark surface is lit by one ambient brand gradient at the top of the
  column (`--gradient-shell-glow`), drawn by `MobileShell`. The one exception
  is a screen built around a single piece of artwork, which sits on
  `--surface-stage` (black) instead — the onboarding intro. Screens do not add
  their own; `--gradient-hero-glow` is the halo for a piece of artwork.
- Motion is `tailwindcss-animate`'s fade and slide, 150–300ms, plus one shake
  on a wrong code. Everything honours `prefers-reduced-motion`.
- A sticky footer holds the primary action, inside the column and clear of the
  iOS home indicator.

### 9.3 PWA

`display: standalone`, `theme_color` matching the background, icons at 192 and
512 plus a maskable 512, `viewport-fit=cover` with `env(safe-area-inset-*)`
padding.

---

## 10. Non-Functional Requirements

- **Security:** no password anywhere in the product; codes and tokens stored
  only as SHA-256; session cookies `httpOnly`, `SameSite=Lax`, `Secure` in
  production; rate limits per number and per address; a replayed refresh token
  revokes its session.
- **Accessibility:** every colour pair clears 4.5:1; errors are announced as
  well as coloured; touch targets are at least 44px; zoom is not disabled.
- **Performance:** one `GET /me` per navigation, not per component; the
  Welcome screen is a server component and ships no JavaScript of its own.
- **Reliability:** an unreachable database is a boot failure in production and
  a warning in development; an unbound repository answers 501 rather than
  faking data.

---

## 11. Roadmap

| Feature | Priority | Notes |
|---------|----------|-------|
| Connect Kaveh-Negar | High | Adapter written; set `SMS_PROVIDER=kavenegar` and turn `OTP_DEBUG_DISPLAY` off |
| Final Welcome artwork | Done | Animated WebP at `apps/web/public/images/brand/welcome-hero.webp` (source in `assets/illustrations/`), with a still first frame for reduced motion |
| Onboarding stage 3 (avatar) | High | Intro, stage 1 (interests) and stage 2 (questionnaire) are built; the result screen goes home until stage 3 exists |
| Matching on the social profile | High | The profile, roles, availability and conflict sensitivities are stored; nothing reads them yet |
| Confirm questionnaire scoring v1 | High | Check the v1 choices in §4.2 against the scoring spec; bump `social-matching-v1` if they change |
| Home screen | High | `/` is a placeholder |
| Worlds, play, community, commerce | Medium | Module skeletons exist on both sides |
| Move admin sign-in into `apps/api` | Medium | `apps/admin` still has its own story |
