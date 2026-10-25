# Product Requirements Document — هم‌داستان

**Product:** هم‌داستان (Hamdastan)
**Version:** 1.0
**Last Updated:** 2026-10-20
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
  app. Signs in with a mobile number and a one-time code like the fan, but only
  if another admin has already added that number (§4.6). Designs and publishes
  surveys, missions, assessments and multi-day journeys in Engagement Studio
  (§4.7), from images and motions kept in the media library (§4.8).

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
| Gateway       | nginx: TLS, edge rate limits, request ids, body and time limits (§10) |

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
| **nextStep** | Where the server says this account goes: `basic_info`, `username`, `onboarding` or `home`. The client never computes it. |
| **XP** | Experience points, earned by finishing missions and Engagement Studio activities. The total is the sum of the person's XP ledger (a revocation is a negative row); nothing else stores it. |
| **Level (سطح)** | A band of XP: 1 from 0, 2 from 100, 3 from 250, 4 from 500, 5 from 1000 (`LEVEL_THRESHOLDS`). Derived, never stored. |
| **Mission (ماموریت)** | One thing worth doing, with an XP reward. A mission is finished exactly when the ledger holds its reward. |
| **Badge (نشان)** | A mark of achievement, earned once every mission it requires is finished. Derived, never stored. |
| **Activity (فعالیت)** | A survey (نظرسنجی), mission (مأموریت), assessment (آزمون), multi-day journey (چالش چندروزه) or competition (مسابقه) designed in Engagement Studio (§4.7). |
| **Activity version** | An activity's questions and scoring/XP settings, frozen. Editing a published or answered activity makes a new version; responses and rewards point at the one they belong to. |
| **Participation** | One person's progress on one activity: saved draft, how many times they submitted and were rewarded. |
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
- **The account starts with a username** — `user` and eight random digits
  (`user04817263`), drawn by the API when the row is created; the unique index
  decides, and a clash draws again. An account created before this gets one
  the first time `GET /me/account` loads it. It is the person's to change in
  «ویرایش پروفایل».
- **Sign-up asks for the username right after basic info** (`/auth/username`,
  `nextStep = username`). The screen explains that this is the name they are
  known by in the app and can change later from the profile; the field starts
  with the generated name, so «ادامه» works at once and keeping it is a valid
  answer. While they type, a name that passes `usernameSchema` is checked
  against everyone else's (`GET /me/username/availability`, 400 ms after the
  last keystroke): «در حال بررسی…», then «این نام کاربری آزاده» in green or
  the taken message under the field, which also disables «ادامه». Their own
  name counts as free, and a failed check shows nothing. The check is only a
  hint — `PUT /me/username` validates with the same `usernameSchema` as the
  profile (a taken name is a 409 shown under the field, in the same words) and sets
  `v2_users.username_confirmed_at` — null is what keeps the account on this
  step. Accounts already past basic info when it shipped were backfilled as
  answered (`0022`). Like the basic-info screen, it has no back.
- Six-digit code, valid two minutes, five attempts, resend after two minutes.
  Three sends per number and ten per IP in a ten-minute window.
- **Five wrong codes per number in fifteen minutes, across codes**, lock the
  number (`429 OTP_LOCKED` with `retryAfter`): asking for a fresh code does
  not reset the count, and no code is sent while it is locked. A correct
  code clears it. The address is also capped at 30 verifications in fifteen
  minutes (`OTP_MAX_FAILURES`, `OTP_FAILURE_WINDOW_SECONDS`,
  `RATE_LIMIT_OTP_VERIFY_PER_15_MINUTES`).
- Only a hash of the code is stored, bound to the phone number it was issued
  for.
- Sessions are two `httpOnly` cookies: a 15-minute access token and a
  refresh token that rotates on every use. The refresh token lives **seven
  days from its last use** (the idle timeout) and never past **thirty days
  from sign-in** (the absolute timeout). Nothing in `localStorage`. Sessions
  that predate the absolute rule get their thirty days from their first
  refresh after it shipped, so nobody was signed out by it.
- Logging out revokes the session; its access token stops working on the
  next request, not when it expires.
- **The code is never shown on screen**, in the product or the admin panel.
  In development `OTP_DEBUG_DISPLAY=true` returns it in the API response
  (`debugCode`, which the end-to-end tests read) and the console sender writes
  it to the API's log. **Production fails
  closed:** the echo is ignored, the console sender is never bound, and
  without `SMS_PROVIDER=kavenegar` asking for a code — product or admin —
  answers `503 SMS_UNAVAILABLE` before anything is stored. No code is ever
  returned or logged in production. Connecting Kaveh-Negar is
  `SMS_PROVIDER=kavenegar`; no code changes with it.
- The phone screen has no back control: it is the start of sign-in, and the
  device's own back is enough to leave it.
- The basic-info screen has no back and no sign-out control: the account
  already exists, and the routing table returns an unfinished one to this
  screen, so there is nothing to leave to before the profile is complete.

**Not in this module:** the onboarding steps themselves, and the admin panel's
sign-in (§4.6), which reuses these codes but opens no product account.

### 4.2 Onboarding — ساخت دنیای من

Three stages between basic info and home, framed as building the person's
world and avatar rather than as a questionnaire. Built so far: the intro,
stage 1 and stage 2. Code lives in `apps/web/src/features/onboarding`.

**Intro — `/onboarding`.** «بیا دنیای تو رو بسازیم», what the stages are for,
and one action, «شروع ساخت دنیای من», to stage 1. The screen is black
(`--surface-stage`; the plain background in the light theme). The text is
top-aligned under the header with the questionnaire intro's spacing,
start-aligned (right, in RTL),
and descends in weight: bold title, body, then a quieter
line. It streams in in that order a word at a time — about two seconds in
all — and the action appears last; with reduced motion it is all there at
once. Under the text, the owl fitting two puzzle pieces together
(`onboarding-intro.webp`, source in `assets/illustrations/`) arrives with the
action — a still image. It is prepared
and shown exactly like the questionnaire's owls (see *Artwork* under Stage 2
below; `StageArtwork`), centred between the text and the footer, so
it reads as part of the stage rather than a clip on it. The
header has no control: the button is the only way on, and stage 1
has its own back to this screen.

**Stage 1, interests — `/onboarding/interests`.**

- The title «به چه چیزهایی علاقه داری؟» (no step counter or progress bar),
  and a quiet line that every pick shapes the avatar.
- The categories and their interests are data, edited from the admin panel
  («آنبوردینگ», §4.6): `v2_interest_categories` and `v2_interests` (0023),
  seeded with the original six — موسیقی و اجرا، هنر و خلاقیت، آموزش و مهارت،
  تفریح و سبک زندگی، اجتماعی و کسب‌وکار، آنلاین. `GET /me/onboarding/interests`
  serves the catalog (categories with no interests left out) with the
  person's picks; the page reads it on the server. The rule
  (`interestSelectionError` in `@hamdastan/validation`) takes the catalog as
  an argument, so the button and the API still judge the same way.
- Each category is a card in a shadcn `Accordion` (`type="single"`). All
  start collapsed, so the screen opens on six cards and no chips; tapping a
  card opens it and closes whichever was open. Which row is open is view
  state only — collapsing never touches the picks.
- Each category is a card (radius 16px, 20px × 24px padding, 8px apart).
  Its header runs, from the start edge: a shadcn `Checkbox`, the title
  (18px bold), «n انتخاب» once something is picked, an X, and the chevron
  at the end edge. A category is **selected when at least one of its
  interests is** (that is what the three-category rule counts); the
  checkbox mirrors it, and a selected card takes a brand border. Ticking an
  empty checkbox opens that card to pick from; unticking it, or the X
  (44px target, 12px before the chevron), clears that category's picks and
  collapses it.
- Open, the same card grows: 20px under the header, the interests follow as
  40px pills, 8px apart, that wrap. A chip toggles on tap. Unselected is
  outlined; selected is filled with the brand colour (a fill, not just a
  tint, so it does not rely on hue). Each chip is a stock `ToggleGroupItem`
  and announces `aria-pressed`.
- **Brand exception:** on this screen the checkbox, the selected chips and
  the selected card's border use the brand violet — a product decision for
  the interest picker, against the general rule that violet is for the
  primary action only.
- **The rule is breadth, not volume:** interests from at least **three
  different categories**. There is no maximum. Ten music picks and five
  sports picks is two categories and does not pass.
- The sticky footer shows «n از ۳ دسته انتخاب شده», then «عالیه! حالا می‌تونی
  بری مرحله‌ی بعد» (in the success green) once the rule is met, above
  «ادامه», which is disabled until then. The status line is a polite live
  region.
- «ادامه» sends the selected interest ids to `PUT /me/onboarding/interests`.
  The API checks them against the same `interestsSchema` the button uses
  (every id in the catalog, three categories or more), derives each
  interest's category itself, replaces the saved set and marks stage 1
  finished. The page reads the saved set on the server, so coming back shows
  the earlier picks. A successful save goes on to stage 2.

**Stage 2, the social questionnaire — `/onboarding/questionnaire`.**

Twenty questions that must not feel like twenty: «ترجیحاتت رو بهتر بشناسیم»,
then four short chapters of one decision per screen. The screen never shows a
question count — only «داریم بیشتر می‌شناسیمت» over a continuous bar.

- **Journey.** Intro («حدود ۵ دقیقه», «شروع کنیم», «بعداً انجام می‌دم») →
  Section 1 *Social energy* (Q2, Q4, Q5, Q19, Q3) → reward (25%) → Section 2
  *Connection style* (Q6, Q7, Q18, Q20, Q1, then Q1's ranking) → reward
  (50%) → Section 3 *Experience style* (Q8, Q9, Q11, Q12, Q13) → reward
  (75%) → Section 4 *Group compatibility* (Q10, Q14, Q15, Q16, Q17) →
  the detective owl → result → «ورود به اپلیکیشن» → home.
- **Ids versus order.** The questions are data, edited from the admin panel
  (`v2_questionnaire_questions`, 0023), in presentation order — section, then
  position — and `GET /me/onboarding/questionnaire` serves them with the
  answers. The journey above is the seeded questionnaire. The twenty seeded
  questions keep the source ids `Q1`–`Q20` and are **scored**: the scoring
  engine reads them by id (`SCORED_QUESTION_IDS`), so the panel may reword
  and move them but not change their kind, cap or option codes, nor delete
  them. A question added from the panel gets a generated id, is asked in its
  section and its answer is stored — but it is not scored. Nothing is scored
  by position. Option codes never change once a question exists; only labels
  do. Any ranked question gets the ranking screen when more than one option
  is picked; a section's questions share its quarter of the progress bar.
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
- **Artwork.** An owl sits under the text of the intro
  (`questionnaire-intro.webp`), of the onboarding intro
  (`onboarding-intro.webp`), and of every chapter reward: Section 1 and
  Section 2 share `questionnaire-section-1.webp`, Section 3 has
  `questionnaire-section-2.webp` (the tired owl). The onboarding intro and
  Section 3 are stills; the intro (the owl in flight) and Sections 1–2 (the
  owl painting) are animated. The files live in
  `apps/web/public/images/brand/` (sources in `assets/illustrations/`) and
  are all prepared the same way — 720×491, the subject centred in the
  frame (a still's asymmetric margins would shift it off the column's
  centre line) and kept clear of the
  edges in every frame, the artwork's grey backdrop and its vignette lifted
  to white (a master drawn on transparency stays transparent, so it sits on
  the stage in both themes), with a `-still.webp` first frame.
  On screen it is centred in the space between the text and the footer, so
  every owl lands in the same place at the same scale whatever the text
  above it. It belongs to the stage rather than playing on it: no frame or
  corners, the edges fade out over the clear margin without reaching the
  subject, and it fades in (on the intro, with the actions). Reduced
  motion gets the still. One component, `StageArtwork`, renders them all.
- **Look.** Calm and mostly neutral: the whole flow sits on `surface-stage`
  (near-black in the dark theme, white in the light one), like the onboarding
  intro. The accent is spent only on the selected answer (a soft border, a
  light tint and a check mark), the filled part of the 2px progress line, the
  primary action and the section mark's newest dot.
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
  finishes onboarding (`POST /me/onboarding/complete`, allowed once stage 1
  is saved) and goes home, where the questionnaire waits as a mission. Once
  the journey has begun there is no "later" action — the header holds back
  and nothing else. The intro's back goes to the interests during
  onboarding and home after it.
- **Processing.** The animated detective owl (`OwlLoader`, the same one
  that opens `/profile/social`) over the whole screen, on white in both
  themes — no text, no spinner. It stays for at least 5 seconds (half of
  its 10-second loop) and until the request has returned, looping while it waits; then it fades
  and the result enters. Reopening a finished result does not replay it.
- **Result — meaning first, numbers last.** A social-profile report, made to
  be shared, in this order:
  1. **Hero.** The character for the person's primary role, picked by the
     gender from basic info — fourteen illustrations, one per role
     (Initiator «یخ‌شکن جمع», Facilitator «میزبان جمع», Energizer
     «انرژی‌بخش جمع», Organizer «هماهنگ‌کننده», Listener «شنونده», Analyst
     «تحلیل‌گر», Ideator «ایده‌پرداز») and gender — full-body on a white
     4:5 tile (`--avatar-backdrop`, white in both themes because the art is
     drawn on white), captioned «نقشت توی جمع: …». Without a gender on file
     there is no character and a shadcn `Avatar` holds the neutral
     silhouette (`PersonSilhouette`) instead. Then
     «پروفایل اجتماعی تو» / «پروفایل اجتماعی من» (an
     outline badge, not the accent), the title and at most two sentences
     built from whichever of the person's dimensions are furthest from the
     middle of the scale (joined with «و», or «ولی» when they pull opposite
     ways).
  2. **Three insights in one card**, stacked as rows split by hairlines,
     each a small icon in a neutral circle, a muted label and under it a
     bold value that ends the label's sentence: «بیشتر انرژی می‌گیری
     از» (SE: آدم‌ها و تعامل / جمع‌های صمیمی و به‌اندازه / جمع‌های کوچیک و
     آروم), «توی تجربه‌ها دنبال» (NV: تازگی / تنوع / آشنایی, with AO: فعالیت
     / حس خوب جمع / گفتگو) and «توی گروه ترجیح می‌دی» (ST: برنامه‌ی مشخص /
     ساختار منعطف / تصمیم‌های لحظه‌ای), high ≥ 7, low ≤ 4.
  3. **«دنیای مورد علاقه تو».** The interests picked in stage 1, a card per
     category in catalog order, each interest a secondary badge (an id no
     longer in the catalog is dropped). Left out when there are none.
  4. **«DNA اجتماعی تو»**, always open — nothing in the report waits behind
     a tap: seven axes (انرژی اجتماعی، تجربه‌های تازه، گفتگو،
     فعالیت، رقابت، برنامه‌ریزی، بداهه) as a neutral radar chart (shadcn
     `Chart`) with the exact value of every axis under it — the list is what
     screen readers read. The two two-ended scales get one axis per end:
     فعالیت = AO, گفتگو = 11 − AO, برنامه‌ریزی = ST, بداهه = 11 − ST.
  5. **«این یعنی چی؟».** `summary`: the same readings as one short paragraph
     (SE, then NV/AO, ST, and CP only when ≥ 7 or ≤ 4), closing with «پس
     جمع‌هایی که همین حال‌وهوا رو دارن، احتمالاً بیشتر از همه بهت
     می‌چسبن.» Set justified, the last line at the start edge.

  Then the value line «از این شناخت استفاده می‌کنیم تا آدم‌ها، گروه‌ها و
  تجربه‌هایی که بیشتر بهت می‌خورن رو پیشنهاد بدیم.» and, at the end of the
  questionnaire, «ورود به اپلیکیشن». The brand colour is that button's
  alone. No internal codes and no diagnostic language. It is a
  simplification, built in `onboarding.result.ts`; the stored profile is
  never reduced to it.
- **Finishing.** `POST /me/onboarding/questionnaire/complete` refuses until
  all twenty are answered, then marks the questionnaire done and
  `onboarding_stage` 2, and grants the personality-test mission's +50 XP —
  once: the response's `xpAwarded` is 50 on the call that granted it and 0
  on every later one. When it is 50 the action carries the reward —
  «ورود به اپلیکیشن +۵۰ XP»; on a later visit it is the plain label. It calls
  `POST /me/onboarding/complete`, which refuses before stage 1, and follows
  the `nextStep` it returns — home.
- **Later.** An account past onboarding can still open
  `/onboarding/questionnaire` (the one onboarding page the routing table
  lets it reach) until the questionnaire is finished; after that the page
  redirects to `/profile/social`.
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
The primary role is the only one the person sees: it picks the result
card's character (see the result, above).

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

### 4.3 Home — خانه

`/`. The worlds are not open yet, so home carries the person's next step.
The header is their avatar (see «Where the avatar comes from», §4.4) and
`@username` (their display name only if an older account has none), linking
to the profile — no greeting line — and at the other end the bell to the
Notification Center with the unread count (§4.11); the bottom nav holds خانه, رویدادها and پروفایل. Signing out is not on home.

- First, always, «جهان‌های هم‌داستان» — it stays at the top whatever is added below it: one row (shadcn `Item`, outlined, never violet) — «دنیای داستانی‌ات رو انتخاب کن» under the title, the number of worlds and the forward chevron — that opens a bottom sheet of every published world, in the admin's order (§4.10), each a banner linking to `/worlds/:slug` — its cover, or for the four seeded worlds (Hogwarts, GTA, Game of Thrones, Liverpool) the artwork they shipped with, or a plain tile with its name — and «بستن». Absent when no world is published; home never fails because of it.
- **Questionnaire not done:** right below the worlds row, a card —
  «یه قدم مونده تا بیشتر بشناسیمت», «آزمون کوتاهت رو کامل کن تا تجربه‌ها و
  آدم‌های مناسب‌تری برات پیدا کنیم.», «حدود ۵ دقیقه», «+50 XP» and
  «شروع آزمون», the screen's one primary action.
- **Done:** the card is gone; nothing on home stands in for it — the
  result lives in the profile («دیدن نتیجه‌ی کامل» → `/profile/social`).
- Then «رویدادهای پیش‌رو» (§4.9): up to three events the person can still
  attend — not ended, not cancelled, not sold out — side by side in a
  carousel of discovery's card (the next one peeking in), each a whole-card
  link, and «همه» → `/events`. Absent when there are none; home never fails
  because of it.
- Then «فعالیت‌ها» (§4.7): up to three activities the person can do now or is
  waiting on, open ones first, side by side in a carousel like the events
  above (the next one peeking in, a lone one full width), each a whole-card
  link (no button inside, so the screen keeps one primary action), and «همه»
  → `/activities`. The section is
  absent when there is nothing to do, and home never fails because of it — if
  the activities cannot be read, there are none.

### 4.4 Account — حساب من

The person's identity hub: "my identity, my achievements, my profile" —
not a settings page, not a game dashboard. Code in
`apps/web/src/features/profile` and `apps/api/src/modules/account`.

**Profile home — `/profile`.** One card (shadcn `Card`) per group, top to
bottom:

1. **Identity.** The avatar, large, with a small amber spark: the role
   character full-body with no frame, on a stage the same white as the art
   (`--avatar-backdrop`); or, before the questionnaire (or once it is
   skipped), a neutral grey silhouette filling a soft disc. Not a link — there is no avatar
   screen. The display name is the screen's `h1` for screen readers only;
   the name, username and edit buttons are not shown here.
2. **«نشان‌های من».** A card of its own under the avatar: the count, and
   the earned badges in a three-column grid — a neutral circle with the
   badge's icon and its title («با انجام ماموریت‌ها، نشان‌هات اینجا جمع
   می‌شن.» when there are none).
3. **«پروفایل اجتماعی من».** A list group like «حساب» with one row,
   «مشاهده نتیجه کامل» (→ `/profile/social`, the full social-profile report
   described under stage 2's result); the result's title, description and
   insights are not repeated on the hub. Opening `/profile/social` shows the
   animated detective owl (`OwlLoader`, `owl-detective.webp`, a 10-second
   loop) over the whole screen, on white in both themes so it reads as the
   screen rather than a clip. The result is not shown until 5 seconds have
   passed *and* the result has loaded; the owl keeps looping while it waits. Before the questionnaire is done: a
   mission card instead — «پروفایلت هنوز کامل نیست», «آزمون کوتاه شخصیت رو
   کامل کن تا پیشنهادهای دقیق‌تری برات داشته باشیم.», «حدود ۵ دقیقه»,
   «+50 XP», «شروع آزمون».
4. **«حساب».** «ویرایش پروفایل» (→ `/profile/edit`), «تنظیمات» and
   «راهنما و پشتیبانی».

The hub no longer lists missions or shows XP and level: what the person has
achieved is shown as badges. Missions and the XP ledger still run behind
them (they decide which badges are earned and which avatar items unlock).

**One primary action.** While the questionnaire is open, its «شروع آزمون»
is the violet button. Everything else on the screen is neutral.

**Missions and XP (MVP).**

| Mission | Reward | Done when | Action |
|---------|--------|-----------|--------|
| آزمون شخصیت | +50 | the questionnaire is finished | `/onboarding/questionnaire` |
| ساخت آواتار | +20 | an avatar is saved | — (no avatar screen; earned before it was removed) |
| تکمیل پروفایل | +20 | a username and a city are both set (the bio is optional) | `/profile/edit` |

The catalog is `MISSIONS` in `@hamdastan/config`. Every mission is available
from the start; `locked` and `in_progress` are part of the contract and
unused. A reward is granted by the action that earns it, never by a read,
and at most once — the ledger's unique key decides, so two requests racing
cannot both pay. Clearing a field later does not take XP back.

**Badges (MVP).**

| Badge | Icon | Earned when |
|-------|------|-------------|
| خودشناس | sparkles | آزمون شخصیت is done |
| خوش‌استایل | palette | ساخت آواتار is done |
| معرفی‌شده | id-card | تکمیل پروفایل is done |

The catalog is `BADGES` in `@hamdastan/config`: id, title, description, an
icon key from `BADGE_ICONS`, and the missions it `requires`. A badge has no
table — it is read off the missions, so a new one reaches everyone who
already qualifies, and adding one is a catalog entry (plus one line in
`apps/web`'s icon map if it brings a new icon key). Badges for the tasks
and missions inside a world follow the same rule: once those missions are in
`MISSIONS`, a badge that `requires` them is all it takes. Only earned badges
are sent, in catalog order, dated by their last mission.

**Reward feedback.** A save that earns XP says so in its toast — «آواتارت
ذخیره شد — n XP گرفتی» for the avatar, «پروفایلت کامل شد — n XP گرفتی» for
a profile field. No confetti.

**Where the avatar comes from.** Once the questionnaire is finished, the
person's avatar is their role character — the result's `role.avatarId`,
the illustration for their primary role and gender (§4.2's result). One
640×800 file per character, shown through `RoleCharacter` in two frames:
`portrait` (the head, cropped from the file, in the home header's 40px
circle) and `full` (the whole figure: the result hero and the identity
card). Always on `--avatar-backdrop`, because the art is drawn on white.
Before the questionnaire, after skipping it, or without a gender on file,
nobody is given a made-up avatar: a neutral head-and-shoulders silhouette
(`PersonSilhouette`, `apps/web/src/components/artwork`, muted grey on
`secondary`) stands in, in all three places.

There is no avatar screen. The character's clothes are part of the
illustration, so the earlier dress-up studio (`/profile/avatar`) is gone,
with its «ظاهر» row in edit profile, and the drawn SVG avatar
(`AvatarFigure`) with it. `PUT /me/avatar` and `avatar_config` remain in
the API, unused by the app. XP and badges already earned stay;
missions are no longer listed on the profile.

**Edit profile — `/profile/edit`.** Opened from «حساب» on the profile
home; its back button returns there. A list, not a form: «اطلاعات اصلی» (نام,
نام کاربری, شهر), «درباره من · اختیاری» (بیو) and «شبکه‌های اجتماعی ·
اختیاری» (اینستاگرام, تلگرام, لینکدین — each shown as `@handle`). Each row
opens a bottom sheet with that one field, a line of help, «ذخیره تغییرات»
(primary) and «انصراف». A taken username is shown under the field. First
and last name, birth date and gender were given at sign-up and are not
edited here. A social field takes a handle or a pasted profile link; only
the handle is kept (lower case, no `@`), so a stored value can only point
at its own network, and an empty value clears it. Social handles do not
count towards «تکمیل پروفایل». Profile image and email are not collected:
the avatar is the person's image, and nothing in the product uses email.

**Settings — `/profile/settings`.** «ظاهر»
(حالت تاریک — a switch; per device, kept in the browser by the theme store,
not on the account), «اعلان‌ها» (a row to `/profile/settings/notifications`,
§4.11), «حریم خصوصی» (نمایش پروفایل اجتماعی به
دیگران — a switch), «پشتیبانی» (راهنما و پشتیبانی → `/profile/help`), then,
set apart, «خروج از حساب» in red text. An account switch saves when flipped
and flips back if the save fails. A switch's "on" is the brand violet. The
privacy setting is stored; nothing reads it yet, because other people's views
do not exist. The old «ماموریت‌ها و پیشرفت» switch is gone: its stored
`settings.notifications` is no longer read, and migration `0019` carried an
«off» over to the activity and achievement categories.

**Logout.** Only in settings. It asks: «از حساب خارج می‌شی؟» / «هر وقت خواستی
می‌تونی دوباره وارد بشی.» / «خروج» (destructive red) / «انصراف», in a
right-aligned dialog with the two buttons stacked full width.

**Help — `/profile/help`.** Four short answers: XP, levels, the social
profile, and who sees it.

### 4.5 Worlds, Play, Community, …

Worlds are managed as a CMS (§4.10): lifecycle, identity, menu, home page,
and the news, knowledge articles, events and activities filed under them.
Membership and following are not built. Play, community and the rest are
skeletons — **community moderation is not built because there is no
community in the product yet** (no posts, comments or reports to moderate);
it arrives with the community feature itself. Each has a directory under `apps/web/src/features` and a module
under `apps/api/src/modules`, and each returns 501 until its repository is
bound.

### 4.6 Admin panel — پنل مدیریت

**Purpose:** let the people who run the product sign in to `apps/admin`
at `https://hamdaastaan.ir/admin` (`localhost:3001/admin` in development),
and let them decide who else may. The product has no link or button to the
panel; it is reached only by its address.
Code in `apps/admin` and `apps/api/src/modules/admin`.

Unlike the product, the admin panel is a responsive desktop-and-phone app,
not a 430px column: `MobileShell`'s breakpoint rule is `apps/web`'s alone.

**Who may sign in.** Only a number in `v2_admin_users` whose status is
active. There is no public registration.

- Sign-in is the product's flow — mobile number, six-digit code, the same
  limits — at `/login`. The code is hashed under an `admin` scope, so a code
  issued by the product cannot open the panel and the other way round.
- The allow-list is checked **after** the code verifies, so asking for a code
  reveals nothing about which numbers are admins. A proven number that is not
  an active admin gets `403 ADMIN_ACCESS_DENIED`, no session, and no product
  account; the login screen shows «دسترسی نداری».
- The session is one `httpOnly` cookie, `hd_admin`, valid for 12 hours, not
  rolling, and ended earlier by **two hours without use** (the idle timeout).
  Every admin route re-reads the admin's status with the session,
  in `apps/api` (`middleware/authenticate-admin.ts`) — the panel's redirects
  are a convenience, not the access control.
- **Deactivating an admin** revokes every session they hold, in the same
  transaction; their next request is a 401 and the panel sends them to
  `/login`.
- **Deleting an admin** removes their row for good, and their sessions with
  it; their next request is a 401. The number is free to be added again later.
- **Nobody locks themselves out.** An admin cannot deactivate or delete their
  own account (`400 ADMIN_SELF_DEACTIVATION` / `ADMIN_SELF_DELETION`; the
  switch, the status field and the delete button are disabled on their own
  row). Every acting admin is active, so the panel always
  keeps at least one admin who can get in.
- The first admin — امید بهشتی, `09059466960` — is seeded by migration
  `0009`, together with anyone `v2_users` already marks `role = 'ADMIN'`.

**Roles and permissions.** Every admin has one role; what a route allows is
decided by a *permission*, and the table `ADMIN_ROLE_PERMISSIONS` in
`@hamdastan/types` maps roles to permissions. `apps/api` enforces it on every
route (`requireAdminPermission` → `403 ADMIN_PERMISSION_DENIED`); `apps/admin`
reads the same table only to hide what would be refused.

| Permission | مدیر سیستم (`system_admin`) | مدیر محتوا (`content_manager`) | بازبین مأموریت (`mission_reviewer`) |
|---|:-:|:-:|:-:|
| `admins.manage` — the allow-list and roles | ✓ | | |
| `sessions.manage` — a person's sessions | ✓ | | |
| `activities.read` | ✓ | ✓ | ✓ |
| `activities.write` — create, edit, duplicate | ✓ | ✓ | |
| `activities.publish` — publish, pause, close, archive | ✓ | ✓ | |
| `results.read` — the aggregate dashboard | ✓ | ✓ | ✓ |
| `results.individual` — one person's answers (the review queue) | ✓ | | ✓ |
| `xp.read` — the per-person XP grants list | ✓ | | |
| `results.export` — the CSV | ✓ | | |
| `submissions.review` | ✓ | | ✓ |
| `xp.revoke` | ✓ | | |
| `events.read` — events, categories, bookings, history | ✓ | ✓ | |
| `events.write` — create, edit, duplicate; categories; record a booking's outcome | ✓ | ✓ | |
| `events.publish` — publish, schedule, unpublish, cancel, archive | ✓ | ✓ | |
| `worlds.read` — the worlds, a world's home, its preview; the world pickers in every editor | ✓ | ✓ | |
| `worlds.manage` — create, edit, order, publish, archive worlds; their menu and home | ✓ | ✓ | |
| `content.read` — articles and the central content index | ✓ | ✓ | |
| `content.write` — create and edit articles | ✓ | ✓ | |
| `content.publish` — publish, schedule, unpublish, archive articles | ✓ | ✓ | |
| `notifications.read` — campaigns, reports, history | ✓ | ✓ | |
| `notifications.write` — create, edit a draft, duplicate, archive | ✓ | ✓ | |
| `notifications.send` — send, schedule, cancel, stop pushes | ✓ | ✓ | |
| `notifications.broadcast` — send to everyone | ✓ | | |
| `onboarding.read` — the onboarding catalogs; the interest-category pickers in every audience | ✓ | ✓ | ✓ |
| `onboarding.write` — edit stage 1's interests and stage 2's questions | ✓ | ✓ | |

A fourth role, **مدیر اعلان‌ها (`notification_manager`)**, holds the four
`notifications.*` permissions and `onboarding.read` (for the audience picker) (migration `0019` adds it to
`v2_admin_role`). A content manager can send a campaign to a chosen audience
but not to everyone; «everyone» is checked again by the API on send, not only
hidden in the panel.

- Every admin who existed before roles became `system_admin` (migration
  `0014`), so no one lost access.
- A new admin's role must be chosen; there is no default.
- **An admin cannot change their own role** (`400 ADMIN_SELF_ROLE_CHANGE`).
  Only a system admin can manage admins, and none can demote, deactivate or
  delete themselves, so the panel always keeps a system admin.
- A section the role does not open is missing from the menu, and opening its
  URL goes to the first section the role does open.

**Layout.** A dashboard: the menu is a sidebar on the right (the reading
start), with the panel's name at the top, the sections the admin's role opens
— مدیریت کاربران, استودیو (Engagement Studio, §4.7), رویدادها (§4.9),
دنیاها and محتوا (§4.10), اعلان‌ها (§4.11), آنبوردینگ, کتابخانه‌ی رسانه (§4.8) and نشست‌های کاربران — and
the signed-in admin with their role, the theme switch and «خروج» at its foot. A top bar carries the menu button and the current
section's name; the button (or Ctrl/⌘+B) folds the sidebar away on a laptop
and opens it as a sheet from the right on a phone. The current section is a
neutral highlight, never the brand colour.

**مدیریت کاربران — `/users`.** The first of the panel's two sections.

- A table of admin users, newest first, 20 per page: name (with «شما» on
  your own row), mobile number, status, last sign-in and date added (the last
  two drop out on narrow screens; on a phone the number moves under the name).
- Search matches the full name or any part of the number; Persian digits and
  Arabic letters are normalised first.
- A role column shows each admin's role.
- «کاربر جدید» opens a dialog: first name, last name, mobile number (all
  required, same rules as §8), status — active by default — and role, with a
  line under it saying what that role opens. A number another
  admin already has is refused under the field (`409 ADMIN_PHONE_TAKEN`).
- The pencil on a row opens the same dialog to edit it.
- The status switch activates at once; deactivating asks first, in a dialog
  that says the person will be signed out everywhere.
- The bin on a row deletes the user, after a dialog that says it cannot be
  undone. Deactivating is the reversible choice; deleting is for someone who
  should never have been on the list.
- Every write ends in a toast; the list shows skeleton rows while it first
  loads, an error with «تلاش دوباره» if it fails, and an empty state.
- Light and dark, through the same theme store as the product.

**آنبوردینگ — `/onboarding`** (`onboarding.write`). The two catalogs
onboarding asks from, as two tabs. A change shows to the next person who
opens that stage. Code in `apps/admin/src/features/onboarding` and the
`onboarding` module of `apps/api`.

- **علاقه‌مندی‌ها.** The categories in display order, each with its
  interests listed under its title, how many interests it has and how many
  people have picked from it. Up/down arrows reorder; «دسته‌ی جدید» and the
  pencil open one dialog — the title, then the interests as a list to add
  to, reword, reorder and remove — saved together. An interest keeps its id
  while it stays in the list, so everyone who picked it keeps it under its
  new wording; an interest never moves between categories (audiences match
  on the category stored with each pick). Deleting a category asks first and
  says how many people picked from it; their rows stay as history. The API
  refuses any change that would leave fewer than three categories with
  interests, since stage 1 could no longer be finished.
- **پرسش‌نامه.** A card per section (انرژی اجتماعی، سبک ارتباط، سبک تجربه،
  هماهنگی گروهی), its questions in the order they are asked, each with its
  kind and «امتیازدار» for the scored twenty. Arrows move a question within
  its section; the dialog edits the section, the kind (تک‌انتخابی،
  چندانتخابی، انتخاب و رتبه‌بندی، طیف ۱ تا ۱۰), the text, an optional helper,
  the cap for multi and ranked, the two end labels for a slider and the
  options for the rest (2–20). On a scored question the dialog says only
  its wording and section can change, locks the kind, the cap and the
  option list (labels stay editable), and the bin is disabled; the API
  answers 400 to anything else. A new question goes to the end of its
  section; deleting one asks first, and answers already given stay stored.
- **ورود از اکسل.** Each tab has «ورود از اکسل» beside its «جدید» button —
  the same dialog as the activity builder's: download a template, choose an
  `.xlsx` (≤ 2 MB), see every row with what it becomes or what is wrong with
  it, then add the valid ones. The file is read in the browser; the valid
  rows go to the API in one request, saved in one transaction — all or
  nothing.
  - *Interests:* one row per interest — «دسته», «علاقه‌مندی». A category
    whose title matches one in the catalog (spacing and ZWNJ aside) gets the
    interests at its end; any other title becomes a new category at the end
    of the list. A row the category already has, or that repeats an earlier
    row, is refused in the preview (and skipped by the API regardless). At
    most 500 rows, and 60 interests per category.
  - *Questionnaire:* one row per question — «بخش» (1–4 or its name), «نوع»
    (the panel's four kinds), «متن سؤال», «راهنما», «گزینه‌ها» (separated by
    `|`), «سقف انتخاب», «برچسب ابتدا» / «برچسب انتها» for a slider. Each row
    is checked with the form's `questionInputSchema`; the questions are added
    at the end of their sections, unscored. At most 100 rows.

**نشست‌های کاربران — `/sessions`** (`sessions.manage`). A product account's
live sign-ins.

- Search by mobile number (sent in the request body, so it stays out of
  access logs). The account's name and number, «معلق» if suspended, then a
  table of its live sessions: device (from the user agent recorded at
  sign-in), IP, signed in, last activity (the last refresh), absolute end.
- «بستن» ends one session after a confirmation; «بستن همه‌ی نشست‌ها» ends
  them all. Either takes effect on that device's very next request. The
  session row records that an admin ended it (`revoked_reason = 'admin'`) and
  the API log records which admin.


### 4.7 Engagement Studio — فعالیت‌ها و XP

**Purpose:** let an operator design a survey, a mission or an assessment
without code, publish it to everybody or to a chosen audience, collect the
answers, read the results — and pay the XP it promises, once, on the server.
Code in `apps/admin/src/features/engagement`, `apps/web/src/features/activities`
and `apps/api/src/modules/engagement`. Schema: migration `0010`.

**One engine.** Every activity is the same thing: a title, a short description
(«توضیح کوتاه», on the card), instructions, an audience, a window, and a
*version* holding the questions and every scoring and XP setting. A survey and
an assessment are one list of questions; a mission is up to ten titled steps,
each with its own questions. The question kinds are the ones the product
already draws: تک‌گزینه‌ای and چندگزینه‌ای (toggle rows, optional cap), متنی
(one line or many), امتیازی (1–5 or 1–10 as a row of numbers), طیفی (a slider
between two labels, bounds 0–10) and تطبیقی (Duolingo-style matching: 4–8
pairs, each side ≤ 60 characters; the product shows two columns of tiles —
the prompts in the admin's order, the matches reordered — and the person taps
one tile in each to pair them; a pair carries the same number on both tiles
and tapping either takes it apart; the answer counts only once every prompt
is paired, and right or wrong is told only after submitting, like any other
question). Each pair's match has its own random id, so the product receives
both columns without the key. Any question may be required or optional.
A choice question's options are text (the default) or images
(«نوع گزینه‌ها: متنی / تصویری», `optionStyle: 'image'`): 2–12 options, each
a picture from the media library (`imageId`, category «تصویر سؤال»), drawn in
the product as a two-column grid of square tiles — the picture whole, a
foreground border and a check once chosen; single and multiple choice, the
answer key, points and trait points work as for text. An image option's name
is optional and never shown to the person (it could give the answer away; a
screen reader hears «تصویر n»); left empty, the API names it «تصویر n», and
that name is what results, the CSV and a read-back show. Switching back to
text drops the pictures. No schema change: it lives in the version's
`definition`.
Limits are `ENGAGEMENT_LIMITS` in `@hamdastan/config` (50 questions, 2–12
options, …).

| Type | Specific settings | Completes | XP is paid |
|------|-------------------|-----------|------------|
| Survey | anonymous on/off | on a valid submission | then |
| Mission | review: by an admin (default) or automatic; the end date is the deadline; a text question is how a step asks for proof | automatic: on submission; reviewed: on approval | on completion — for a reviewed mission only after approval |
| Assessment | mode (knowledge / personality / profile), dimensions, pass mark, profiles and tie rules, show result | on a valid submission | on completion, whatever the result — unless a knowledge assessment has a pass mark and «فقط با قبولی» |

Every type: estimated minutes, how many times one person may submit (1 by
default), and XP — on/off, a whole non-negative amount, whether the card shows
it, and how many submissions may be rewarded (1 by default, never more than
the submissions allowed).

**Scoring** (`engagement.scoring.ts`, pure). *Knowledge:* a choice question is
right when the picks are exactly its correct options, a matching question when
every prompt has its own match (all or nothing — it counts as one question);
the score is the share right, 0–100; passed when ≥ the pass mark. Text,
rating and scale questions are asked but leave the score — and a
competition's leaderboard — alone. *Personality:* each answered item
is put on 0–1 — a rating or scale by its position on its range, a choice by
its option's points relative to the question's lowest and highest — turned
round when the item is reverse-keyed, and averaged per dimension (0–100). The
dimension on top is the outcome (ties to the first listed); the person sees
its title and description and every dimension's share, if «نمایش نتیجه» is on.
Text and matching questions measure no dimension.
*Profile (پروفایل‌سنجی وزن‌دار):* the admin defines 2–20 result profiles
(title, description, titles distinct). Each choice question has a weight
(«ضریب سؤال», a whole number 0–10, 1 by default; 0 makes it count for
nothing), and in the question's scoring matrix each option has a weight toward
each profile — a whole number −100…100, an empty cell is 0. A profile's score
is the sum, over every chosen option, of its weight toward that profile times
its question's weight; a multiple-choice question adds every pick. Text,
rating, scale and matching questions are asked but do not score; at least one
choice question is required. The highest score is the result. A tie is broken
by the admin's rules, in this order: (1) the priority questions
(«سؤال‌های اولویت‌دار», optional; an ordered list of this activity's choice
questions, reorderable) — one by one, of the tied profiles only those that
scored most on that question stay, until one is left; (2) the default profile
(required), which is the result when a tie survives them. The result keeps
every profile's total and what broke the tie (`tieBrokenBy`); the person sees
only the profile's title and description (if «نمایش نتیجه» is on) — totals can
be negative and mean nothing alone. The results page counts people per
profile, and the CSV adds a «امتیاز <profile>» column per profile. Weights,
question weights and profiles are cleared when the mode or the type changes.
Question and option counts keep the usual caps (50 questions, 12 options);
options, like questions, can be moved up and down in the editor.
Which kinds each mode scores is one list (`SCORED_KINDS` in
`@hamdastan/config`); the builder marks every question its mode leaves out —
«بدون امتیاز» in the question list (the full «در نتیجه حساب نمی‌شود» on
hover), and under «نوع سؤال» a line naming the kinds that do count — so an
admin is never surprised by a score.
The answer key, the points and the weights never leave the API.

**The admin panel — «استودیو», `/engagement`.** The list shows, per activity: title and
type, version, status, audience and how many active people it covers today,
responses / completions, participation rate (completions ÷ eligible), the XP
set and the XP actually paid (the ledger's net sum), and the publish and end
dates. Filters: search, status, type. Row actions: results, edit, preview,
duplicate (a new draft, «(کپی)», no dates), and the status moves.

- **Status.** `draft` → publish → `published` (or `scheduled`, when its start
  is ahead — derived, not stored) ⇄ `paused`; published or paused → `closed`
  (final); anything → `archived` (no more edits). An activity past its end
  reads `closed`. Pause, close and archive ask first. A published activity's
  type cannot change.
- **The builder — `/engagement/new`, `/engagement/:id/edit`.** Seven tabs,
  walked with «بعدی»/«قبلی» or opened directly: ۱ نوع, ۲ اطلاعات (title,
  short description, instructions, minutes, submissions allowed, anonymous for
  a survey, review for a mission), ۳ سؤال‌ها (laid out like Porsline: the
  numbered question list, each with its kind's icon and a dot when it needs
  fixing, on the reading-start side; the selected question's editor and its
  in-app preview beside it — on a phone, the list above the editor; «افزودن
  سؤال» inserts a single-choice question after the selected one and opens it
  — its kind is changed in the editor's «نوع سؤال»; «⋯» on a
  row moves, duplicates or deletes it; a mission's steps group the list and
  open their own title and description; an assessment's «روش محاسبه‌ی نتیجه» —
  mode, dimensions, pass mark, show-result — opens from the top of it), ۴ مخاطبان (with a live count
  from the API), ۵ XP (the pay rule spelled out), ۶ زمان‌بندی (start and end;
  an empty start is «on publish»), ۷ پیش‌نمایش و انتشار — the card and every
  question in the product's 430px column, a summary, and the one primary
  action: «انتشار», «زمان‌بندی انتشار» when the start is ahead, or «ذخیره‌ی
  تغییرات» once live. «ذخیره» saves at any step. A save is checked with the
  same schema the API parses with; a problem lands under its field and opens
  its tab.
- **Questions from Excel.** «ورود از اکسل» in the question list: download the
  template (`.xlsx`, right-to-left, bold headers, one example row per kind),
  fill it, choose it. Columns are recognised by their header, in any order:
  نوع، متن سؤال (required)، توضیح، الزامی (بله/خیر, default بله)، گزینه‌ها
  (separated by `|`; matching: `مورد = جفت | …`)، حداکثر انتخاب، پاسخ درست (knowledge: an option's text
  or number)، امتیاز گزینه‌ها (personality, `|`-separated)، بازه (rating 5 or
  10; scale `1-5`)، برچسب ابتدا/انتها، بُعد (personality: matched by title,
  or created)، معکوس، مرحله (mission: matched by title, or created). Every
  row is checked with the same rules as the builder and listed — its
  question, or its errors by row number; only valid rows are added, after
  the questions already there (a new activity's untouched starter question
  is replaced). The file is read in the browser and never uploaded; the
  questions reach the API on save, like typed ones. `.xlsx` only, 2 MB, 50
  questions per activity.
- **Versioning.** Saving a draft nobody has answered rewrites it. Saving one
  that is published, or that somebody has started, writes version n+1; the
  old version stays with the responses and rewards that point at it. A
  submission made against an older version is refused
  (`409 ACTIVITY_VERSION_CHANGED`) and the player reloads.
- **Audience.** همه‌ی کاربران; گروه‌ها — the interest categories from
  onboarding stage 1, the product's only groups today (a person is in if any
  of their picks is in one of the chosen categories); کاربران منتخب — a list
  of mobile numbers. Only `ACTIVE` accounts count. «شرکت‌کنندگان رویداد» is
  shown disabled until events can be an audience (§4.9).
- **Results — `/engagement/:id`.** Eight figures (کاربران هدف, شروع‌کننده,
  تکمیل‌کننده, نرخ تکمیل, پاسخ معتبر, در انتظار تأیید, مجموع XP اعطاشده,
  دریافت‌کنندگان XP), then tabs: per-question statistics (option counts,
  rating/scale average and distribution, the latest twenty text answers, the
  share who matched each pair right) and
  the assessment outcome (mean score and pass rate, or how many people each
  dimension came out on top for); the mission review queue — each submission
  with its answers, «تأیید» (completes it and pays) or «رد» with an optional
  note (does not pay, and frees the submission so the person can try again);
  the XP transactions — id, person, amount, the version that paid, time,
  «اعطاشده» / «باطل‌شده» with the reason — with «ابطال»; and the history.
  Filters: date range and group (interest category); the figures at the top
  are the whole activity's, the per-question statistics are filtered. Per-
  question figures use the current version's questions. «خروجی CSV» exports
  one row per valid response (UTF-8 with BOM, opens in Excel), built by the
  API.
- **History.** Created, edited, new version (with the XP amount), published,
  paused, resumed, closed, archived, duplicated, a submission approved or
  rejected, an XP revoked — with the admin and the time
  (`v2_engagement_audit_log`).
- **Who may.** Every active admin can do everything, as elsewhere in the
  panel (§4.6); every route checks the admin session in `apps/api`.

**The product — `/activities`, `/activities/:id`.** An activity appears to the
people in its audience while it is published and inside its window, and
stays visible (read-only once closed) to anyone who took part. Anyone else
gets a 404 — an activity meant for somebody else is not admitted to exist.
The card: type, the world it is filed under (an outlined badge the size of
the type's, in muted text — the first world, «+n» for the rest; none when it is under no world, and left
out on a world's own pages, where it would repeat the title), status (جدید,
نیمه‌کاره, در انتظار تأیید, انجام شده, نیاز به انجام دوباره), title, short
description, «حدود n دقیقه», and «+n XP» when the admin chose to show it.

- **Intro.** Title, description, time, reward, question count, instructions;
  «پاسخ‌هات ناشناس ثبت می‌شه…» for an anonymous survey; for a reviewed
  mission, that XP follows approval; the last result if the assessment shows
  one. The one action is «شروع», «ادامه» (a saved draft — it resumes at the
  first unanswered question) or «انجام دوباره»; otherwise a disabled «در
  انتظار تأیید» / «انجامش دادی» / «این فعالیت الان باز نیست».
- **Playing.** One question per screen, with «n از m» and a thin neutral
  progress line; a mission shows the step's title and description above its
  first question. «بعدی» checks the answer with the same rule the API applies
  (`validateAnswers` / `answerError` in `@hamdastan/validation`) and saves the
  draft (`PUT …/draft`; a lost draft is not reported); «قبلی» keeps the
  answer; the last question's action is «ثبت نهایی». Selection is a
  foreground border and a check — the violet is the footer button's alone.
- **Done.** «آفرین، ثبت شد!» — or, for a reviewed mission, «ثبت شد؛ در انتظار
  تأیید». «+n XP» and the new balance appear **only** when the response's
  `xpAwarded` is above zero, i.e. the ledger row was written in the same
  transaction; a repeat, a failed pass mark or a pending review shows no XP.
  Then the result card, if allowed, and «بازگشت به خانه».

**XP — the ledger.** Activity rewards are rows in the same
`v2_xp_transactions` as the missions (§4.4): user, `activity_id`,
`activity_version_id`, amount, time, reason, transaction id (`id`).

- Worked out and written only by `apps/api`, from the stored version — the
  client sends answers, never an amount.
- Once by default: the key is `<activity>:<n>` for the person's n-th paid
  submission, n ≤ the cap. The participation row is locked during a submit
  and an approval, and the ledger's unique key refuses a duplicate, so two
  concurrent submissions or two admins approving at once cannot pay twice.
- The response, the participation update and the reward are one transaction.
- Changing an activity's XP later changes nothing already paid: the amount is
  on the row, and the version that paid it is named.
- **Revocation.** «ابطال» with a required reason appends a `reversal` row —
  the negated amount, `reverses_id`, the admin, the reason. Nothing is
  updated or deleted; a grant can be revoked once; a revoked reward is not
  paid again for that submission slot. The balance and the dashboard are
  net of reversals.
- Built so that levels, badges and a leaderboard can read the ledger later;
  none of them is built for activities.

**Privacy.** An anonymous survey's response row has no `user_id`, and its
time is cut to the (UTC) day, so it cannot be matched to the participation
row that records — for the submission limit and the reward — that the person
took part. Its results carry no names, the group filter is disabled, and its
CSV has only the date and the answers, in no particular order. XP is still
paid, from the participation, never from the response. (With very few
respondents in a day, who answered can still be guessed from who was paid;
that is inherent to rewarding an anonymous survey.) For other activities,
names and numbers appear only in the review queue, the XP list and the CSV,
all behind the admin session.

**Trivia — answers and explanations.** A knowledge quiz (a knowledge
assessment, or a competition) may give each choice question an «توضیح
پاسخ» (`explanation`, up to 500 characters) — in the question editor and
the Excel import's «توضیح پاسخ» column. With «نمایش پاسخ درست و توضیح هر
سؤال» on (`assessment.revealAnswers`, off by default), the person sees,
for their latest submission, each question's right answer, whether they had
it and its explanation (`answerReview`) — but only once nothing they could
still submit would profit: a knowledge assessment after its last allowed
submission; a competition once it has ended, so no one still playing can be
told. Until then neither the key nor the explanation leaves the API.

**Competitions — مسابقه** (`type = 'competition'`, migration `0021`). A
trivia race: a knowledge quiz scored like an assessment (no mode to choose;
optional pass mark; result shown or not), taken **once**, inside a window
that is required (start and end). XP is paid on submission as for an
assessment; there are no rank prizes.

- **The clock.** «شروع» records the moment the person starts (`POST
  /me/activities/:id/start`, kept from the first time); the time ranked is
  from then to the submission. If that call is lost, the first saved answer
  starts it.
- **The ranking** is read from what is already stored — the response's
  score and time, the participation's start: score, then time taken, then
  who submitted first. No table holds it.
- **The product.** The intro says until when it is open («فقط یک بار…
  زمانت از لحظه‌ی «شروع» حساب می‌شه») or that it has ended, and shows the
  leaderboard: the first 20, each by `@username` (else first name) —
  never a number — with score and time; the person's own row in weight and
  «(تو)», added under the list when it is below it; «تا پایان مسابقه تغییر
  می‌کنه» or «نتیجه‌ی نهایی». The done screen says the person's place now,
  with «جدول امتیازات» back to the intro. After the end, the revealed
  answers follow the board.
- **The panel.** «مسابقه» in the builder's first step; the window is
  required in ۶ زمان‌بندی; the results page has a «جدول امتیازات» tab (the
  first 100, with full names — `results.individual`).
- **Not built:** prizes by rank, a live (pushed) board, mini-games (no
  playable game exists to manage).

**The multi-day journey — چالش چندروزه** (`type = 'journey'`, migration
`0015`). *All six phases are built: the data model and unlock clock, the builder,
the media & motion library (§4.8), the player with its day-end page and
invitations, the final character card, and the full preview. Referral
records and rewards are not (they need their own migration).*

- **Shape.** A journey is an activity like the others; its *days* are the
  steps of its versioned definition (each needs a title) and its settings
  are `definition.journey` (`JourneySettings`). Up to 90 days and 1000
  questions (`JOURNEY_LIMITS`); a new one is 7 days with a target of 10
  questions a day (`JOURNEY_DEFAULTS`; the target is not enforced).
  `maxSubmissions` and `xp.maxAwards` are always 1.
- **A campaign.** A journey needs a start («زمان شروع کمپین», the
  activity's `startsAt`); its end is not entered — the API derives it as
  the midnight after the last day, in the journey's zone (a 7-day journey
  starting Saturday ends as Friday does). Everyone shares the same calendar.
- **When a day opens** — decided by `apps/api` on every request
  (`engagement.journey.ts`, pure; the zone maths is
  `@hamdastan/shared/time-zone`), never by the device's clock:
  - `calendar_day` (default): day 1 opens at the start, day *n* at local
    midnight *n − 1* days later, in the journey's `timezone` (default
    `Asia/Tehran`).
  - `rolling_24h`: day *n* opens 24 hours after the person finished day
    *n − 1* (still within the campaign).
  - `missedDays`: `catch_up` (default) — an earlier day stays open until
    the campaign ends, for whoever wants to go back to it; `lock` — it is
    missed for good once the next day opens (calendar mode only).
  - `requirePreviousDay` (default off, calendar mode): a day waits for the
    one before it to be finished or missed.
  - `allowReview` (default on): a finished day can be opened again to read.
  - Each day is `locked` (with `lockReason` `schedule` or `previous_day`
    and, when known, `unlocksAt`), `available`, `in_progress`, `completed`
    or `missed`. **Nothing of a locked day is sent** — not its step, title,
    questions or answers; only its number, status and opening time.
- **Answering.** One question at a time, `POST /me/activities/:id/answers`.
  Each answer is written the moment it is given, as its own row in
  `v2_journey_answers`, so leaving and coming back — on any device —
  resumes where the person stopped. An answer is written once (the row's
  primary key): the same answer again is a harmless repeat
  (`already_answered`, nothing paid), a different one is `409
  JOURNEY_ALREADY_ANSWERED`, an early one `409 JOURNEY_DAY_LOCKED`. An
  optional question may be skipped (`null`). The whole-activity submit and
  draft routes refuse a journey (`409 JOURNEY_ANSWER_ONLY`).
- **Finishing.** A day is finished when each of its questions has an answer
  or a skip (`v2_journey_day_completions`); the journey when every day not
  missed is. The results dashboard and the CSV read each finished day as
  one response, straight from those two tables — nothing is copied
  («پاسخ معتبر» counts finished days).
- **XP**, each once by the ledger's unique key, in the answer's own
  transaction: `rewards.perQuestion` for each answered (not skipped)
  question, `rewards.perDay` for each finished day, and `xp.amount` for
  finishing the journey. `xp.enabled` switches all three. The card shows
  the most a person can earn.
- **The builder** keeps its seven tabs; only what a journey needs changes:
  - ۱ نوع — «چالش چندروزه». Switching to it keeps the questions already
    written on day 1 and adds the rest of the week.
  - ۲ اطلاعات — «تعداد روزها» (added at the end; a day is taken off the end
    only while nothing is written in it), «هدف تعداد سؤال در هر روز», and
    the minutes per day. No «تعداد دفعات» — a journey is taken once.
  - ۳ سؤال‌ها — a tab per day, each showing «سؤال‌ها/هدف» and a dot when
    something on that day needs fixing. The list shows that day's
    questions, numbered from 1, under «تنظیمات و کاور روز»: the day's name,
    a line above its first question, and — folded away — its cover
    (`DailyCover`: headline, short text, start-button label, an optional
    background colour of the admin's choosing, entry effect) beside a
    preview. «⋯» on a question moves it up or down, duplicates it, deletes
    it, or moves it to another day («انتقال به روز…»; a day keeps at least
    one question). «⋯» on the day moves it, or deletes it while it is empty.
    «ورود از اکسل» puts a row on the day named in «مرحله», else on the open
    day; an import never adds days.
  - ۵ XP — «XP هر پاسخ», «XP پایان هر روز», «XP پایان چالش», and the most
    one person can earn.
  - ۶ زمان‌بندی — «زمان شروع کمپین» (required), the end shown as worked
    out, «باز شدن روزها», «منطقه‌ی زمانی», and, folded away, «قوانین
    دسترسی» (missed days, require the previous day, review finished days),
    then the day-by-day opening times in the journey's zone.
- **Playing it — `/activities/:id`** (`JourneyPlayer`; the other types keep
  `ActivityPlayer`).
  - *The timeline.* «n از m روز» with a progress line, then every day: its
    number, its name (none for a locked day), and what it is now — «انجام
    شد» with the XP it paid, «ادامه، ۳ از ۱۰», «آماده‌ی شروع», «فردا ساعت
    ۰۰:۰۰ باز می‌شه», «بعد از تکمیل روز قبل», «ازدست‌رفته». The one action
    starts or continues the open day; with none open it counts down to the
    next («روز بعد تا ۳ ساعت دیگه باز می‌شه») and, when the time comes, asks
    the API again — the clock on the device only draws the countdown.
  - *The cover.* The day's number and name, its mascot, headline, text and
    button, coming in with its entry effect, over the admin's colour or
    image (the words on the app's surface, so they read on any colour). A
    day without a cover gets the same screen, plainly.
  - *A question.* «روز ۱، سؤال ۲ از ۱۰» and a progress line; the image if
    any (whole, never stretched); the text; the answers. «ثبت پاسخ» — or
    «رد شدن از این سؤال» for an empty optional one — sends it at once.
  - *The motion.* After an answer: the question's, else the day's, else the
    journey's motion, in the middle of the screen, for its duration — or
    until «رد کردن» or a tap. After the day's last answer: the day-end
    motion instead (the journey-end one after the last day). A file that is
    missing or fails to load is skipped; a video is muted unless the admin
    turned sound on (and plays muted if the browser refuses sound).
  - *The day-end page.* The admin's title and message with `{name}`,
    `{day}`, `{days}` filled in, the mascot, «۲ از ۷ روز», the XP that day
    paid (from the ledger), when the next day opens, and — if on — the
    invitation text and «دعوت از دوستان»: the device's share sheet, else the
    message and link copied.
  - A finished day opens as a read-back of its answers, if review is on.
  - Under reduced motion every motion and entry effect holds still.
- **Invitations.** The link is the journey's own address. Someone without
  an account (or with one still on its profile or onboarding) is sent to
  the door as usual, and `proxy.ts` remembers the journey in an `httpOnly`
  cookie for a day; the first time the account reaches home, it is taken to
  the journey instead, once. Only an activity's address is ever remembered.
  Invitations are not recorded and earn nothing yet — a referral record
  and its optional reward need their own migration, and wait for it.
- **Admin — «نتایج و اشتراک‌گذاری».** A journey's builder has an eighth tab,
  before the last: the day-end page (title, message, mascot) and the
  invitation (on/off, text, button, share message). The final character
  card joins it in phase 5.
- **The final character card.** In «نتایج و اشتراک‌گذاری» the admin lists
  traits («شجاعت»، «هوش»…), characters — name, title, description, image,
  and the trait each stands for (one character per trait) — and the
  default; in the questions step, each option of a choice question can give
  points to traits («امتیاز ویژگی‌ها», never sent to the product). When a
  person finishes, the API adds up their picked options' points and gives
  the top trait's character (ties to the trait listed first; no points, or
  no character for it → the default). It is worked out once and kept
  (`v2_journey_results`, with the character as it read then), so a
  refresh, an edit or a new version never changes it. The card — character
  image, name, title, description, the person's first name if the admin
  allows and they leave it on, the logo (the admin's or the product's) and
  the brand — is drawn on a canvas at 1080 × 1920 (`@hamdastan/ui/result-card`,
  the same renderer the admin's preview uses) and saved («دانلود تصویر») or
  shared as a PNG («اشتراک‌گذاری کارت»: the share sheet with the file, else
  saved for the gallery).
- **The full preview.** «باز کردن پیش‌نمایش» on the builder's last tab saves
  and opens `/preview/activities/:id` in the product, in a new tab: pick a
  day and a screen — timeline, a locked day, cover, questions (answers
  simulated with their motions), day end with its invitation, the card (any
  character) — on a phone frame or as a desktop shows it. Its data comes
  from `GET /admin/engagement/activities/:id/preview` under the admin's own
  session; anyone else gets the 404 page. Nothing it does is sent: no
  answer, no XP, no participation.
- **Images and motions** (from the library, §4.8). Any question of any
  activity may have an image — above its text (the default) or between the
  text and the answers («جای تصویر» in the question editor), drawn by both
  players, whole and never stretched; one that fails to load is left out. A journey day's cover
  may have a background image and a mascot. Motions are set in one of five
  modes wherever one can be set (§4.8): after an answer — the journey's
  («موشن‌های چالش», at the top of the question list), overridden by a day's
  and by a question's own; after a day's last answer; after the journey's
  last answer. Defaults are «غیرفعال». The player gets, with the activity,
  what each referenced file is (`PlayerActivity.media`); a file it cannot
  load is skipped and the answering carries on.

### 4.8 Media & motion library — کتابخانه‌ی رسانه و موشن

**Purpose:** keep every image and motion activities use in one place, so
none is ever in the product's code. Code in `apps/admin/src/features/media`,
`apps/api/src/modules/media` and `apps/api/src/integrations/storage`.
Schema: migration `0016`.

- **Files.** Images: PNG, JPEG, WebP. Motions: Lottie (JSON), WebM, MP4.
  Every file is at most **250 KB** (`MEDIA_LIMITS`). What a file is, is read
  from its bytes by the API (`media.sniff.ts`) — a renamed SVG, GIF or HTML
  file is refused (`415 MEDIA_UNSUPPORTED`), as is anything bigger (`413
  MEDIA_TOO_LARGE`). A Lottie file must parse as an animation.
- **Where they live.** The row in `v2_media_assets`; the bytes on the API's
  `api-media` Docker volume (`MEDIA_DIR`), as `<id>-<version>.<format>`.
  They are served by the API at `GET /api/v1/media/:id` — public (an id is
  unguessable), cached five minutes and revalidated by hash, sent with
  `nosniff` and a sandboxing CSP so a file is only ever a file. A Lottie
  motion's data is also at `GET /media/:id/lottie`, for the players. The
  volume is not in a `pg_dump`; the deploy runbook backs it up beside it.
- **The section — «کتابخانه‌ی رسانه», `/media`** (`activities.read`; changes
  need `activities.write`). A grid of files — preview (a motion plays; held
  still for anyone whose system asks for reduced motion), name, shelf,
  format, size, and «در n جا» (activities in any version, events, event categories, worlds, articles) or «استفاده‌نشده». Filters: name, shelf
  (مسکات، کاور، تصویر سؤال، موشن پاسخ، جشن و پایان، کارت نتیجه، سایر), kind.
  «بارگذاری فایل» (name, shelf, a local preview first); on a file, «ویرایش
  نام و دسته», «جایگزینی فایل» — the same id, so the new file shows
  everywhere it is used; an image stays an image (`409 MEDIA_KIND_CHANGED`)
  — and «حذف», only for a file nothing uses — no activity in any of its
  versions, no event, event category, world or article (`409 MEDIA_IN_USE`).
- **Choosing in the builder.** A file field opens the library as a picker
  (choose, or upload and it is chosen), then shows the file with «جایگزینی»
  and «حذف». On save, the API checks every id the definition names exists,
  and that an image's place holds an image.
- **A motion setting** (`MotionSetting`) is one of: «غیرفعال»; «مسکات آماده»
  (a file from the mascot shelf); «موشن اختصاصی» (any file, or a new
  upload); «افکت داخلی» (the product's own simple effects: کاغذرنگی، پاپ،
  درخشش، لایک); «تصادفی» (2–12 files, one picked each time). With it: how
  long it stays (0.5–5 s; an answer's starts at 1.2 s), a short caption,
  and sound — off unless switched on, for a video's own track.

**Not built yet:** image/file upload as mission proof (proof is text today;
the media library's storage could carry it), notifying people of a new
activity (no notifications module), an event's participants as an audience
(the events module exists, §4.9; not wired to audiences), recording who joined through a journey invitation and
rewarding it (needs its own migration), conditional questions, ready-made
templates, advanced reports, and Jalali date pickers in the builder (the
browser's own date-time input is used, and dates are shown in Jalali).

### 4.9 Events — رویدادها

**Purpose:** let operators publish events — workshops, shows, fan meetups,
online sessions — and let people discover them, mark interest, register or
buy tickets, and keep track of them. Code in `apps/api/src/modules/events`;
schema: migration `0018`. The V1 ticketing path is the PRD's: Fidibo Art,
by handoff to its page (no Fidibo API is documented, so none is called).

**Built:** the API (phase 1), the admin screens (phase 2), the product's
discovery, detail, world and home screens (phase 3), and booking, interest,
reminders and «رویدادهای من» (phase 4) — everything below unless marked
otherwise. **Planned (phase 5):** end-to-end tests and polish.

**The product screens** (`apps/web/src/features/events`):

- **`/events`** — a top-level screen (it has a tab). Search (title,
  summary, venue, city, organizer — applied as typing pauses), category
  chips from the API (several at once; a chosen chip keeps its icon and takes the violet stroke), a
  and the filters button, a bottom sheet
  with type, world, city, price, «هنوز می‌شه شرکت کرد» and «فقط
  علاقه‌مندی‌های من» — its button reads «نمایش n رویداد», the API's count
  for that choice. The filters button (an icon) starts the row of days,
  violet with a count while any sheet filter is on, followed by «همه» and
  the next fourteen days in Jalali; choosing a day narrows the list to the
  events overlapping it, multi-day ones included. There is no visible title
  (the tab names the screen; an `sr-only` h1 remains) and no month
  calendar in the product for now — `GET /events/calendar` stays in the
  API for later. Everything is in the address (`?category=&type=&world=&city=
  &price=&available=&interested=&date=&page=`), read by the
  server, so a filtered list can be shared and reloaded and the list, the
  and the count come from one source. Empty, no-results and
  could-not-load states; pages of 20. There is no sort control for now:
  the list is newest first (the API's `sort=newest`), as is a world's;
  home's «رویدادهای پیش‌رو» stays soonest first. The API keeps its other
  orders for later.
- **The card** — one component, one layout, wherever an event is listed —
  discovery, home, a world, related events and «رویدادهای من» — so an event
  looks the same everywhere. Where events are a section rather than the
  page's list (home's «رویدادهای پیش‌رو», a world's home, related events)
  the cards sit side by side in a carousel (shadcn `Carousel`, RTL, the next
  card peeking in). The card: cover (a quiet placeholder when there is none or it fails), one
  state badge when there is something to say (لغو شد، برگزار شد، در حال
  برگزاری، تکمیل ظرفیت، ظرفیت محدود), the first category, title, summary,
  when («شنبه ۲۵ مهر، ساعت ۱۸:۰۰», or «۱ آبان تا ۳ آبان»), where (or
  «آنلاین») and the price («از ۴۵۰٬۰۰۰ تومان» / «رایگان»; nothing when
  unknown). The whole card is the link. No «·» next to digits: beside
  Persian numerals it reads as a zero.
- **`/events/:slug`** — back to «رویدادها» and share (the system sheet, or
  the link copied); cover and gallery; badges, title, summary and its
  worlds (as text); when, with the registration deadline; the venue
  with «مسیریابی» (a map route by coordinates, or by address); online
  instructions, and the join link only when the API sends it; the
  organizer; the description (folded behind «ادامه‌ی توضیحات» when long);
  the tickets; related events (a carousel). An event the person may not see is the 404
  page. A signed-out visitor who opens one is brought back to it after
  signing in (the proxy's `hd_return_to`, as for journey invitations).
- **Taking part** (the bottom of `/events/:slug`, phase 4) — a bookmark
  button «علاقه‌مندم» (violet when on) beside the one action the API's
  `cta` offers: «ثبت‌نام رایگان», «خرید بلیت» (with the starting price) or
  «دریافت بلیت»; «لغو ثبت‌نام» (after a confirmation) once registered; a
  line saying why there is nothing to do when the event is informational,
  sold out, closed, ended or cancelled. Above it, the person's booking:
  «ثبت‌نامت قطعی شده», «خرید بلیتت تأیید شده», «خریدت در فیدیبو آرت ثبت شده
  و در انتظار تأییده» (with «دوباره رفتن به فیدیبو آرت») or «خرید قبلیت
  ناموفق بود». The action opens a bottom sheet: ticket type (violet when
  chosen; sold-out ones disabled), quantity 1–10, and a summary — date,
  ticket × quantity, amount — then «تأیید ثبت‌نام» (confirmed by the API at
  once) or «ادامه در فیدیبو آرت», which records the pending booking and
  opens Fidibo's page in the same tab, so back returns to the event. The
  page is read again after every action; interest and the reminder show
  the change at once and step back if the API refuses it.
- **Reminders** — once interested, a card on the page: «توی اپ» (on by
  default; the day before, a reminder notification arrives and the event
  appears under «یادت نره» on home and in «رویدادهای من»), «اعلان گوشی» — a
  link to the notification settings, where this device's push is turned on
  (§4.11) — and «پیامک» shown as «به‌زودی». Home's
  «یادت نره» lists interested-with-reminder or confirmed events starting
  within 24 hours; «رویدادهای پیش‌رو» below it leaves those out.
- **`/events/mine`** — «رویدادهای من», reached from the profile's «رویدادها»
  group only (not from the events screen); its back control is an arrow
  alone and returns to the profile. «یادت نره» on top, then three equal
  tabs: علاقه‌مندی‌ها، ثبت‌نام‌ها، گذشته. Every card carries the booking's own
  badge — «ثبت‌نام قطعی», «در انتظار تأیید», «خرید ناموفق» — so interest
  is never taken for a place.
- **`/preview/events/:id`** — the admin's preview, opened from the
  editor's «پیش‌نمایش در محصول» (which saves first): the same page in any
  status, with a banner saying where the event stands; it needs only the
  admin session.

**The admin screens** (`apps/admin/src/features/events`, `/events`;
`events.read` to open, `events.write` to change, `events.publish` for
status moves):

- **`/events`** — a table of events, newest change first, 20 per page:
  title and type, status (with visibility and, when scheduled, its time),
  worlds and categories, start, organizer, interested / booked. Search
  (title, slug, organizer); filters for status, visibility, world and
  category; sort by last change or start. A row's menu: edit, bookings,
  duplicate (a draft copy), and the status moves its status allows —
  «انتشار» asks when (now, or a time that schedules it); «لغو انتشار»,
  «لغو رویداد» and «بایگانی» say what they take away first. A move the
  API refuses (an incomplete event) offers to open the editor. Skeleton
  rows, an error with «تلاش دوباره», and empty states.
- **The editor** (`/events/new`, `/events/:id/edit`) — eight tabs on one
  screen: اطلاعات پایه (title, slug, summary, description, type, up to five
  categories), رسانه (cover and alt text, gallery from the media library),
  دنیا و مخاطب (worlds; visibility; the audience for a restricted event —
  the Studio's own audience control and count; and «بعد از انتشار کجا دیده
  می‌شه», the surfaces it will reach), زمان (start, end, registration
  deadline — the browser's date-time input, read back in Jalali), مکان
  (venue for physical, link and instructions for online, both for hybrid),
  برگزارکننده, بلیت و ثبت‌نام (booking mode, Fidibo link and reference,
  capacity, ticket types), and انتشار (the publish checklist — the API's
  own `eventPublishProblems`, each item linking to its tab — publish now or
  at a time, the moves back, and the history). «ذخیره» saves a draft
  however incomplete; a problem opens the tab it is in. Once saved, a
  «رزروها» tab lists the bookings: a pending Fidibo handoff is confirmed
  or marked failed by an operator, with Fidibo's reference; a confirmed one
  can be cancelled. An archived event opens read-only.
- **`/events/categories`** — the categories with their icon or image,
  slug, event count and status; add and edit in a dialog (name, slug,
  description, icon from `EVENT_CATEGORY_ICONS`, optional image, on/off);
  order with up/down; delete only when no event uses one.
- **Image sizes** — every image field in events and worlds names the size
  the product draws it at (`IMAGE_FRAMES`: event cover and gallery
  1280×720, 16:9; organizer logo 256×256; world cover 1290×430, 3:1). Once a
  file is chosen it is previewed cropped exactly as the product will show
  it, with a warning when its proportions are more than 8% off (the edges
  will be cut) or it is under three quarters of the width (it will look
  soft).

**One event, four independent questions.**

| Question | Where | Values |
|---|---|---|
| Where is it in its life? | `status` | draft → published → unpublished / cancelled / archived. «scheduled» is a published event whose `publish_at` is still ahead — read off the clock, no job |
| Where may it appear? | `visibility` | `public` — global discovery and its worlds; `world` — only inside the worlds it is linked to (never in global discovery or search); `restricted` — only to the people its `audience` covers |
| Which worlds is it filed under? | `v2_event_world_links` | none, one or many — independent of visibility: a public event may belong to worlds |
| How does a person take part? | `booking_mode` | `none` (informational), `free_registration` (in Hamdastan), `external` (Fidibo Art) |

«ended» is read from `end_at`; room left (available / limited / sold out)
from the ticket options and confirmed bookings; a person's booking has its
own status (pending / confirmed / failed / cancelled).

**Who sees what — enforced in SQL, not in the client.** Every product read
(list, search, calendar days, counts, related events, «رویدادهای من», the
detail page) goes through one rule in `events.repository.ts`: published or
cancelled, `publish_at` reached, and — for `restricted` — the person is in
the audience (`audienceMatch`, the same rule as Engagement Studio). Global
discovery also leaves out `world` events; a world's list (`?world=`) lets
them in. A deep link to a world-only event opens for any signed-in person —
world-only is not members-only. Anything a person may not see is a plain
404, never a 403. A restricted event's cover is served like every library
file — public, by unguessable id.

**Audience of a restricted event:** Engagement Studio's shape — everyone,
a list of mobile numbers, or interest categories — with the same «how many
people» preview. «Members of a world» waits for membership.

**Categories** (`v2_event_categories`) are rows, not code: slug (the stable
identity), name, description, an icon from `EVENT_CATEGORY_ICONS`, an
optional image from the media library, order, on/off. Twelve are seeded
(کارگاه، نمایش، گالری و نمایشگاه، موسیقی، کتاب و ادبیات، بازی و گیم، ورزش،
علم و فناوری، خانواده، خرید و سرگرمی، گردهمایی هواداری، سایر). An event has
one to five. A category in use cannot be deleted (`409
EVENT_CATEGORY_IN_USE`) — switch it off instead.

**Event fields** (`EventInput`): title, slug (Latin, unique; generated as
`event-xxxxxxxx` when left empty; `mine`, `calendar`, `categories`, `new`
are reserved), summary, description (a small Markdown subset, rendered to
elements — never HTML), type (حضوری / آنلاین / حضوری و آنلاین), categories,
cover and its alt text, gallery (up to 12 images; cover and gallery are
drawn 16:9, so 1280×720 is recommended), visibility, worlds,
audience, start, end (after the start), time zone (Asia/Tehran by default),
registration deadline (not after the end), venue, city, address,
coordinates (both or neither), online link and instructions, organizer
name, logo and contact, booking mode, Fidibo link and reference, capacity,
and up to ten ticket options (title, description, price in toman,
capacity, benefits, availability, partner id). A draft needs only a title.

**Publishing** checks completeness (`eventPublishProblems`, shared with the
editor): cover, description, a category, start and end; venue, city and
address unless online; an online link or instructions unless physical; a
Fidibo link for external booking; no paid ticket on a free registration; a
world for world-only; an audience for restricted. Otherwise `400
EVENT_INCOMPLETE` with the problems by field. A published or cancelled
event stays complete: an edit that would break it is refused the same way.
`publish` takes an optional `publishAt` (scheduling); the event's own dates
are separate. Publish from draft, unpublished or published (re-scheduling);
unpublish and cancel from published; archive from anything but archived —
otherwise `409 EVENT_INVALID_TRANSITION`. A cancelled event stays visible,
labelled, with no way to book. Every write and transition is in
`v2_event_audit_log`.

**Discovery** (`GET /events`): search (title, summary, venue, city,
organizer), category, type, world, date range (Tehran days; a range shows
what overlaps it, ended or not — without one, what has not ended), city,
free / paid, «still open» (not over, room left, registration open), «my
interested»; sort by soonest, newest, most popular (people interested —
labelled «محبوب», not «پیشنهادی»), cheapest, or relevance when searching.
«Followed worlds» waits for following. The calendar (`GET
/events/calendar`, up to 62 days) answers the days with events matching the
same filters; a multi-day event marks every day it covers.

**The detail page's one action** (`cta`) is decided by the API: cancelled,
ended, none (informational), registered, registration closed, sold out,
register, or external (with whether it is free). The online link is sent
only to someone who may join — an informational event, or a confirmed
booking.

**Registration** (`free_registration`) is confirmed at once, inside the
room left (the event's capacity and the ticket's), with the event row
locked so two people cannot take the last place; asking again answers with
the one already held. It can be cancelled.

**Fidibo Art handoff** (`external`): the API records a `pending` booking
(ticket, quantity, total) and answers the Fidibo link; the browser goes
there. **Coming back proves nothing** — the booking stays «pending» (shown
as «در انتظار تأیید») until an operator records what Fidibo reported
(`POST /admin/events/bookings/:id`: confirmed, failed or cancelled, with
Fidibo's reference). One open handoff per person and event.

**Interest and reminders.** «علاقه‌مندم» is separate from any booking, with
an in-app reminder switch (on by default). «به‌زودی»
(`/me/events?tab=soon`) lists interested-with-reminder or confirmed events
starting within 24 hours, read live — so a cancellation or a new time shows
at once. The same people get one reminder notification the day before
(§4.11, on the phone too if they turned push on), and everyone interested or
holding a pending or confirmed booking is notified when the event is
cancelled or its time or place changes; a buyer hears the operator-recorded
outcome of a Fidibo booking. Nothing is texted: there is no SMS provider for
it.

**«رویدادهای من»** (`GET /me/events`): interested, booked (pending or
confirmed), past, soon. Each card carries the person's booking status, so
interest and a verified booking are never confused.

**Related events:** visible ones that have not ended, ranked by shared
worlds (×2) and shared categories, then the soonest; a world-only event
appears only through a shared world.

**Not built:** ratings and reviews (there is no feedback backend, and none
is invented), sessions inside one event, the Fidibo API, push and SMS
reminders, world managers scoped to their worlds (needs admins assigned to
worlds). An event's participants are an audience for notification campaigns
(§4.11), not yet for activities.

### 4.10 Worlds and content — دنیاها و محتوا

**Purpose:** let an operator run each story world as a small site of its own —
its identity, its menu, its home page — and file news, knowledge articles,
events and activities under it, from one panel. Code in
`apps/api/src/modules/worlds`, `apps/api/src/modules/content` and
`apps/admin/src/features/worlds` and `apps/admin/src/features/content`.
Product code in `apps/web/src/features/worlds` and `apps/web/src/features/content`.
Schema: migrations `0018` (the list) and `0020` (the CMS). *Phases 1 (the
data model and the API), 2 (the admin screens) and 3 (the product's world
and article pages) are built. Trivia explanations and competitions with a
leaderboard (phase 4) and end-to-end tests (phase 5) follow.*

**A world** (`v2_worlds`): slug, name, short summary, tagline, long
description (plain text), a cover from the media library (no logo: its
name, in its theme, is its mark — `v2_worlds.logo_media_id`, from `0020`,
is no longer read or written), a theme
preset (`WORLD_THEMES`: neutral, emerald, amber, rose, sky, indigo — drawn
from tokens, never a colour an admin types), its menu, and its place in the
list.

- **Lifecycle.** `draft` → publish → `published` ⇄ `unpublished`; any of
  them → `archived`; archived → restore → `unpublished`. A new world is a
  draft. Publishing needs a name and a summary (`worldPublishProblems`,
  `400 WORLD_INCOMPLETE`), and a published world must stay complete when
  edited. A cover is not required: without one the product draws the
  world's built-in artwork (the four seeded worlds) or a quiet tile — the
  built-in banners are larger than the library's 250 KB limit, so requiring
  a cover would lock those worlds until their art was re-encoded. An archived world cannot be edited
  (`409 WORLD_ARCHIVED`) until restored. Only a published world exists for
  the product; anything else is a 404. Archiving keeps every link and every
  record; a world anything is filed under cannot be deleted
  (`409 WORLD_IN_USE`) — only an empty one can. The four worlds `0018`
  seeded were active, so `0020` made them `published`.
- **Menu** (`navigation`): the world's bottom bar — خانه and فعالیت‌ها
  (`WORLD_SECTIONS`), each with the admin's label; خانه is always first and
  on, فعالیت‌ها may be switched off (its menu item and page go; the home's
  activities section is its own switch). News, knowledge and events are not
  menus but sections of the home. A world saved when they were menus is
  read with its خانه and فعالیت‌ها items kept and the rest dropped — no
  migration.
- **Home** (`v2_world_home_sections`, one per kind — events, news,
  knowledge, activities). Events always come first, whatever position they
  were saved at; the admin orders the rest. Each section: on or off, a
  title (empty: the default), how many items (1–12), where the items come
  from — **latest** (the newest eligible ones) or **featured** (only the
  ones the admin chose, in their order, `v2_world_home_items`) — and what an
  empty section does: hide, or show its empty state. A featured item must be
  of the section's kind and filed under the world (`400
  WORLD_HOME_ITEM_INVALID`); it may be chosen while still a draft, and the
  panel shows whether it is live.
- **What may appear** is decided by the module that owns the item, the same
  rule as everywhere else in the product: an article that is published and
  whose publication date has come; an event the person may see that is
  published and not over (a cancelled one is not); an activity that is
  published, inside its window and meant for the person. Unpublishing,
  archiving or ending an item takes it off every home at once.
- **Preview.** `GET /admin/worlds/:id/preview` builds the home of a world in
  any status as anyone would see it (restricted events and audiences aside);
  nothing is recorded.

**Articles** (`v2_articles`): a news item (خبر) or a knowledge article
(دانستنی) — title, slug, summary, body (plain text; a blank line starts a
paragraph — never HTML), an optional free-text category, cover with alt
text, thumbnail, and the worlds it is filed under (one or more).
`draft` → publish (now, or at a date ahead: «scheduled», read off the clock)
→ `published` ⇄ `unpublished`; any → `archived` (no more edits). Publishing
needs a title, summary, body and at least one world (`400
ARTICLE_INCOMPLETE`). History in `v2_article_audit_log`.

**Activities** are filed under worlds too (`v2_engagement_activity_worlds`,
`worldIds` on the activity) — outside the version, so filing one changes
nothing anyone answered. The Studio list filters by world.

**The content index** — `GET /admin/content`: articles, events and
activities in one list, newest change first, filtered by type, world, status
and a title search. Every kind's lifecycle is folded into one vocabulary
(draft, scheduled, published, paused, unpublished, ended, archived); editing
happens in each kind's own editor.

**The admin screens.**

- **«دنیاها» — `/worlds`** (`worlds.read`; changes need `worlds.manage`).
  Every world with cover, slug, status, how many events / articles /
  activities are filed under it, up/down to order the list, and a row menu:
  «مدیریت دنیا», the status moves its status allows (unpublishing and
  archiving ask first), and «حذف» — disabled, with the reason, for a world
  anything is filed under. «دنیای جدید» asks only for a name and a slug,
  creates a draft with the default menu and home, and opens its page.
- **One world — `/worlds/:id`** (`?tab=` opens a tab). The name, status and
  counts, the status buttons — «انتشار» is the screen's primary action while
  it is offered, saves what is on the screen first, and is disabled with a
  «برای انتشار:» checklist until the world is complete — and five tabs:
  - **هویت** — name, slug, tagline, short summary, description, cover
    (3:1) and theme (presets as neutral toggles).
  - **منو** — خانه (always on) and فعالیت‌ها, each with its label, and an
    on/off switch for فعالیت‌ها. هویت and منو are one form and one
    «ذخیره‌ی تغییرات», checked with `worldInputSchema`.
  - **خانه** — the four sections in order — رویدادها pinned first (marked
    «همیشه اول، به‌صورت اسلایدر»), the rest up/down — each on/off, with its
    title, size (1–12), source (جدیدترین / فقط موارد ویژه), what an empty
    section does, and its featured items: added from a picker that offers
    only items of that kind filed under this world (in any status, with a
    search), ordered with up/down, removed with ×, each with its status and
    «نمایش داده نمی‌شود» when it is not live. «ذخیره‌ی چیدمان» saves the whole home; a problem lands
    on its section.
  - **محتوا** — the content index for this world only, with «ایجاد» → خبر,
    دانستنی, رویداد or فعالیت, each opening its editor with this world
    already chosen (`?world=` on the «new» pages).
  - **پیش‌نمایش** — the home as the server builds it for a person, from
    saved settings, in the product's 430px column: cover, name, tagline, the
    menu's tabs and every section with its items or its empty state.
- **«محتوا» — `/content`** (`content.read`). The index of everything filed
  under worlds: title (to its editor), type, status, worlds, last change;
  search, type, status and world filters; pages of 20; «ایجاد» for each
  kind the admin may create.
- **The article editor — `/content/articles/new?kind=&world=`,
  `/content/articles/:id`** (`content.read`; saving `content.write`,
  status moves `content.publish`). Kind (خبر / دانستنی), title, summary,
  body, worlds (checkboxes; an archived one only if already chosen), cover
  with alt text, thumbnail, category and slug — one form checked with
  `articleInputSchema`. «ذخیره» keeps a draft as it is; «انتشار» saves and
  publishes, now or at a date ahead (scheduled), behind the same «برای
  انتشار:» checklist the API applies; «لغو انتشار» and «بایگانی» ask first.
  Tabs: محتوا, پیش‌نمایش (the article in the product's column, from what is
  on the screen) and تاریخچه.
- **Filing events and activities.** The event editor's «دنیاها» is as
  before; Engagement Studio's ۲ اطلاعات step has the same world checkboxes
  (`worldIds`, outside the version).

**The product screens.**

- **`/worlds/:slug`** — a world's home: back to «هم‌داستان» (`APP_NAME` — not «خانه», which is the world's own menu item); the world's card:
  cover (or the seeded world's built-in artwork, or a quiet tile), then a
  band in the world's theme tint (`--world-*` tokens; the words stay the
  foreground, so every theme reads in light and dark) with the name and
  tagline (the summary when there is no tagline), and — when there is a
  description — «درباره‌ی …» at the card's foot, an accordion closed by
  default that opens the description paragraph by paragraph. Then the
  sections the API sent — رویدادها first as a carousel of the events card,
  then news, knowledge and activities in the admin's order — each with
  «همه» to its own page; a section kept when empty says «فعلاً چیزی نیست».
  The page ends in the world's menu.
- **The world's menu** — the app's `BottomNav` with the world's items:
  خانه (`/worlds/:slug`) and فعالیت‌ها (`/worlds/:slug/activities`), in the
  admin's labels, the current one by weight, never violet. A world with
  فعالیت‌ها off has no menu.
- **`/worlds/:slug/activities`** — every open activity filed under the
  world that the person may take part in (`GET /worlds/:slug/activities`),
  over the world's menu. The 404 page when the menu item is off. The home's
  activities «همه» leads here.
- **`/worlds/:slug/news|knowledge|events`** — a home section's «همه»: one
  step down, back to the world, no menu. Articles newest first, events from
  `GET /events?world=` (newest first) with the events card and a link to
  the same filter in «رویدادها»; pages of 20 (`?page=`). Any other segment
  is the 404 page.
  Every list has its empty state and, if it cannot be read, «تلاش دوباره»;
  the page still opens. A world that is not published is the 404 page.
  `?tab=` — the address of the sections when they were tabs — redirects to
  the page that replaced it.
- **`/articles/:slug`** — back to its first world's news or knowledge page, or
  home; cover, kind and category, the Jalali publication day, title,
  summary, the body paragraph by paragraph, and «از دنیای …» linking to
  each world. An article that is not live is the 404 page.
- A signed-out visitor who opens a world's or an article's link is brought
  back to it after signing in (`hd_return_to`, like events and journeys).
- **Previews for the panel** — `/preview/worlds/:id` (the world's home, any
  status, links not followed, with a banner saying where it
  stands) and `/preview/articles/:id` (the article page, any status), opened
  from the panel's «نمای کامل در اپلیکیشن». The API checks the admin
  session they carry; nothing is recorded.

**Product reads.** `GET /worlds` (published, in order), `GET /worlds/:slug`
(identity and the menu items that are on), `GET /worlds/:slug/home`, `GET
/worlds/:slug/activities`, `GET
/content/articles?world=&kind=` and `GET /content/articles/:slug`. A
world's events page reads `GET /events?world=`, as before.

**Not built:** community moderation (no community exists yet), world
membership and following, world-scoped admins, drafts of a published world
(edits to a published world are live on save — preview first), rich text in
articles, and article categories as a managed list.

### 4.11 Notifications — اعلان‌ها

**Purpose:** one system for everything the product tells a person — what the
system sends on its own when something real happens, and what an operator
sends as a campaign — in one inbox, under one set of preferences, opened
through one deep link. Code in `apps/api/src/modules/notifications`,
`apps/web/src/features/notifications` and
`apps/admin/src/features/notifications`; schema: migration `0019`.

**Two sources, one pipeline.** A system notification and a campaign both
become rows through the same statement (`deliver`), which picks the
recipients, drops whoever switched the category off, inserts one row each
and queues a push for every subscribed device whose owner left push on.
Every notification has a name (`dedupe_key`), unique per person, so a
duplicate domain event or a re-run job creates nothing.

**Categories.** Only what something in the product produces:
فعالیت‌ها و XP (`activity`), نشان‌ها و سطح (`achievements`), رویدادها
(`events`), دنیاها (`worlds`), پیشنهادها (`promotions`), سیستم (`system`).
Social, ranking and wallet notifications do not exist because those modules
do not; they arrive with them. The tabs and the preferences are built from
this list (`NOTIFICATION_CATEGORIES`). XP is progression only — no money,
no wallet column, nothing financial is touched.

**What the system sends** (and only this):

| When | Category | Push | Name |
|---|---|:-:|---|
| XP from a profile mission, an activity submission, a journey day or a whole journey (never a single journey answer) | activity | — | `mission:<id>`, `submit:<activity>:<key>`, `journey-day:…`, `journey:…` |
| A new level, the first time it is reached | achievements | ✓ | `level:<n>` |
| A badge, when its last mission completes | achievements | ✓ | `badge:<id>` |
| A reviewed mission: approved (with its XP) or not | activity | ✓ | `review:<response>` |
| An event the person follows is cancelled | events | ✓ | `event-cancelled:<event>` |
| Its start, end or place changes (an upcoming, published event) | events | ✓ | `event-changed:<event>:<hash of the new values>` |
| The day before it starts — interested with the reminder on, or confirmed | events | ✓ | `event-reminder:<event>` |
| An operator records a booking's outcome (confirmed, failed, cancelled) | events | ✓ | `booking:<booking>:<status>` |

«Follows» is interest or a pending or confirmed booking. XP the person just
earned by their own action stays in the app; it is not pushed. A
notification about an event expires when the event ends, a reminder when it
starts; an expired one is labelled and opens nothing. Producing a
notification never fails the action that caused it — the XP is already in
the ledger — a failure is logged and the action answers as usual.

**The Notification Center — `/notifications`.** Reached from the bell on
home. A back arrow to home and a link to the settings; the title; under
it the unread count («۳ اعلان خوانده‌نشده» / «همه‌ی اعلان‌ها خوانده شده»)
with «خواندن همه» across from it — text only, no icon, violet while
something is unread and disabled when nothing is; a row
of filter chips that scrolls sideways — همه، خوانده‌نشده (with its count) and
the six categories (selected is the foreground filled, never the brand
colour); then the list grouped by امروز / دیروز / هفته‌ی گذشته / قبل‌تر, 20 at
a time with «اعلان‌های قبلی». Each notification is a card: the category icon
in a circle (with a dot while unread), the title (bold while unread), the
line, the category and time, and — when a campaign has one — its image full
width at 16:9; an unread card is tinted. A cross in the corner dismisses it. Skeleton rows while
loading, an error with «تلاش دوباره», an empty state per tab, and an offline
notice.

**Opening one — `/notifications/:id`.** Every row and every tapped push
leads here. The page asks the API to open it (`POST /notifications/:id/open`,
which marks it read and opened) and goes where the API answers. The API
re-checks the destination *now*: an event the person may no longer see, an
unpublished one, or an expired notification answers no destination, and the
person is returned to the Center with «این اعلان دیگه به جایی نمی‌ره یا
مقصدش در دسترس نیست». Destinations are kinds, never URLs: home, events, one
event, «رویدادهای من», activities, one activity, the profile, or none.

**Preferences — `/profile/settings/notifications`** (back is an arrow alone). «اعلان گوشی»: this
device's push, which asks the browser for permission only when it is
switched on — never on a page load, and never again once the browser says no
(the screen then says to change it in the browser). An unsupported browser,
or an API without push, says so; on iPhone the PWA must be on the home
screen. Then one switch per category, each with its own icon (system notices are not optional and
not listed); with the device on, each category can also stay in the app
only. Defaults: everything on, promotions not on the phone. Stored in
`v2_notification_preferences`; no row is the default.

**Push.** Web Push with VAPID, sent by `apps/api` alone (`PushSender`,
`web-push`). The browser subscribes through its own push service and gives
the subscription to the API; the front-end calls nothing else. The service
worker (`apps/web/public/sw.js`) caches nothing: it shows a push and, on a
tap, opens `/notifications/<id>`. Without `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` the API sends and queues no push, the
product disables the device switch and the panel refuses a push campaign
(`400 PUSH_UNAVAILABLE`) — in-app notifications are unaffected. A push the
push service says is gone (404/410) removes the subscription; 429, 5xx or a
timeout is retried after 1, 5 and 30 minutes, then marked failed. A failed
push never removes the in-app notification.

**Delivery.** A dispatcher in `maintenance` runs every
`NOTIFICATIONS_DISPATCH_INTERVAL_SECONDS` (30): due campaigns (up to five a
pass), the next 24 hours' event reminders, then up to
`NOTIFICATIONS_PUSH_BATCH` (500) queued pushes, 20 at a time. Every claim is
`FOR UPDATE SKIP LOCKED`, so two instances share the work. A campaign stuck
in «در حال ارسال» for ten minutes is taken again; its dedupe key makes that
harmless. Nothing is sent from an admin's HTTP request. Notifications are
kept 180 days, finished push records 30 (the hourly cleanup).

**The admin screens — `/notifications`** (`notifications.read` to open):

- **The list** — figures (all, draft, scheduled, sent, failed, notifications
  created, pushes accepted / failed — or «پیکربندی نشده»), search, a status
  filter (archived only on request), and a table: title and category, status
  with the recipient count, audience, channel, send time, created and by
  whom. A row's menu: view (edit a draft), duplicate, cancel a scheduled
  one, archive — only what the role may do.
- **A campaign — `/notifications/new`, `/notifications/:id`** — content
  (title ≤ 80, short text ≤ 240, category, an image from the media library,
  destination), audience, channel («فقط درون برنامه» or «درون برنامه +
  اعلان گوشی», the second disabled without push), and a live preview as the
  Center's row and as a lock-screen push. The audience shows how many active
  people would receive it today and how many on a phone, counted by the API
  with the dispatcher's own rule. «ارسال یا زمان‌بندی…» opens the
  confirmation: now or a time (shown back in Tehran's time; stored as UTC),
  then everything that will happen — content, audience, recipients,
  channels, destination, time — and one button, busy while the request is
  out. A sent or scheduled campaign is read-only, with its report —
  created, read, opened, dismissed; pushes queued, accepted by the push
  service, failed, cancelled — and its history. «Accepted» is never called
  delivered.

**Audiences.** Everyone (`notifications.broadcast`); chosen numbers;
interest groups; one event's interested people, or its confirmed bookings
(interest is never taken for a booking); and a world's — people interested
in or confirmed for an event filed under it, since there is no membership
or following to send to. A campaign pointing at an event reaches only those
who may see it (a restricted event's audience); one pointing at an
activity, only that activity's audience.

**Campaign statuses.** draft → scheduled («now» is a schedule for the
present) → sending → sent, or failed (the destination was gone by then, or
the run broke — it can be sent again); scheduled → cancelled; draft, sent,
cancelled, failed → archived. Only a draft is edited (`409
CAMPAIGN_NOT_EDITABLE`); a wrong move is `409 CAMPAIGN_INVALID_TRANSITION`.
A sent campaign's queued pushes can be stopped. Sending is limited to ten a
minute per admin. Every write is in `v2_notification_audit_log`.

**Not built:** social, ranking and wallet notifications (no such modules);
world managers scoped to their worlds; native app push (the product is a
PWA); SMS; email; aggregation of reactions (there are no reactions);
notifying automatically when an activity or an event is published.

---

## 5. User Flows

### 5.1 The routing table

Evaluated on **every** request by `apps/web/src/proxy.ts`, from the `nextStep`
that `GET /me` returns.

| State | Destination |
|-------|-------------|
| Not signed in | `/welcome` |
| Signed in, profile incomplete | `/auth/basic-info` |
| Signed in, username not yet chosen | `/auth/username` |
| Signed in, onboarding unfinished | `/onboarding` and the pages under it |
| Signed in, everything complete | `/` |

An unfinished account is pinned to its step: it can be on that step's page,
or a page beneath it (the onboarding stages live under `/onboarding/`), and
nowhere else.
A finished one may go anywhere — `/activities` included — except back through `/welcome`, `/auth/*` —
or into `/onboarding/*`, which it has been through, apart from
`/onboarding/questionnaire`, which can be put off until later.

### 5.2 A new number

```
/welcome
  └─ «شروع کنیم»
     └─ /auth/phone ── POST /auth/otp/request ──┐
                                                 │  code sent (or echoed)
        /auth/verify?phone=09… ─────────────────┘
          └─ sixth digit auto-submits ── POST /auth/otp/verify
             │  the boxes give way to a full-screen loader, which holds
             │  until the redirect (a wrong code brings the boxes back)
             │  the account is created here
             └─ nextStep = basic_info
                └─ /auth/basic-info ── PUT /me/basic-info
                   └─ nextStep = username
                      └─ /auth/username ── PUT /me/username
                         └─ nextStep = onboarding
                            └─ /onboarding
                               └─ /onboarding/interests ── PUT /me/onboarding/interests
                                  └─ /onboarding/questionnaire
                                     ├─ «بعداً انجام می‌دم» ── POST /me/onboarding/complete → /
                                     ├─ PUT …/questionnaire/answers/:questionId  (every answer)
                                     ├─ POST …/questionnaire/complete  (+50 XP, once)
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

**Only a 401 ends the session.** If `GET /me` answers 429 or 503, `proxy.ts`
does not refresh (a refresh token is single-use, and the API is only busy);
if the refresh itself answers anything but 401, the cookies are kept and the
page renders without a session handoff. A busy or rate-limited API never
signs anyone out.

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
         |--1:N--+--------------------------+
         |       |    v2_xp_transactions    |   the XP ledger
         |       +--------------------------+
         |
   (by phone, not FK)
         |
+-------------------+       +-------------------+       +-------------------+
| v2_otp_challenges |       |    v2_otp_sends   |       |  v2_otp_failures  |  (0011)
+-------------------+       +-------------------+       +-------------------+

Infrastructure — keyed by owner id, no foreign key (owners are users or admins):

+-----------------------+
|  v2_idempotency_keys  |  (0012) a retryable write's key, request hash, outcome
+-----------------------+

Admin panel — no link to v2_users; joined to the codes above by phone only:

+-------------------+       +---------------------+
|  v2_admin_users   |--1:N--|  v2_admin_sessions  |
+-------------------+       +---------------------+

Engagement Studio (0010):

+---------------------------+       +---------------------------+
| v2_engagement_activities  |--1:N--|  v2_engagement_versions   |
+---------------------------+       +---------------------------+
   |  current_version_id ──────────────────┘        |
   |--1:N--+------------------------------+          |
   |       | v2_engagement_participations |  (activity, user)
   |       +------------------------------+
   |--1:N--+------------------------------+          |
   |       |   v2_engagement_responses    |--N:1-----┘  user_id NULL when anonymous
   |       +------------------------------+
   |--1:N--+------------------------------+
   |       |   v2_engagement_audit_log    |
   |       +------------------------------+
   └--1:N--  v2_xp_transactions (activity_id, activity_version_id, reverses_id)

Journeys (0015, 0017) — each belongs to a participation (activity, user):

v2_engagement_participations --1:N-- v2_journey_answers          (one per question; never replaced)
                             --1:N-- v2_journey_day_completions  (one per finished day)
                             --1:1-- v2_journey_results          (the character; kept once)

Media library (0016): v2_media_assets — activities name a file by id
inside their definition; the bytes are on the api-media volume.

Events and worlds (0018):

+---------------------+       +-------------------------+       +-------------+
|      v2_worlds      |--1:N--|  v2_event_world_links   |--N:1--|             |
+---------------------+       +-------------------------+       |  v2_events  |
| v2_event_categories |--1:N--| v2_event_category_links |--N:1--|             |
+---------------------+       +-------------------------+       +-------------+
                                                                   |--1:N-- v2_event_media          (gallery)
                                                                   |--1:N-- v2_event_ticket_options
                                                                   |--1:N-- v2_event_interests      (user, event)
                                                                   └--1:N-- v2_event_bookings       (user; ticket option)
v2_event_audit_log — events, categories, worlds and bookings, by entity id.
Covers, logos, category images and gallery items point at v2_media_assets.

The world CMS (0020):

v2_worlds --1:N-- v2_world_home_sections --1:N-- v2_world_home_items
                                                  (exactly one of article_id / event_id / activity_id)
v2_worlds --1:N-- v2_article_world_links --N:1-- v2_articles --1:N-- v2_article_audit_log
v2_worlds --1:N-- v2_engagement_activity_worlds --N:1-- v2_engagement_activities
```

### 6.2 Key relationships and why they are shaped that way

- **`v2_users`** — one row per verified phone number. Every profile column is
  nullable, because a row exists from the moment a code verifies, which is
  before the product knows anything about the person. `onboarding_step`
  (`basic_info` → `onboarding` → `done`) is what says so; between the first
  two, `username_confirmed_at` (`0022`) says whether the username step is
  done.
- **`v2_users.onboarding_stage`** — the last onboarding stage finished,
  `0`–`3`. It only moves forward, so editing stage 1 again does not undo a
  later stage.
- **`v2_interest_categories`, `v2_interests` (0023)** — stage 1's catalog,
  each with a `position`; an interest belongs to one category for good
  (deleting the category deletes its interests). Seeded ids are the
  original English slugs; ids made from the panel are generated and never
  reused.
- **`v2_questionnaire_questions` (0023)** — stage 2's questions: `section`
  (1–4), `position`, `kind`, `title`, `helper`, `max_selections`,
  `min_label`/`max_label` for a slider, `options` (jsonb `[{code, label}]`)
  and `scored` (the seeded twenty). 0023 also widens `question_id` to 40
  characters on the answers, the profile and the funnel events, and drops
  the `Q1`–`Q20` and 1–20 CHECKs.
- **`v2_user_interests`** — one row per selected interest, keyed by
  `(user_id, interest_id)`. The API refuses ids outside the catalog. `category_id` is
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
- **`v2_sessions`** also carries `absolute_expires_at` (thirty days after
  sign-in; NULL on sessions from before the rule until their next refresh),
  `last_seen_at` (the last refresh), the `user_agent` and `ip` recorded at
  sign-in — not at refresh, which mostly arrives from `apps/web`'s server —
  and `revoked_reason` (`logout`, `reuse_detected`, `admin`).
- **`v2_otp_failures`** — wrong codes per number, across codes, in a window
  that starts at the first failure. `v2_otp_challenges` counts per code and is
  replaced by the next code, so on its own it would let an attacker ask for a
  fresh code after every five guesses.
- **`v2_idempotency_keys`** — `(scope, owner_id, idem_key)` → the request's
  hash and its recorded outcome, kept 30 days. Claimed inside the
  transaction that does the work, so a write and its record commit together;
  see §7 for how a retry is answered.
- **`v2_admin_users.role`** and **`v2_admin_sessions.last_seen_at`** — the
  admin's role (§4.6), and the last use the idle timeout counts from
  (recorded at most once a minute).
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
- **`v2_users` account columns** — `username` (unique, stored lower-case,
  held to it by a CHECK; set at creation, see §4.1), `bio`, `city`, `instagram`, `telegram`, `linkedin` (handles only, from `0008`), `avatar_config` (`jsonb`, the five
  catalog ids; null until saved) and `settings` (`jsonb`; missing keys take
  `DEFAULT_SETTINGS`, so a new setting needs no migration).
- **`v2_xp_transactions`** — the XP ledger, append-only: `user_id`,
  `source_type` (`personality_test`, `avatar_created`, `profile_completed`,
  `mission`), `source_id`, `xp_amount`, `created_at`. Unique on
  `(user_id, source_type, source_id)` — that key is what makes a reward
  once-only. XP total, level, mission status, badges, "avatar completed" and
  "profile completed" are all derived (from this table, `avatar_config`, and
  `username` + `city`), so none of them is stored to drift.

- **`v2_engagement_activities`** — one row per activity: `type`, `status`
  (`draft`/`published`/`paused`/`closed`/`archived`; `scheduled` is derived),
  title, summary, instructions, `audience` (`jsonb`), `starts_at`/`ends_at`,
  `published_at`, `current_version_id`, who created and last changed it.
- **`v2_engagement_versions`** — `(activity_id, version)` unique; the whole
  `ActivityDefinition` as `jsonb` (steps, questions, the answer key, scoring,
  XP settings). Never rewritten once published or answered.
- **`v2_engagement_participations`** — keyed `(activity_id, user_id)`:
  status, `submissions`, `xp_awards`, the saved `draft`, `completed_at`.
  Locked `FOR UPDATE` on submit and on approval — what makes the limits hold
  under concurrency.
- **`v2_engagement_responses`** — one row per submission: the version it
  answered, `answers` (`jsonb`, option ids), an assessment's `result`,
  `score` and `passed`, `review_status` (`none`/`pending`/`approved`/
  `rejected`) with note, reviewer and time. `user_id` is NULL and
  `submitted_at` cut to the day for an anonymous survey.
- **`v2_engagement_audit_log`** — append-only admin history per activity.
- **`v2_xp_transactions` (0010 additions)** — `activity_id`,
  `activity_version_id`, `reason`, `reverses_id` (unique) and
  `created_by_admin_id`; `source_type` gains `engagement` and `reversal`; a
  reversal's amount is negative, every other row's positive. A grant's
  status (granted / revoked) is whether a reversal points at it.

- **`v2_journey_answers` (0015)** — one row per answer, keyed
  `(activity_id, user_id, question_id)`, never updated: `day_id` (the day
  the question was on), `version_id`, `value` (`NULL` for a skip),
  `answered_at`. Belongs to the participation row.
- **`v2_journey_day_completions` (0015)** — one row per finished day,
  keyed `(activity_id, user_id, day_id)`, with `completed_at`. `0015` also
  adds `journey` to `v2_activity_type` and widens
  `v2_xp_transactions.source_id` to 100 characters for the per-answer key
  `<activity>:q:<question>` (a day is `<activity>:d:<day>`, the finish
  `<activity>:1`).

- **`v2_journey_results` (0017)** — one row per (activity, person), written
  once: the version that decided it, the character as it then read, every
  trait's total.

- **`v2_media_assets` (0016)** — one row per library file: `kind`
  (image/motion), `format` (read from the bytes), `category`, `name`,
  `size_bytes` (≤ 250 KB), `sha256`, `version` (up by one on each
  replacement). The bytes are on the `api-media` volume. Activities refer to
  a file by id inside their definition; usage is read from there.

- **`v2_events` (0018)** — one event. `status` (draft / published /
  unpublished / cancelled / archived), `publish_at`, `visibility` (public /
  world / restricted) and `booking_mode` are separate columns on purpose;
  `audience` (jsonb, the `ActivityAudience` shape) is set only for
  restricted. The fields publishing requires are nullable so a draft may be
  incomplete; `CHECK`s keep the end after the start and require
  `publish_at` once an event has left draft. Worlds and categories are link
  tables, many to many. Indexed for discovery `(status, visibility,
  start_at)`, `end_at`, `lower(city)`, and each link's other side.
- **`v2_event_bookings` (0018)** — a person's registration (`internal`,
  confirmed at once) or Fidibo handoff (`external`, `pending` until an
  operator records the outcome). Partial unique indexes allow one confirmed
  registration and one open handoff per person and event.
- **`v2_event_interests` (0018)** — (user, event), with `remind_in_app`.
- **`v2_worlds` (0018, 0020)** — a world: identity, theme preset, menu
  (`navigation`, jsonb, checked by `worldInputSchema`), `status` (which
  replaced `is_active` in `0020`, with every value carried over) and
  `published_at`. No membership yet.
- **`v2_world_home_sections` / `v2_world_home_items` (0020)** — one section
  per (world, kind); a featured item has a real foreign key per kind and a
  check that exactly one is set, so a deleted item leaves the home and an id
  of the wrong kind cannot be stored. Partial unique indexes refuse the same
  item twice in a section.
- **`v2_articles` (0020)** — news and knowledge; `publish_at` is the
  publication date and is required once published (a check constraint).
  Linked to worlds many-to-many; a world in use cannot be deleted (`ON
  DELETE RESTRICT`).
- **`v2_engagement_activity_worlds` (0020)** — activity ↔ world, outside the
  versioned definition.
- **`v2_notifications` (0019)** — one row per recipient: category, type,
  title, body, image, destination (jsonb), campaign, `dedupe_key` (unique
  with the user — «only once» is the database's job), expiry, and
  `read_at` / `opened_at` / `dismissed_at`.
- **`v2_notification_campaigns` (0019)** — an operator's campaign: content,
  category, destination, audience (jsonb), push, status, `scheduled_at`
  (UTC), recipient count, error, creator.
- **`v2_notification_preferences` (0019)** — (user, category) → in-app,
  push. No row is the default.
- **`v2_push_subscriptions` (0019)** — a browser's Web Push endpoint and
  keys; the endpoint is unique and belongs to whoever subscribed it last.
- **`v2_notification_deliveries` (0019)** — one push per notification and
  device: queued → sent / failed / cancelled, attempts, next attempt, the
  provider's error.
- **`v2_notification_audit_log` (0019)** — who did what to a campaign.

- **`v2_admin_users`** — the admin panel's allow-list: `phone` (unique,
  normalised like `v2_users.phone`), `first_name`, `last_name`, `status`
  (`ACTIVE` / `INACTIVE`), `last_login_at`. Deliberately separate from
  `v2_users`: verifying a product code creates a product account for any
  number, which must never grant admin access, and deactivating an admin must
  not touch their product account.
- **`v2_admin_sessions`** — one row per admin sign-in: the SHA-256 of the
  `hd_admin` token, `admin_id`, `expires_at`, `revoked_at`. Deactivating an
  admin revokes all of theirs.

The schema is `database/migrations/0001_users_profile_and_sessions.sql`,
`0002_user_interests.sql`, `0004_social_questionnaire.sql`,
`0006_account_and_xp.sql` (which also backfills the questionnaire reward for
everyone who finished it before XP existed), `0009_admin_users.sql`,
`0010_engagement_studio.sql`, `0015_engagement_journeys.sql`,
`0018_events.sql`, `0019_notifications.sql` and
`0023_onboarding_catalog.sql`.

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
| GET | `/me/username/availability?username=` | access cookie | — | `{ username, available }` — the name normalised; the caller's own name is `available`; 400 for an invalid name |
| PUT | `/me/username` | access cookie | `{ username }` | `{ user, nextStep }`; 403 before basic info, 409 for a taken username |
| POST | `/me/onboarding/complete` | access cookie | — | `{ user, nextStep }` |
| GET | `/me/onboarding/interests` | access cookie | — | `{ onboardingStage, categories, selectedCategories, selectedInterests }` — `categories` is the catalog |
| PUT | `/me/onboarding/interests` | access cookie | `{ interestIds }` | the same; 400 for an id outside the catalog or fewer than three categories |
| GET | `/me/onboarding/questionnaire` | access cookie | — | `QuestionnaireState`: `{ questions, answers, resumeQuestionId, progress, completed, result }` — `result` is `{ title, description, role, summary, insights, interests, dimensions }` (`role`: `{ key, label, avatarId }`, `avatarId` = `<role>-<gender>` or null without a gender) (`interests`: stage 1's picks as `{ key, title, interests: label[] }` per category); 403 before stage 1 |
| PUT | `/me/onboarding/questionnaire/answers/:questionId` | access cookie | `{ answer }` (shape per question) | `QuestionnaireState` |
| POST | `/me/onboarding/questionnaire/complete` | access cookie | — | `QuestionnaireCompletion` — the state with `result`, plus `xpAwarded` (50 once, then 0); 400 until every question is answered |
| POST | `/me/onboarding/events` | access cookie | `{ event, questionId?, sectionId?, properties? }` | `null` |
| GET | `/me/account` | access cookie | — | `AccountOverview`: `{ profile, progress, missions, badges, socialProfile, settings }` |
| PATCH | `/me/profile` | access cookie | any of `{ displayName, username, city, bio, instagram, telegram, linkedin }` | `AccountUpdate`: `{ account, xpAwarded }`; 409 for a taken username |
| PUT | `/me/avatar` | access cookie | `{ base, top, bottom, shoes, accessory }` | `AccountUpdate`; 403 for an item above the person's level |
| PUT | `/me/settings` | access cookie | `{ notifications, showSocialProfile }` | `AccountUpdate` |

`POST /me/onboarding/complete` answers 403 until stage 1 is saved.

`birthDate` is sent as Jalali parts (`{ year, month, day }`) and stored as a
Gregorian date.

The admin panel's routes, all under `/api/v1/admin`. Every one except the
three `/auth` routes needs the `hd_admin` cookie of an active admin, and
answers 401 otherwise; every one except `/me` also needs the permission in
its row (§4.6), and answers `403 ADMIN_PERMISSION_DENIED` without it.

| Method | Endpoint | Body / query | Returns |
|--------|----------|--------------|---------|
| POST | `/admin/auth/otp/request` | `{ phone }` | `{ resendIn, debugCode? }` |
| POST | `/admin/auth/otp/verify` | `{ phone, code }` | `{ admin }` + `hd_admin` cookie; 403 `ADMIN_ACCESS_DENIED` for a number that is not an active admin |
| POST | `/admin/auth/logout` | — | `{ loggedOut }`, cookie cleared |
| GET | `/admin/me` | — | `{ admin }` |
| GET | `/admin/users` · `admins.manage` | `?search=&page=&pageSize=` | `Paginated<AdminUser>` |
| POST | `/admin/users` · `admins.manage` | `{ firstName, lastName, phone, role, status? }` | `AdminUser` (201); 409 `ADMIN_PHONE_TAKEN` |
| PATCH | `/admin/users/:id` · `admins.manage` | any of `{ firstName, lastName, phone, status, role }` | `AdminUser`; 409 `ADMIN_PHONE_TAKEN`, 400 `ADMIN_SELF_DEACTIVATION` / `ADMIN_SELF_ROLE_CHANGE`, 404 |
| DELETE | `/admin/users/:id` · `admins.manage` | — | `{ deleted: true }`, sessions removed with the row; 400 `ADMIN_SELF_DELETION`, 404 |
| POST | `/admin/app-users/sessions/lookup` · `sessions.manage` | `{ phone }` | `AppUserSessions`: `{ user, sessions }`; 404 for an unknown number |
| GET | `/admin/app-users/:userId/sessions` · `sessions.manage` | — | `AppUserSessions` |
| DELETE | `/admin/app-users/:userId/sessions/:sessionId` · `sessions.manage` | — | `{ revoked: 1 }`; 404 if not this person's or already ended |
| DELETE | `/admin/app-users/:userId/sessions` · `sessions.manage` | — | `{ revoked: n }` |

`AdminUser` is `{ id, firstName, lastName, phone, status: 'active' | 'inactive', role, lastLoginAt, createdAt }`.
`AppUserSessions` is `{ user: { id, phone, firstName, lastName, suspended }, sessions: { id, createdAt, lastSeenAt, expiresAt, absoluteExpiresAt, userAgent, ip }[] }`.

Engagement Studio, under `/api/v1/admin/engagement` (admin session) and
`/api/v1/me/activities` (product session). Types are in
`@hamdastan/types/engagement`.

| Method | Endpoint | Body / query | Returns |
|--------|----------|--------------|---------|
The permission each studio route needs: reading activities, their history
and an audience preview — `activities.read`; create, edit, duplicate —
`activities.write`; status — `activities.publish`; results — `results.read`;
submissions — `results.individual`; grants — `xp.read`; export — `results.export`;
review — `submissions.review`; revoke — `xp.revoke`.

| Method | Endpoint | Body / query | Returns |
|--------|----------|--------------|---------|
| GET | `/admin/engagement/activities` | `?status=&type=&search=&page=&pageSize=` | `Paginated<AdminActivitySummary>` (with `stats`) |
| POST | `/admin/engagement/activities` | `ActivityInput` | `AdminActivityDetail` (201), a draft at version 1 |
| GET | `/admin/engagement/activities/:id` | — | `AdminActivityDetail` |
| PUT | `/admin/engagement/activities/:id` | `ActivityInput` | `AdminActivityDetail` — a new version once published or answered; 409 `ACTIVITY_ARCHIVED` |
| POST | `/admin/engagement/activities/:id/status` | `{ action: publish \| pause \| resume \| close \| archive }` | `AdminActivityDetail`; 409 `ACTIVITY_INVALID_TRANSITION` |
| POST | `/admin/engagement/activities/:id/duplicate` | — | `AdminActivityDetail` (201) |
| GET | `/admin/engagement/activities/:id/results` | `?from=&to=&categoryId=` | `ActivityResults` |
| GET | `/admin/engagement/activities/:id/export` | same | `{ filename, csv }` |
| GET | `/admin/engagement/activities/:id/submissions` | `?status=pending\|approved\|rejected&page=` | `Paginated<AdminSubmission>` |
| GET | `/admin/engagement/activities/:id/leaderboard` | — | `AdminLeaderboardEntry[]` — a competition's first 100, with full names — `results.individual` |
| GET | `/admin/engagement/activities/:id/grants` | `?page=` | `Paginated<AdminXpGrant>` |
| GET | `/admin/engagement/activities/:id/history` | — | `AdminActivityEvent[]` (latest 100) |
| POST | `/admin/engagement/audience/preview` | `{ audience }` | `{ eligible }` |
| POST | `/admin/engagement/submissions/:id/review` | `{ decision: approve \| reject, note? }` | `{ xpAwarded }`; 409 `SUBMISSION_ALREADY_REVIEWED` |
| POST | `/admin/engagement/xp/:transactionId/revoke` | `{ reason }` | `{ revoked: true }`; 409 `XP_ALREADY_REVOKED` |
| GET | `/admin/engagement/activities/:id/preview` | — | `JourneyPreview`: `{ activity, definition }` — every day open, nothing recorded; journeys only |
| GET | `/admin/media` | `?category=&kind=&search=&page=&pageSize=` | `Paginated<MediaAsset>` (with `usage`) |
| POST | `/admin/media` | `{ name, category, data }` — `data` is the file, base64 | `MediaAsset` (201); 413 `MEDIA_TOO_LARGE`, 415 `MEDIA_UNSUPPORTED` |
| GET | `/admin/media/:id` | — | `MediaAsset` |
| PATCH | `/admin/media/:id` | `{ name?, category? }` | `MediaAsset` |
| PUT | `/admin/media/:id/file` | `{ data }` | `MediaAsset` — same id, next version; 409 `MEDIA_KIND_CHANGED` |
| DELETE | `/admin/media/:id` | — | `{ deleted: true }`; 409 `MEDIA_IN_USE` |
| GET | `/media/:id` | — (public) | the file, with its type; `ETag`, 304 |
| GET | `/media/:id/lottie` | — (public) | a Lottie motion's animation data |
| GET | `/admin/events` | `?search=&status=&visibility=&world=&category=&sort=updated\|start&page=&pageSize=` | `Paginated<AdminEventSummary>` — `events.read` |
| POST | `/admin/events` | `EventInput` | `AdminEventDetail` (201), a draft; 409 `EVENT_SLUG_TAKEN` — `events.write` |
| GET | `/admin/events/:id` | — | `AdminEventDetail` — `events.read` |
| PUT | `/admin/events/:id` | `EventInput` | `AdminEventDetail`; 400 `EVENT_INCOMPLETE` when a live event would become incomplete — `events.write` |
| POST | `/admin/events/:id/status` | `{ action: publish \| unpublish \| cancel \| archive, publishAt? }` | `AdminEventDetail`; 400 `EVENT_INCOMPLETE`, 409 `EVENT_INVALID_TRANSITION` — `events.publish` |
| POST | `/admin/events/:id/duplicate` | — | `AdminEventDetail` (201), a draft — `events.write` |
| GET | `/admin/events/:id/preview` | — | `EventDetail` with `preview` — any status, nothing recorded — `events.read` |
| GET | `/admin/events/:id/history` | — | `AdminEventHistoryEntry[]` (latest 100) — `events.read` |
| GET | `/admin/events/:id/bookings` | `?page=&pageSize=` | `Paginated<AdminEventBooking>` — `events.read` |
| POST | `/admin/events/bookings/:id` | `{ status: confirmed \| failed \| cancelled, externalRef }` | `{ updated: true }`; 409 unless pending (or confirmed → cancelled) — `events.write` |
| POST | `/admin/events/audience/preview` | `{ audience }` | `{ eligible }` — `events.read` |
| GET | `/admin/events/categories` | — | `AdminEventCategory[]` — `events.read` |
| POST | `/admin/events/categories` | `EventCategoryInput` | `AdminEventCategory` (201); 409 `EVENT_CATEGORY_SLUG_TAKEN` — `events.write` |
| PUT | `/admin/events/categories/order` | `{ ids }` | `AdminEventCategory[]` — `events.write` |
| PUT | `/admin/events/categories/:id` | `EventCategoryInput` | `AdminEventCategory` — `events.write` |
| DELETE | `/admin/events/categories/:id` | — | `{ deleted: true }`; 409 `EVENT_CATEGORY_IN_USE` — `events.write` |
| GET | `/admin/worlds` | — | `AdminWorld[]` — `worlds.read` |
| POST | `/admin/worlds` | `WorldInput` | `AdminWorldDetail` (201), a draft with the default home; 409 `WORLD_SLUG_TAKEN` — `worlds.manage` |
| PUT | `/admin/worlds/order` | `{ ids }` | `AdminWorld[]` — `worlds.manage` |
| GET | `/admin/worlds/:id` | — | `AdminWorldDetail` — `worlds.read` |
| PUT | `/admin/worlds/:id` | `WorldInput` | `AdminWorldDetail`; 400 `WORLD_INCOMPLETE` while published; 409 `WORLD_ARCHIVED` — `worlds.manage` |
| POST | `/admin/worlds/:id/status` | `{ action: publish \| unpublish \| archive \| restore }` | `AdminWorldDetail`; 400 `WORLD_INCOMPLETE`; 409 `WORLD_INVALID_TRANSITION` — `worlds.manage` |
| DELETE | `/admin/worlds/:id` | — | `{ deleted: true }`; 409 `WORLD_IN_USE` when anything is filed under it — `worlds.manage` |
| GET | `/admin/worlds/:id/home` | — | `AdminWorldHome`: every section, featured items with status and `live` — `worlds.read` |
| PUT | `/admin/worlds/:id/home` | `WorldHomeInput` | `AdminWorldHome`; 400 `WORLD_HOME_ITEM_INVALID` — `worlds.manage` |
| GET | `/admin/worlds/:id/home/candidates` | `?kind=&q=` | `WorldHomeCandidate[]` — items of that kind filed under the world — `worlds.read` |
| GET | `/admin/worlds/:id/preview` | — | `WorldHome` with `preview.status` — `worlds.read` |
| GET | `/admin/content` | `?q=&type=news\|knowledge\|event\|activity&status=&world=&page=&pageSize=` | `Paginated<ContentIndexItem>` — `content.read` |
| GET | `/admin/content/articles` | `?q=&kind=&status=&world=&page=&pageSize=` | `Paginated<AdminArticleSummary>` — `content.read` |
| POST | `/admin/content/articles` | `ArticleInput` | `AdminArticleDetail` (201); 409 `ARTICLE_SLUG_TAKEN` — `content.write` |
| GET | `/admin/content/articles/:id` | — | `AdminArticleDetail` — `content.read` |
| PUT | `/admin/content/articles/:id` | `ArticleInput` | `AdminArticleDetail`; 400 `ARTICLE_INCOMPLETE` while published; 409 `ARTICLE_ARCHIVED` — `content.write` |
| POST | `/admin/content/articles/:id/status` | `{ action: publish \| unpublish \| archive, publishAt? }` | `AdminArticleDetail`; 400 `ARTICLE_INCOMPLETE`; 409 `ARTICLE_INVALID_TRANSITION` — `content.publish` |
| GET | `/admin/content/articles/:id/preview` | — | `ArticleDetail` with `preview.status` — `content.read` |
| GET | `/admin/content/articles/:id/history` | — | `AdminArticleHistoryEntry[]` (latest 100) — `content.read` |
| GET | `/admin/notifications/overview` | — | `NotificationsOverview` — `notifications.read` |
| GET | `/admin/notifications/options` | — | `CampaignOptions`: events, activities, worlds, `pushAvailable` — `notifications.write` |
| POST | `/admin/notifications/audience` | `{ audience, category, destination }` | `AudienceEstimate`: `{ eligible, push }` — `notifications.write` |
| GET | `/admin/onboarding/interest-categories` | — | `AdminInterestCategory[]` (with `pickedBy`) — `onboarding.read` |
| POST | `/admin/onboarding/interest-categories` | `{ title, interests: [{ label }] }` | the list (201) — `onboarding.write` |
| PUT | `/admin/onboarding/interest-categories/order` | `{ ids }` | the list — `onboarding.write` |
| PUT | `/admin/onboarding/interest-categories/:id` | `{ title, interests: [{ id?, label }] }` | the list; 400 if fewer than three categories would have interests — `onboarding.write` |
| DELETE | `/admin/onboarding/interest-categories/:id` | — | `{ deleted: true }`; 400 as above — `onboarding.write` |
| GET | `/admin/onboarding/questions` | — | `AdminQuestion[]` (with `scored`), in presentation order — `onboarding.read` |
| POST | `/admin/onboarding/questions` | `QuestionInput` | the list (201) — `onboarding.write` |
| PUT | `/admin/onboarding/questions/order` | `{ ids }` | the list — `onboarding.write` |
| PUT | `/admin/onboarding/questions/:id` | `QuestionInput` (`options: [{ code?, label }]`) | the list; 400 when a scored question's kind, cap or codes change — `onboarding.write` |
| POST | `/admin/onboarding/interest-categories/import` | `{ categories: [{ title, interests: string[] }] }` | the list (201); 400 past 60 interests in a category — `onboarding.write` |
| POST | `/admin/onboarding/questions/import` | `{ questions: QuestionInput[] }` (≤ 100) | the list (201); 400 if any question is invalid — `onboarding.write` |
| DELETE | `/admin/onboarding/questions/:id` | — | `{ deleted: true }`; 400 for a scored question — `onboarding.write` |
| GET | `/admin/notifications/campaigns` | `?search=&status=&page=` | `Paginated<AdminCampaignSummary>` — `notifications.read` |
| POST | `/admin/notifications/campaigns` | `CampaignInput` | `AdminCampaign` (201) — `notifications.write` |
| GET | `/admin/notifications/campaigns/:id` | — | `AdminCampaign` — `notifications.read` |
| PUT | `/admin/notifications/campaigns/:id` | `CampaignInput` | `AdminCampaign`; 409 `CAMPAIGN_NOT_EDITABLE` unless a draft — `notifications.write` |
| POST | `/admin/notifications/campaigns/:id/duplicate` | — | `AdminCampaign` (201), a draft — `notifications.write` |
| POST | `/admin/notifications/campaigns/:id/send` | `{ scheduledAt \| null }` | `AdminCampaign`, scheduled; 400 incomplete, `PUSH_UNAVAILABLE`, `DESTINATION_UNAVAILABLE`; 403 `ADMIN_PERMISSION_DENIED` for everyone without `notifications.broadcast`; 409 `CAMPAIGN_INVALID_TRANSITION`; 10 a minute — `notifications.send` |
| POST | `/admin/notifications/campaigns/:id/cancel` | — | `AdminCampaign` — `notifications.send` |
| POST | `/admin/notifications/campaigns/:id/stop-push` | — | `{ cancelled }` — `notifications.send` |
| POST | `/admin/notifications/campaigns/:id/archive` | — | `AdminCampaign` — `notifications.write` |
| GET | `/admin/notifications/campaigns/:id/report` | — | `CampaignReport` — `notifications.read` |
| GET | `/admin/notifications/campaigns/:id/history` | — | `CampaignHistoryEntry[]` (latest 100) — `notifications.read` |
| GET | `/worlds` | — | `World[]` (published) |
| GET | `/worlds/:slug` | — | `WorldDetail`; 404 unless published |
| GET | `/worlds/:slug/home` | — | `WorldHome`: the sections that are on, each with the items that may appear now |
| GET | `/worlds/:slug/activities` | — | `ActivityCard[]` — open activities filed under the world, for this person; 404 when the world's فعالیت‌ها menu is off |
| GET | `/content/articles` | `?world=&kind=news\|knowledge&page=&pageSize=` | `Paginated<ArticleCard>` — live only |
| GET | `/content/articles/:slug` | — | `ArticleDetail`; 404 unless live |
| GET | `/events` | `?q=&category=a,b&type=&world=&from=&to=&city=&price=free\|paid&available=&interested=&sort=&page=&pageSize=` | `Paginated<EventCard>` |
| GET | `/events/calendar` | the same filters; `from` and `to` required (≤ 62 days) | `EventCalendarDay[]` |
| GET | `/events/categories` | — | `EventCategory[]` (active) |
| GET | `/events/:slug` | — | `EventDetail`; 404 when the person may not see it |
| GET | `/events/:slug/related` | — | `EventCard[]` (≤ 6) |
| PUT | `/events/:id/interest` | `{ remindInApp }` | `{ remindInApp }` |
| DELETE | `/events/:id/interest` | — | `{ removed: true }` |
| POST | `/events/:id/registrations` | `{ ticketOptionId, quantity }` | `MyEventBooking` (201), confirmed; 409 `EVENT_SOLD_OUT`, `EVENT_BOOKING_CLOSED` |
| DELETE | `/events/:id/registrations` | — | `{ cancelled: true }` |
| POST | `/events/:id/booking-handoff` | `{ ticketOptionId, quantity }` | `EventHandoff`: `{ booking (pending), url }`; 409 `EVENT_SOLD_OUT`, `EVENT_BOOKING_CLOSED` |
| GET | `/me/events` | `?tab=interested\|booked\|past\|soon` | `EventCard[]` (≤ 50) |
| GET | `/notifications` | `?filter=all\|unread\|<category>&before=<cursor>` | `NotificationInbox`: `{ items, nextCursor, unread }` (20 a page) |
| GET | `/notifications/unread` | — | `{ unread }` |
| POST | `/notifications/read` | `{ ids? }` — without ids, everything | `{ unread }` |
| POST | `/notifications/:id/open` | — | `{ href }` — the product path, or null when it no longer leads anywhere for this person; 404 for someone else's |
| DELETE | `/notifications/:id` | — | `{ unread }` |
| GET | `/notifications/preferences` | — | `NotificationPreferences`: `{ categories, push: { available, publicKey } }` |
| PUT | `/notifications/preferences` | `{ categories: [{ category, inApp, push }] }` | `NotificationPreferences` |
| POST | `/notifications/push/subscriptions` | the browser's `PushSubscription` JSON | `{ subscribed: true }` (201); 503 `PUSH_UNAVAILABLE` |
| POST | `/notifications/push/unsubscribe` | `{ endpoint }` | `{ subscribed: false }` |
| GET | `/me/activities` | — | `ActivityCard[]` — each with the worlds it is filed under (`worlds: { id, name }[]`) |
| GET | `/me/activities/:id` | — | `PlayerActivity` (no answer key); 404 outside the audience |
| PUT | `/me/activities/:id/draft` | `{ answers }` | `{ saved: true }`; 409 `ACTIVITY_CLOSED` |
| POST | `/me/activities/:id/start` | — | `{ started: true }` — records when the person started (first time only); 409 `ACTIVITY_CLOSED` |
| GET | `/me/activities/:id/leaderboard` | — | `Leaderboard`: the first 20, the person's own place, total, final; 404 unless a competition the person may see |
| POST | `/me/activities/:id/submit` | `{ versionId, answers }`, header `Idempotency-Key` | `ActivitySubmission`: `{ status: completed \| pending_review, xpAwarded, xpTotal, result, answerReview, rank }`; 400 per-question errors; 409 `ACTIVITY_CLOSED`, `ACTIVITY_LIMIT_REACHED`, `ACTIVITY_PENDING_REVIEW`, `ACTIVITY_VERSION_CHANGED`, `JOURNEY_ANSWER_ONLY`; 404 outside the audience |
| POST | `/me/activities/:id/answers` | `{ questionId, value }` — `value` null skips an optional question. Journeys only; safe to repeat | `JourneyAnswerOutcome`: `{ status: recorded \| already_answered, xpAwarded: { question, day, journey }, dayCompleted, journeyCompleted, xpTotal, journey }`; 400 per-question error; 409 `JOURNEY_DAY_LOCKED`, `JOURNEY_ALREADY_ANSWERED`, `ACTIVITY_CLOSED`, `ACTIVITY_VERSION_CHANGED` |

**Retrying a submission.** The player sends an `Idempotency-Key` (16–100
characters of `[A-Za-z0-9_-]`) generated once per submission and reused if
the person taps again after a failure. The key is claimed in the same
transaction as the response and its XP, so the request is acted on once
however many times it arrives: a repeat — concurrent or days later, of the
latest submission or an older one — is answered with the original outcome
(the XP total read fresh). The same key with different answers is `422
IDEMPOTENCY_KEY_REUSED`; a malformed key is 400. Without a key a submission
behaves as before, and the client never retries it.

**Rate limits.** Any route may answer `429 RATE_LIMITED` with a `Retry-After`
header and `details.retryAfter` in seconds (§10). Every response carries
`X-Request-ID`.

Error codes the UI switches on: `OTP_RATE_LIMITED`, `OTP_NOT_FOUND`,
`OTP_EXPIRED`, `OTP_INVALID`, `OTP_LOCKED`, `VALIDATION_ERROR`,
`UNAUTHORIZED`, `RATE_LIMITED`, `IDEMPOTENCY_KEY_REUSED`,
`ADMIN_PERMISSION_DENIED`, `EVENT_INCOMPLETE`, `EVENT_SOLD_OUT`,
`EVENT_BOOKING_CLOSED`, `PUSH_UNAVAILABLE`, `DESTINATION_UNAVAILABLE`,
`CAMPAIGN_NOT_EDITABLE`, `CAMPAIGN_INVALID_TRANSITION`.

### 7.1 Server Actions (RPC)

None. The sign-in flow is plain calls from `apps/web/src/services` to
`apps/api`, because the session cookies are set by the API and the browser
reaches it on the same origin.

---

## 8. Validation Rules

Written once in `packages/validation` (`auth.ts`, `onboarding.ts`, `questionnaire.ts`, `account.ts`, `admin.ts`, `engagement.ts`, `media.ts`, `events.ts`, `notifications.ts`); the forms and the API parse
against the same objects, including the Persian messages.

| Field | Rule | Message |
|-------|------|---------|
| Mobile | `09…`, `9…`, `+98…`, `0098…` accepted; normalised to `09XXXXXXXXX` | «شماره موبایل معتبر نیست» |
| First name | 2–30 characters, Persian letters, space and ZWNJ | «نام رو به فارسی وارد کن» |
| Last name | 2–40, same rule | «نام خانوادگی رو به فارسی وارد کن» |
| Birth date | A real Jalali date; age 13–80 | «تاریخ تولد رو کامل انتخاب کن» |
| Gender | `male` / `female` | «یکی از گزینه‌ها رو انتخاب کن» |
| OTP | Exactly 6 digits | «کد اشتباهه، دوباره امتحان کن» |
| Interests | Every id in the catalog; duplicates dropped; at least 3 categories (`packages/validation/onboarding.ts`) | «حداقل از ۳ دسته انتخاب کن» |
| Display name | 2–30 letters (any script), space and ZWNJ | «نام باید بین ۲ تا ۳۰ حرف باشه» |
| Username | Latin letters, digits, `.` and `_`, starts with a letter, 3–20; lower-cased, a leading `@` dropped; unique | «فقط حروف انگلیسی، عدد، نقطه و _ …» / «این نام کاربری رو قبلاً کس دیگه‌ای انتخاب کرده» |
| City | Empty (clears it) or 2–40 letters | «اسم شهر رو درست وارد کن» |
| Bio | Optional, at most 160 characters; empty clears it | «حداکثر ۱۶۰ کاراکتر» |
| Avatar | Every slot an id from that slot's catalog | «یکی از گزینه‌ها رو انتخاب کن» |
| Admin user | First name, last name and mobile as above; status `active` / `inactive`, active by default (`packages/validation/admin.ts`) | «وضعیت رو انتخاب کن» |
| Activity | Title 1–120; short description ≤ 200; instructions ≤ 2000; 1–10 steps (one for a survey or assessment), ≥ 1 question each, ≤ 50 in all; 2–12 options (each with text, or — image options — each with a library image); scale bounds 0–10 with min < max; XP a whole number 0–10 000; submissions and rewarded submissions 1–100 (rewarded ≤ allowed); end after start; knowledge: every choice question has its correct option(s) (exactly one for single choice); matching: 4–8 pairs, no two prompts or matches alike; personality: ≥ 1 dimension and every non-text, non-matching question tied to one; profile: 2–20 profiles with distinct titles, question weight 0–10, option weights −100…100 toward existing profiles only, ≥ 1 choice question, priority questions distinct and among the choice questions, a default profile; audience: ≥ 1 valid mobile number or ≥ 1 category (`packages/validation/engagement.ts`) | «عنوان رو بنویس» / «یک گزینه‌ی درست مشخص کن» / … |
| Journey | A start is required, the end is derived; 1–90 days, each titled, ≤ 1000 questions; a known time zone; per-answer and per-day XP 0–1000; a cover's button text required and its colour `#rrggbb`; motions 0.5–5 s, a random set 2–12 files, every file id in the library (an image where an image goes); with results on: ≥ 1 character, a default, one character per trait, option points −10…10 for traits that exist (`packages/validation/engagement.ts`, `media.ts`) | «زمان شروع کمپین رو مشخص کن» / «نتیجه‌ی پیش‌فرض رو انتخاب کن» / … |
| Media file | ≤ 250 KB; PNG, JPEG, WebP, Lottie JSON, WebM or MP4 by its bytes; a name 1–120 characters; a known shelf (`packages/validation/media.ts`, `apps/api/src/modules/media/media.sniff.ts`) | «حجم فایل باید حداکثر ۲۵۰ کیلوبایت باشه» / «فقط تصویر PNG، JPEG و WebP یا موشن …» |
| Onboarding import row | Interests: «علاقه‌مندی» header; both cells, ≤ 80 characters, not already in that category nor repeated in the file. Questions: «متن سؤال» header; a section 1–4 or its name, a known kind, an integer cap, then `questionInputSchema` (`packages/validation/onboarding-import.ts`) | «این علاقه‌مندی از قبل در همین دسته هست» / «بخش «…» شناخته نشد» / «دست‌کم دو گزینه لازم است» |
| Question import row | The «متن سؤال» header must exist; each row's kind, yes/no cells, options, answer key, scores and range are read, then checked with `activityQuestionSchema` (`packages/validation/engagement-import.ts`) | «نوع «…» شناخته نشد» / «پاسخ درست «…» بین گزینه‌ها نیست» / … |
| Activity answer | By question kind: an option of the question; distinct options within the cap; text ≤ 2000; an integer in the rating or scale range; matching: one distinct match per prompt, in the prompts' order; required ones present — the same `validateAnswers` in the player and the API | «به این سؤال باید جواب بدی» / «حداکثر n مورد می‌تونی انتخاب کنی» |
| XP revocation reason | Required, ≤ 300 | «دلیل ابطال رو بنویس» |
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
| Brand | `--brand-hue: 270`, `--brand-saturation: 70%` (violet) — **the primary action only** |
| Background (dark) | `hsl(240 5% 7%)` — near-black charcoal, deliberately not tinted toward the brand |
| Success | `--success-hue: 152` (green) |
| Toast feedback | `--success-soft*` (soft green) and `--destructive-soft*` (soft red): a tint, a hairline and a ≥4.5:1 text colour per theme |
| Avatar | `--avatar-*` — skin tones, hair and muted clothing colours; content, never interface |
| Role character backdrop | `--avatar-backdrop` (white, both themes) — the tile behind the role illustrations |
| World themes | `--world-neutral`, `-emerald`, `-amber`, `-rose`, `-sky`, `-indigo` — soft tints (light and dark) for a world page's header band; a mood, never an action, so none is the brand violet |
| Font | Yekan Bakh (variable), loaded with `next/font/local` |
| Radius | `--radius: 0.75rem` |
| Column width | `--shell-max-width: 430px`, as `max-w-shell` and the `shell:` breakpoint |
| Theme | Light by default; dark is a `.dark` class on `<html>`, chosen in settings and kept per device |
| Layout | RTL |

Colours are derived from the variables at the top of
`packages/ui/tokens/tokens.css`. Nothing in a screen names a colour.

**Violet is for the primary action and nothing else.** It fills the one main
button a screen asks the person to press — start, save, continue — and is
not used for surfaces, cards, headers, borders, focus rings, tabs, chips,
selected states, icons, progress or XP bars, badges or glows. Everything
around it is neutral: charcoal surfaces, white text, grey secondary text,
hairline borders; a selected item is a foreground border, a lifted surface
and a check. Success is green, destructive red, warning amber. (Four exceptions:
onboarding stage 1 — its checkboxes, selected chips and selected cards are
violet by product decision — the questionnaire's selected answers, which
predate this rule and still use a brand tint, and events discovery
(2026-10-17, product decision): its selected category chips, day in the
strip and an active filters button take a
violet stroke and text on a faint violet fill, `bg-primary/10`; and basic
info's gender segments (2026-10-25, product decision), selected the same way,
with no check.) Secondary links and buttons («ویرایش شماره», «ارسال دوباره‌ی کد») are
foreground, not violet.

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
- The dark surface is lit by one faint neutral gradient at the top of the
  column (`--gradient-shell-glow`, white at 5%), drawn by `MobileShell`. The one exception
  is a screen built around a single piece of artwork, which sits on
  `--surface-stage` (black) instead — the onboarding intro. Screens do not add
  their own; `--gradient-hero-glow` is the halo for a piece of artwork.
- **Copy speaks in one voice:** informal second person singular (تو), in
  spoken Persian — «کد اشتباهه، دوباره امتحان کن», never «لطفاً دوباره تلاش
  کنید». That includes errors the API sends, which a toast or a field shows
  verbatim. Numbers inside Persian text are Persian digits (`toPersianDigits`),
  validation limits included; an LTR value such as the phone number on the
  verification screen is too.
- **The admin panel speaks formally** — plural «شما», written Persian:
  «عنوان رویداد را وارد کنید», never «عنوان رویداد رو بنویس». So do the
  API errors and shared validation messages only an admin can trigger
  (event, activity, media, campaign and admin-user editors). Errors the API
  shares with the app (server error, rate limit, sign-in code, session) stay
  informal at the source; `apps/admin/src/lib/error-message.ts` swaps them
  for formal wording by `code`.
- **Feedback.** A field's own problem is written under the field
  (`FormMessage`); anything else — a network failure, a rate limit, a save
  that did not land — is a toast. Error toasts are a soft red and success
  toasts a soft green (`--destructive-soft*` / `--success-soft*`, each text
  colour above 4.5:1 on its tint, in both themes); other toasts stay neutral.
  Toasts are set in the app font at 14px, sit at the top of the column 16px
  in from its edges at every width, and never span past it.
- The sign-in code is six separate rounded boxes (`InputOTPSlot`, in both
  apps), evenly spaced in one row with no divider; the focused box takes a
  foreground border.
- Motion is `tailwindcss-animate`'s fade and slide, 150–300ms, plus one shake
  on a wrong code and the
  200ms `Accordion` open/close (`animate-accordion-down` / `-up`).
  Everything honours `prefers-reduced-motion`.
- Top-level screens (home, events, profile) end in `BottomNav` — خانه, رویدادها and پروفایل —
  instead of a footer; a world's home and activities end in the same bar
  with the world's own items. A screen one step down has a back control instead.
  The current tab is weight and full-strength text, not colour.
- A sticky footer holds the primary action, inside the column and clear of the
  iOS home indicator.

### 9.3 PWA

`display: standalone`, `theme_color` matching the background, icons at 192 and
512 plus a maskable 512, `viewport-fit=cover` with `env(safe-area-inset-*)`
padding.

The brand mark is the owl in `assets/brand/hamdastan-logo.svg` (green
`#004431`). `public/images/brand/logo.svg` in each app, `apps/web`'s
`public/icons/` (SVG, 192, 512, Apple touch 180, maskable 512 with the mark
scaled into the safe zone) and `favicon.ico` are exported from it on the white
app background; re-export them all when the master changes.

---

## 10. Non-Functional Requirements

- **Security:** no password anywhere in the product; codes and tokens stored
  only as SHA-256; session cookies `httpOnly`, `SameSite=Lax`, `Secure` in
  production; a replayed refresh token revokes its session; admin access by
  permission, checked in `apps/api` on every route (§4.6). OAuth 2.0 / OIDC
  is deliberately not used: there is no third-party client, native app or
  SSO, and the first-party cookie session already gives short-lived access,
  rotation, reuse detection and server-side revocation. Revisit if any of
  those arrive.
- **CSRF:** three layers. Cookies are `SameSite=Lax` (not sent on a
  cross-site POST); every state-changing request whose `Origin` is not in
  `CORS_ORIGINS`, is `null`, or is labelled `Sec-Fetch-Site: cross-site` is
  refused (`403 CSRF_REJECTED`) before any handler; and bodies are JSON only
  (`text/plain`, urlencoded and multipart — what a form can send without a
  preflight — are 415). Calls from `apps/web`'s server send no `Origin` and
  pass.
- **Uploads:** a library file is taken only when its own bytes are one of
  the six formats (an SVG, GIF or HTML file renamed is refused), and only up
  to 250 KB; it is stored under a name the API makes, never one a client
  sent, and served with `nosniff` and a sandboxing CSP, so it is only ever
  an image, a video or animation data. Lottie is drawn without its
  expression engine — an uploaded animation never runs code.
- **HSTS** is sent by nginx alone, without `includeSubDomains` or
  `preload`; the API's helmet does not add a second header.
- **Client address:** the API believes `X-Forwarded-For` only from the
  addresses in `TRUST_PROXY` — in production nginx's fixed address on the
  `edge` network — and nginx replaces that header rather than appending to
  it. `apps/web`'s server-side calls carry no client address; they are
  counted by the session they carry.
- **Rate limits** (all in `apps/api/src/config/env.ts`, tune after load
  tests):

  | Scope | Default | Key |
  |---|---|---|
  | Signed-in user, writes | 100 / min | user |
  | Signed-in user, reads | 300 / min | user — every navigation reads the session; the questionnaire exceeded 100 / min in the e2e run |
  | No session | 60 / min | address |
  | `POST /auth/refresh` | 10 / min | refresh token |
  | Activity submit | 5 / min | user + activity |
  | Code verification | 30 / 15 min | address, plus the per-number lock (§4.1) |
  | Admin reads / writes | 120 / 30 per min | admin |
  | nginx, any API route | 20 / s, burst 40 | address |
  | nginx, sign-in routes | 30 / min, burst 10 | address |

  A sliding-window count, in memory: correct for the one API instance there
  is. More instances would need the plugin's Redis store. Refusals are
  logged at `warn` with a hash of the key, never the address or id.
- **Retries:** the front-end clients retry only reads and writes sent with an
  idempotency key; only network failures, timeouts, 502, 503, 504 and 429;
  at most 5 attempts in all (2 from the Next server), exponential backoff
  with full jitter, `Retry-After` honoured up to 10 s. Never a 4xx, never a
  refresh, never an SMS send.
- **Timeouts:** 15 s per browser attempt, 5 s from the Next server;
  PostgreSQL statements 15 s (`DATABASE_STATEMENT_TIMEOUT_MS`, lifted for
  migrations); SMS 5 s; nginx 30 s to the API; a request body 1 MB.
- **Retention:** an hourly cleanup deletes expired tokens, codes and
  idempotency keys, failure windows over a day old, sessions 90 days after
  they ended (`SESSION_RETENTION_DAYS`) and the log of sent codes after 30
  (`OTP_SEND_RETENTION_DAYS`) — in batches, under an advisory lock, logging
  what it deleted per table. It never touches the XP ledger, responses or
  live sessions.
- **Observability:** one request id per request — nginx's `$request_id`, the
  API's `reqId`, and the `X-Request-ID` response header; nginx logs status,
  `rt` and `urt` (latency) without query strings; the API log redacts cookies
  and authorization headers and never logs a token, a code (masked in
  production) or a raw rate-limit key; admin session ends and permission
  denials are logged with an `audit` field. `/_up` reports the database.
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
| Connect Kaveh-Negar | **Blocking** | Adapter written (5 s timeout, never retried); set `SMS_PROVIDER=kavenegar`. Until then production sign-in is refused (503) — by design |
| Security and reliability layer | Done — apply `0011`–`0014` | Trusted proxy, rate limits, per-number OTP lock, retries and timeouts, idempotent submissions, session lifetimes and management, admin roles, nginx gateway hardening, cleanup job — §4.1, §4.6, §7, §10 |
| Admin MFA | High | TOTP second factor for the admin panel, then step-up and passkeys — design in `docs/admin-mfa-design.md` |
| Shared rate-limit store | Low | Redis for `@fastify/rate-limit` — only when there is more than one API instance |
| Metrics and alerting | Medium | Latency and error rate are in the logs; ship them to a dashboard with alerts, and watch CPU, memory and the database at the host |
| Load test the limits | Medium | Tune the §10 numbers against real traffic |
| Final logo and app icons | Done | Owl mark from `assets/brand/hamdastan-logo.svg`; see §9.3 |
| Final Welcome artwork | Done | The owl among its stories, a still WebP at `apps/web/public/images/brand/welcome-hero.webp` (640×360, source in `assets/illustrations/`), on white with its edges fading into the screen — no frame, no corners and no halo behind it. `welcome-hero-still.webp` beside it serves reduced motion, so an animated replacement needs no code change |
| Onboarding stage 3 (avatar) | High | Intro, stage 1 (interests) and stage 2 (questionnaire) are built; the result screen goes home until stage 3 exists |
| Matching on the social profile | High | The profile, roles, availability and conflict sensitivities are stored; nothing reads them yet |
| Confirm questionnaire scoring v1 | High | Check the v1 choices in §4.2 against the scoring spec; bump `social-matching-v1` if they change |
| Home screen | High | Carries the questionnaire mission and «جهان‌های هم‌داستان» (a row that opens a sheet of worlds) |
| Read the privacy setting | Medium | `showSocialProfile` is stored; nothing reads it until other people's profiles exist |
| Level-gated avatar items | Low | `unlockLevel` is enforced by the API; the dress-up studio is gone and no item uses it |
| «ساخت آواتار» mission | Low | No longer reachable — there is no avatar screen. Earned XP and «خوش‌استایل» badges stay; missions are not listed on the profile |
| More missions | Medium | Add to `MISSIONS`; a mission beyond the three one-offs records `source_type = 'mission'` with its id |
| World CMS — data model and API (phase 1) | Done — apply `0020` | World lifecycle, identity, theme preset, menu, home sections with latest/featured items and eligibility, articles (news, knowledge) with scheduling, activities filed under worlds, central content index, permissions — §4.10 |
| World CMS — admin screens (phase 2) | Done | World list and page (identity, menu, home with featured picker, content, preview), central content area, article editor with scheduling and preview, worlds in the Studio editor, `?world=` preselection — §4.10 |
| World CMS — e2e tests (phase 5) | Done | `worlds.spec` (home banner → world, featured order, empty section, tabs, article and back, unpublishing), `competition.spec` (one try, place, board, answers after the end), `admin-worlds.spec` (draft → published world, menu, article from the world's tab, featured, preview, content filter) — at 390×844 and 1440×900 |
| World CMS — product screens (phase 3) | Done | `/worlds/:slug` with theme, tabs and home; `/articles/:slug`; home banners linking to published worlds; previews for the panel; return after sign-in — §4.3, §4.10 |
| Trivia explanations, competitions and leaderboard (phase 4) | Done — apply `0021` | Explanations and answer reveal for knowledge quizzes; «مسابقه» — one try in a window, ranked by score then time, leaderboard in the product and the panel — §4.7 |
| Community and its moderation | Medium | No community exists in the product; moderation comes with it |
| Play, commerce | Medium | Module skeletons exist on both sides |
| Admin sign-in and user management | Done | OTP sign-in limited to active admins; create, edit, (de)activate and delete at `/users` in `apps/admin` — see §4.6 |
| Serve `apps/admin` in production | Done | nginx routes `/admin` to the `admin` container; the app is built with `basePath: '/admin'` |
| Admin roles and permissions | Done — apply `0014` | System admin, content manager, mission reviewer; permission per route — §4.6 |
| Engagement Studio (phases 1–3) | Done — apply `0010` | Surveys, missions with review, knowledge and personality assessments, audience, versioning, XP ledger with revocation, results and CSV — §4.7. Needs migration `0010` applied to each database |
| Multi-day journey (چالش چندروزه) | Done — apply `0015`, `0016`, `0017` | Campaign calendar with server-side unlocking, per-answer storage and XP, builder, images and motions, player, day-end page, invitation links, character card, full preview — §4.7, §4.8. Not built: referral records and rewards (needs a migration) |
| Media & motion library | Done — apply `0016` | Upload, sniffed formats, 250 KB, replace, safe delete, picker, motion settings — §4.8. The API's `api-media` volume must be backed up with the database |
| Image / file proof for missions | Medium | The media library's `MediaStorage` can carry it; proof is text today |
| Notifications (center, preferences, automatic, campaigns, push) | Done — apply `0019` | §4.11. Push needs VAPID keys in `deploy/.env.production` |
| Notify people of a new activity | Medium | The notifications module exists; publishing an activity does not call it — a campaign pointing at the activity does it by hand |
| Events — API (phase 1) | Done — `0018` applied on dev; production gets it on the next deploy | Events, categories, the minimal world list, visibility in SQL, publish checks and scheduling, calendar, registration, Fidibo handoff (pending until an operator confirms), interest, «رویدادهای من», audit — §4.9, §4.10 |
| Events — admin screens (phase 2) | Done | Event list, editor (eight sections, publish checklist, scheduling), bookings with operator confirmation, categories, worlds — §4.9, §4.10. The visual preview of the detail page comes with phase 3 |
| Events — product screens (phase 3) | Done | Discovery with search, chips, the filters sheet and the Jalali day strip (no month calendar for now); detail; home section; admin preview — §4.3, §4.9, §4.10. No world page: the home banners are not links |
| Events — booking, «رویدادهای من», reminders (phase 4) | Done | Booking bar and sheet with summary, free registration, Fidibo handoff kept pending until an operator confirms, interest and its in-app reminder, «یادت نره» on home, «رویدادهای من» — §4.9 |
| Events — e2e tests and polish (phase 5) | High | Playwright specs for discovery, detail, booking and «رویدادهای من» at 390×844 and 1440×900 |
| Event participants as an audience | Medium | The events module exists; audiences do not read it yet |
| World membership and following | Medium | Unlocks «members of a world» audiences, the «followed worlds» filter and world-scoped admins |
| Event ratings and reviews | Low | No feedback backend exists; not built |
| Conditional questions, templates, advanced reports | Low | Phase 4 of Engagement Studio |
| Levels, badges, leaderboard from activity XP | Low | The ledger already carries what they need; not built on request |
