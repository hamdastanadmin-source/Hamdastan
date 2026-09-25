# Product Requirements Document — hamdastan

**Product:** hamdastan
**Version:** 1.0
**Last Updated:** 2026-09-25
**Status:** Active Development

---

## 1. Product Overview

<!-- Describe what this product does, who it serves, and its core value proposition. -->

### 1.1 Target Users

- **User Type 1** — Description of this user type.
- **User Type 2** — Description of this user type.

### 1.2 Core Value Proposition

- Value point 1.
- Value point 2.

### 1.3 Language & Locale

- **Primary UI Language:** Persian (Farsi) — RTL layout throughout.
- **Locale:** `fa-IR`, Timezone: `Asia/Tehran`.
- Persian numerals and date formatting are used across the interface.

---

## 2. System Architecture Summary

| Layer         | Technology                                      |
|---------------|------------------------------------------------|
| Frontend      | Next.js 16 (App Router), React 19, Tailwind 4   |
| UI            | shadcn/ui on Radix, with local RTL wrappers     |
| Backend       | Fastify 5 (`apps/api`), layered route → controller → service → repository |
| Database      | None yet — see RULES.md before adding one       |
| Auth          | Mobile number + one-time code (OTP), cookie sessions |
| Deployment    | Docker (standalone Next.js output)              |

---

## 3. Domain Terminology

| Term        | Meaning                                         |
|-------------|------------------------------------------------|
| **Term 1**  | Definition of term 1.                           |
| **Term 2**  | Definition of term 2.                           |

---

## 4. Modules & Features

### 4.1 Module Name

**Purpose:** Describe the module purpose.

**Features:**
- Feature 1.
- Feature 2.

---

## 5. User Flows

### 5.1 Sign in / sign up

There is one door into the product, at `/login`, and no passwords. Full detail
in [architecture/auth-flow.md](./architecture/auth-flow.md).

```
User opens the app
  |
  +-- enters a mobile number
  |     |
  |     +-- the backend checks whether it is registered
  |
  +-- registered ──→ a 4-digit code is sent
  |                    |
  |                    +-- enters the code  ──→ signed in
  |
  +-- not registered ─→ registration form (name, surname, date of birth in the
  |                      Jalali calendar, gender)
                         |
                         +-- a 4-digit code is sent
                              |
                              +-- enters the code ──→ account created ──→ signed in
```

On the code screen the user sees the number the code went to, a two-minute
countdown, a resend that unlocks when the countdown ends, and **ویرایش شماره**,
which cancels the code in flight and returns to the first step.

A user account exists only after a code has been verified. Submitting the
registration form on its own creates nothing.

---

## 6. Data Model

No database has been chosen, so nothing here is implemented. What is designed:

### 6.1 Entity Relationship Diagram

```
+------------+       +--------------------------+
|    User    |--1:N--|         Session          |
+------------+       +--------------------------+
      |
      | by phone number, not by key
      |
+--------------------------+
|  VerificationChallenge   |   at most one live per number
+--------------------------+
```

### 6.2 Key Relationships

- A **User** has many **Sessions**; deleting the user ends all of them.
- A **VerificationChallenge** belongs to a phone *number*, not to a user — a
  code is issued before an account exists, which is what lets registration
  require a verified phone.

Fields, constraints, indexes and the lifecycle of each entity are in
[architecture/auth-data-model.md](./architecture/auth-data-model.md). Nothing
outside authentication is designed yet.

---

## 7. API Endpoints

### 7.1 REST API Routes

`apps/api`, mounted under `/api/v1`. Reference:
[api/auth.md](./api/auth.md).

| Method | Endpoint                 | Description                                  |
|--------|--------------------------|----------------------------------------------|
| GET    | `/health`                | Liveness probe, outside the version prefix   |
| POST   | `/api/v1/auth/check-phone` | Is this number registered?                 |
| POST   | `/api/v1/auth/register`  | Hold a new user's profile, send a code       |
| POST   | `/api/v1/auth/otp/send`  | Send a code — and, called again, the resend  |
| POST   | `/api/v1/auth/otp/verify`| Verify a code: creates the session           |
| POST   | `/api/v1/auth/otp/cancel`| Cancel the code in flight (ویرایش شماره)     |
| GET    | `/api/v1/auth/session`   | Who the session cookie belongs to            |
| POST   | `/api/v1/auth/logout`    | Invalidate the session                       |

Every other module (`users`, `worlds`, `content`, …) is mounted and empty.

### 7.2 Server Actions (RPC)

None. The front-end reaches the backend through `src/services` over HTTP, so
there is one request path rather than two.

---

## 8. UI Component System

### 8.1 Design Tokens

| Token          | Value                          |
|----------------|--------------------------------|
| Brand Color    | `#000080` navy — `--brand-hue: 240`, `--brand-lightness: 25%` |
| Font Family    | Yekan Bakh (Persian typeface)  |
| Theme          | Dark mode (default)            |
| Calendar       | Jalali in the UI, ISO Gregorian on the wire |
| Layout         | RTL                            |
| Framework      | Tailwind CSS v4 + CVA variants |
| Components     | shadcn/ui (new-york style)     |

---

## 9. Non-Functional Requirements

- **Performance:** Describe performance targets.
- **Reliability:** Describe reliability expectations.
- **Scalability:** Describe scalability approach.
- **Security:** Describe security measures.

---

## 10. Roadmap

| Feature          | Priority | Notes                    |
|------------------|----------|--------------------------|
| Feature 1        | High     | Description              |
| Feature 2        | Medium   | Description              |
