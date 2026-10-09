# Product Requirements Document — هم‌داستان

**Product:** هم‌داستان (Hamdastan)
**Version:** 1.0
**Last Updated:** 2026-10-09
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
  if another admin has already added that number (§4.6).

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
| **XP** | Experience points, earned only by finishing missions. The total is the sum of the person's XP ledger; nothing else stores it. |
| **Level (سطح)** | A band of XP: 1 from 0, 2 from 100, 3 from 250, 4 from 500, 5 from 1000 (`LEVEL_THRESHOLDS`). Derived, never stored. |
| **Mission (ماموریت)** | One thing worth doing, with an XP reward. A mission is finished exactly when the ledger holds its reward. |
| **Badge (نشان)** | A mark of achievement, earned once every mission it requires is finished. Derived, never stored. |
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
sign-in (§4.6), which reuses these codes but opens no product account.

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
once. Under the text, the owl fitting two puzzle pieces together
(`onboarding-intro.webp`, source in `assets/illustrations/`) arrives with the
action — a single frame until its animated version arrives. It is prepared
and shown exactly like the questionnaire's owls (see *Artwork* under Stage 2
below; `StageArtwork`), centred between the text and the footer, so
it reads as part of the stage rather than a clip on it. The
header has no control: the button is the only way on, and stage 1
has its own back to this screen.

**Stage 1, interests — `/onboarding/interests`.**

- The title «به چه چیزهایی علاقه داری؟» (no step counter or progress bar),
  and a quiet line that every pick shapes the avatar.
- Six categories: موسیقی و اجرا، هنر و خلاقیت، آموزش و مهارت، تفریح و سبک
  زندگی، اجتماعی و کسب‌وکار، آنلاین. The catalog, with its ids, is
  `packages/config/app/onboarding.config.ts`, shared with `apps/api`.
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
- **Artwork.** An owl sits under the text of the intro
  (`questionnaire-intro.webp`), of the onboarding intro
  (`onboarding-intro.webp`), and of every chapter reward: Section 1 and
  Section 3 share `questionnaire-section-1.webp`, Section 2 has
  `questionnaire-section-2.webp` (a single frame until its animated version
  arrives). The files live in
  `apps/web/public/images/brand/` (sources in `assets/illustrations/`) and
  are all prepared the same way — 720×491, the subject kept clear of the
  edges in every frame, the artwork's grey backdrop and its vignette lifted
  to white, with a `-still.webp` first frame.
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
  themes — no text, no spinner. It stays for at least one full 5-second loop
  and until the request has returned, looping while it waits; then it fades
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
     there is no character and the person's avatar is shown in a shadcn
     `Avatar` instead (a neutral figure before they have one). Then
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
name, linking to the profile; the bottom nav holds خانه and پروفایل. Signing out is not on home.

- **Questionnaire not done:** the first thing on the screen is a card —
  «یه قدم مونده تا بیشتر بشناسیمت», «آزمون کوتاهت رو کامل کن تا تجربه‌ها و
  آدم‌های مناسب‌تری برات پیدا کنیم.», «حدود ۵ دقیقه», «+50 XP» and
  «شروع آزمون», the screen's one primary action.
- **Done:** the card is gone; a quiet row «پروفایل اجتماعی‌ات آماده‌ست» with
  the result's title and «مشاهده نتیجه» leads to `/profile/social`.
- Below it, the story-world picker under «دنیای داستانی‌ات رو انتخاب کن». Today it shows four banners, in this order: Hogwarts, GTA, Game of Thrones (بازی تاج و تخت), and Liverpool (لیورپول). Neither links anywhere yet.

### 4.4 Account — حساب من

The person's identity hub: "my identity, my achievements, my profile" —
not a settings page, not a game dashboard. Code in
`apps/web/src/features/profile` and `apps/api/src/modules/account`.

**Profile home — `/profile`.** One card (shadcn `Card`) per group, top to
bottom:

1. **Identity.** The avatar, large, with a small amber spark: the role
   character full-body with no frame, on a stage the same white as the art
   (`--avatar-backdrop`); or, before the questionnaire, the drawn avatar
   head to chest on a soft neutral disc. Not a link — there is no avatar
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
   animated detective owl (`OwlLoader`, `owl-detective.webp`, a 5-second
   loop) over the whole screen, on white in both themes so it reads as the
   screen rather than a clip. The result is not shown until one full loop has
   played *and* the result has loaded; the owl keeps looping while it waits. Before the questionnaire is done: a
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
Before the questionnaire, or without a gender on file, the drawn SVG
avatar (`AvatarFigure`, from `avatar_config`, coloured only by the
`--avatar-*` tokens) stands in.

There is no avatar screen. The character's clothes are part of the
illustration, so the earlier dress-up studio (`/profile/avatar`) is gone,
with its «ظاهر» row in edit profile. `PUT /me/avatar` and `avatar_config`
remain in the API, unused by the app. XP and badges already earned stay;
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
not on the account), «اعلان‌ها» (ماموریت‌ها و پیشرفت — a switch), «حریم خصوصی» (نمایش پروفایل اجتماعی به
دیگران — a switch), «پشتیبانی» (راهنما و پشتیبانی → `/profile/help`), then,
set apart, «خروج از حساب» in red text. An account switch saves when flipped
and flips back if the save fails. A switch's "on" is the brand violet. Both
account settings are stored; nothing reads them yet,
because notifications and other people's views do not exist yet.

**Logout.** Only in settings. It asks: «از حساب خارج می‌شی؟» / «هر وقت خواستی
می‌تونی دوباره وارد بشی.» / «خروج» (destructive red) / «انصراف», in a
right-aligned dialog with the two buttons stacked full width.

**Help — `/profile/help`.** Four short answers: XP, levels, the social
profile, and who sees it.

### 4.5 Worlds, Play, Community, …

Skeletons. Each has a directory under `apps/web/src/features` and a module
under `apps/api/src/modules`, and each returns 501 until its repository is
bound.

### 4.6 Admin panel — پنل مدیریت

**Purpose:** let the people who run the product sign in to `apps/admin`
(`localhost:3001` in development), and let them decide who else may.
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
  rolling. Every admin route re-reads the admin's status with the session,
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

**مدیریت کاربران — `/users`.** The panel's one section so far, in the header
menu.

- A table of admin users, newest first, 20 per page: name (with «شما» on
  your own row), mobile number, status, last sign-in and date added (the last
  two drop out on narrow screens; on a phone the number moves under the name).
- Search matches the full name or any part of the number; Persian digits and
  Arabic letters are normalised first.
- «کاربر جدید» opens a dialog: first name, last name, mobile number (all
  required, same rules as §8) and status — active by default. A number another
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
             │  the account is created here
             └─ nextStep = basic_info
                └─ /auth/basic-info ── PUT /me/basic-info
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
+-------------------+       +-------------------+
| v2_otp_challenges |       |    v2_otp_sends   |
+-------------------+       +-------------------+

Admin panel — no link to v2_users; joined to the codes above by phone only:

+-------------------+       +---------------------+
|  v2_admin_users   |--1:N--|  v2_admin_sessions  |
+-------------------+       +---------------------+
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
- **`v2_users` account columns** — `username` (unique, stored lower-case,
  held to it by a CHECK), `bio`, `city`, `instagram`, `telegram`, `linkedin` (handles only, from `0008`), `avatar_config` (`jsonb`, the five
  catalog ids; null until saved) and `settings` (`jsonb`; missing keys take
  `DEFAULT_SETTINGS`, so a new setting needs no migration).
- **`v2_xp_transactions`** — the XP ledger, append-only: `user_id`,
  `source_type` (`personality_test`, `avatar_created`, `profile_completed`,
  `mission`), `source_id`, `xp_amount`, `created_at`. Unique on
  `(user_id, source_type, source_id)` — that key is what makes a reward
  once-only. XP total, level, mission status, badges, "avatar completed" and
  "profile completed" are all derived (from this table, `avatar_config`, and
  `username` + `city`), so none of them is stored to drift.

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
`0002_user_interests.sql`, `0004_social_questionnaire.sql` and
`0006_account_and_xp.sql` (which also backfills the questionnaire reward for
everyone who finished it before XP existed).

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
| GET | `/me/onboarding/questionnaire` | access cookie | — | `QuestionnaireState`: `{ answers, resumeQuestionId, progress, completed, result }` — `result` is `{ title, description, role, summary, insights, interests, dimensions }` (`role`: `{ key, label, avatarId }`, `avatarId` = `<role>-<gender>` or null without a gender) (`interests`: stage 1's picks as `{ key, title, interests: label[] }` per category); 403 before stage 1 |
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
answers 401 otherwise.

| Method | Endpoint | Body / query | Returns |
|--------|----------|--------------|---------|
| POST | `/admin/auth/otp/request` | `{ phone }` | `{ resendIn, debugCode? }` |
| POST | `/admin/auth/otp/verify` | `{ phone, code }` | `{ admin }` + `hd_admin` cookie; 403 `ADMIN_ACCESS_DENIED` for a number that is not an active admin |
| POST | `/admin/auth/logout` | — | `{ loggedOut }`, cookie cleared |
| GET | `/admin/me` | — | `{ admin }` |
| GET | `/admin/users` | `?search=&page=&pageSize=` | `Paginated<AdminUser>` |
| POST | `/admin/users` | `{ firstName, lastName, phone, status? }` | `AdminUser` (201); 409 `ADMIN_PHONE_TAKEN` |
| PATCH | `/admin/users/:id` | any of `{ firstName, lastName, phone, status }` | `AdminUser`; 409 `ADMIN_PHONE_TAKEN`, 400 `ADMIN_SELF_DEACTIVATION`, 404 |
| DELETE | `/admin/users/:id` | — | `{ deleted: true }`, sessions removed with the row; 400 `ADMIN_SELF_DELETION`, 404 |

`AdminUser` is `{ id, firstName, lastName, phone, status: 'active' | 'inactive', lastLoginAt, createdAt }`.

Error codes the UI switches on: `OTP_RATE_LIMITED`, `OTP_NOT_FOUND`,
`OTP_EXPIRED`, `OTP_INVALID`, `OTP_LOCKED`, `VALIDATION_ERROR`,
`UNAUTHORIZED`.

### 7.1 Server Actions (RPC)

None. The sign-in flow is plain calls from `apps/web/src/services` to
`apps/api`, because the session cookies are set by the API and the browser
reaches it on the same origin.

---

## 8. Validation Rules

Written once in `packages/validation` (`auth.ts`, `onboarding.ts`, `questionnaire.ts`, `account.ts`, `admin.ts`); the forms and the API parse
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
and a check. Success is green, destructive red, warning amber. (Two exceptions:
onboarding stage 1 — its checkboxes, selected chips and selected cards are
violet by product decision — and the questionnaire's selected answers,
which predate this rule and still use a brand tint.) Basic info's gender
segments follow the rule: the chosen one takes a foreground border and a
check. Secondary links and buttons («ویرایش شماره», «ارسال دوباره‌ی کد») are
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
- **Feedback.** A field's own problem is written under the field
  (`FormMessage`); anything else — a network failure, a rate limit, a save
  that did not land — is a toast. Error toasts are a soft red and success
  toasts a soft green (`--destructive-soft*` / `--success-soft*`, each text
  colour above 4.5:1 on its tint, in both themes); other toasts stay neutral.
  Toasts are set in the app font at 14px, sit at the top of the column 16px
  in from its edges at every width, and never span past it.
- Motion is `tailwindcss-animate`'s fade and slide, 150–300ms, plus one shake
  on a wrong code and the
  200ms `Accordion` open/close (`animate-accordion-down` / `-up`).
  Everything honours `prefers-reduced-motion`.
- Top-level screens (home, profile) end in `BottomNav` — خانه and پروفایل —
  instead of a footer; a screen one step down has a back control instead.
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
| Final logo and app icons | Done | Owl mark from `assets/brand/hamdastan-logo.svg`; see §9.3 |
| Final Welcome artwork | Done | Animated WebP at `apps/web/public/images/brand/welcome-hero.webp` (source in `assets/illustrations/`), with a still first frame for reduced motion |
| Onboarding stage 3 (avatar) | High | Intro, stage 1 (interests) and stage 2 (questionnaire) are built; the result screen goes home until stage 3 exists |
| Matching on the social profile | High | The profile, roles, availability and conflict sensitivities are stored; nothing reads them yet |
| Confirm questionnaire scoring v1 | High | Check the v1 choices in §4.2 against the scoring spec; bump `social-matching-v1` if they change |
| Home screen | High | Carries the questionnaire mission and the story-world picker |
| Read the account settings | Medium | `notifications` and `showSocialProfile` are stored; nothing reads them until notifications and other people's profiles exist |
| Level-gated avatar items | Low | `unlockLevel` is enforced by the API; the dress-up studio is gone and no item uses it |
| «ساخت آواتار» mission | Low | No longer reachable — there is no avatar screen. Earned XP and «خوش‌استایل» badges stay; missions are not listed on the profile |
| More missions | Medium | Add to `MISSIONS`; a mission beyond the three one-offs records `source_type = 'mission'` with its id |
| Worlds, play, community, commerce | Medium | Module skeletons exist on both sides |
| Admin sign-in and user management | Done | OTP sign-in limited to active admins; create, edit, (de)activate and delete at `/users` in `apps/admin` — see §4.6 |
| Serve `apps/admin` in production | Medium | The container builds, but nginx does not route to it yet; it runs at `localhost:3001` |
| Admin roles and permissions | Low | Every active admin can do everything; add roles when there is a second kind of operator |
