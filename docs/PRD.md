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
| **Onboarding (آنبوردینگ)** | The introduction that follows basic info. Not yet built. |
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

### 4.2 Onboarding, Home, Worlds, Play, Community, …

Skeletons. Each has a directory under `apps/web/src/features` and a module
under `apps/api/src/modules`, and each returns 501 until its repository is
bound. `/onboarding` and `/` render placeholder screens so the routing table
has real destinations.

---

## 5. User Flows

### 5.1 The routing table

Evaluated on **every** request by `apps/web/src/proxy.ts`, from the `nextStep`
that `GET /me` returns.

| State | Destination |
|-------|-------------|
| Not signed in | `/welcome` |
| Signed in, profile incomplete | `/auth/basic-info` |
| Signed in, onboarding unfinished | `/onboarding` |
| Signed in, everything complete | `/` |

An unfinished account is pinned to its step: it is the only page it can be on.
A finished one may go anywhere except back through `/welcome`, `/auth/*`.

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
- **`v2_otp_challenges`** — keyed by phone, so at most one live code per
  number: issuing a code replaces the row, which is what invalidates the last
  one. Stores `sha256(phone:code)` and never the code.
- **`v2_otp_sends`** — kept apart from the challenge because the challenge is
  overwritten on every send and the limits have to count sends it no longer
  remembers; and because one limit counts by IP, which is not a property of a
  phone number.
- **`v2_sessions`** — a sign-in as one long-lived thing. Tokens come and go
  inside it; revoking the session kills every token at once.
- **`v2_refresh_tokens`** — each may be spent exactly once. A spent token
  presented again is a replay, and the service revokes the whole session on it.

The schema is `database/migrations/0001_users_profile_and_sessions.sql`.

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

Written once in `packages/validation/auth.ts`; the forms and the API parse
against the same objects, including the Persian messages.

| Field | Rule | Message |
|-------|------|---------|
| Mobile | `09…`, `9…`, `+98…`, `0098…` accepted; normalised to `09XXXXXXXXX` | «شماره موبایل معتبر نیست» |
| First name | 2–30 characters, Persian letters, space and ZWNJ | «نام رو به فارسی وارد کن» |
| Last name | 2–40, same rule | «نام خانوادگی رو به فارسی وارد کن» |
| Birth date | A real Jalali date; age 13–80 | «تاریخ تولد رو کامل انتخاب کن» |
| Gender | `male` / `female` / `other` | «یکی از گزینه‌ها رو انتخاب کن» |
| OTP | Exactly 6 digits | «کد اشتباهه، دوباره امتحان کن» |

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
  column (`--gradient-shell-glow`), drawn by `MobileShell`. Screens do not add
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
| Onboarding steps | High | `/onboarding` is a placeholder destination today |
| Home screen | High | `/` is a placeholder |
| Worlds, play, community, commerce | Medium | Module skeletons exist on both sides |
| Move admin sign-in into `apps/api` | Medium | `apps/admin` still has its own story |
