# API — auth

Base path: `/api/v1/auth`. Every response is the `ApiResponse<T>` envelope from
`@hamdastan/types`:

```json
{ "ok": true,  "data": { … } }
{ "ok": false, "error": { "code": "…", "message": "…", "details": { … } } }
```

`message` is Persian and safe to show a user. **The client switches on `code`,
not on `message`** — the codes are stable, the wording is not.

Request bodies are validated in `auth.controller.ts` against the schemas in
`packages/validation/auth.ts`, the same ones the login form uses. Validation
normalises as well as checks: `+989123456789`, `۰۹۱۲۳۴۵۶۷۸۹` and
`0912 345 6789` all reach the service as `09123456789`, so one number cannot
become two accounts.

The flow these endpoints make up is described in
[../architecture/auth-flow.md](../architecture/auth-flow.md).

These are the **product's** users. The admin panel signs in with a username and
a password through a separate module — see
[admin-auth.md](./admin-auth.md) — and neither flow can sign anybody into the
other's surface.

---

## POST /auth/check-phone

Which path this number takes.

```json
{ "phone": "09123456789" }
```

**200**

```json
{ "ok": true, "data": { "registered": true } }
```

`registered: false` means the client should collect a profile before any code
is sent. The answer is deliberately plain: the product has to branch on it, so
hiding it would only move the same signal into a difference between two
screens.

---

## POST /auth/register

Holds a new user's profile and sends them a code. **It does not create a
user** — see the flow document.

```json
{
  "phone": "09123456789",
  "firstName": "امید",
  "lastName": "بهشتی",
  "birthDate": "1990-05-20",
  "gender": "MALE"
}
```

**201** — an `OtpChallenge`:

```json
{
  "ok": true,
  "data": {
    "phone": "09123456789",
    "purpose": "REGISTER",
    "expiresAt": "2026-01-01T10:02:00.000Z",
    "resendAvailableAt": "2026-01-01T10:02:00.000Z",
    "attemptsRemaining": 5,
    "devCode": "4829"
  }
}
```

`devCode` is present only when `SHOW_DEV_OTP=true` and `NODE_ENV` is not
`production`. It is absent otherwise, and production cannot enable it.

| Failure | Status | Code |
| --- | --- | --- |
| A field is missing or malformed | 400 | `VALIDATION_ERROR` |
| The number already has an account | 400 | `PHONE_ALREADY_REGISTERED` |
| A code was sent too recently | 429 | `OTP_RESEND_COOLDOWN` |
| Too many codes for this number | 429 | `OTP_RESEND_LIMIT` |

---

## POST /auth/otp/send

Sends a code — and, called again, is the resend. There is one endpoint on
purpose: a second path to a code would be a path around the cooldown.

```json
{ "phone": "09123456789" }
```

**200** — an `OtpChallenge`, as above, with `purpose` decided by the backend:
`LOGIN` for a registered number, `REGISTER` for one partway through
registration (its draft is carried forward).

| Failure | Status | Code |
| --- | --- | --- |
| Not a mobile number | 400 | `VALIDATION_ERROR` |
| No account and no registration in progress | 400 | `PHONE_NOT_REGISTERED` |
| The countdown has not finished | 429 | `OTP_RESEND_COOLDOWN` — `details.retryAfterSeconds` |
| More than `OTP_MAX_SENDS` in the window | 429 | `OTP_RESEND_LIMIT` — `details.retryAfterSeconds` |
| The account is suspended | 403 | `ACCOUNT_SUSPENDED` |
| The gateway refused the message | 502 | `OTP_DELIVERY_FAILED` — nothing was stored, so the caller may retry |

---

## POST /auth/otp/verify

The only endpoint that creates a session, and for a new user the only thing
that creates the user.

```json
{ "phone": "09123456789", "code": "4829" }
```

**200** — and `Set-Cookie: session=…; HttpOnly; SameSite=Lax; Path=/`
(`Secure` in production, `Domain` when `SESSION_COOKIE_DOMAIN` is set).

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "…",
      "phone": "09123456789",
      "firstName": "امید",
      "lastName": "بهشتی",
      "fullName": "امید بهشتی",
      "birthDate": "1990-05-20",
      "gender": "MALE",
      "role": "USER",
      "isActive": true
    }
  }
}
```

The session token is **not** in the body. It exists only in the httpOnly
cookie, out of reach of client script.

| Failure | Status | Code |
| --- | --- | --- |
| Malformed body | 400 | `VALIDATION_ERROR` |
| No live challenge — never sent, already used, or cancelled | 400 | `OTP_NOT_FOUND` |
| Wrong code | 400 | `OTP_INVALID` — `details.attemptsRemaining` |
| Past `expiresAt` | 400 | `OTP_EXPIRED` |
| Out of attempts — a new code is the only way on, and even the right code is refused | 429 | `OTP_TOO_MANY_ATTEMPTS` |
| The account is suspended | 403 | `ACCOUNT_SUSPENDED` |

---

## POST /auth/otp/cancel

Behind **ویرایش شماره**. Deletes the live challenge, so the code already in the
user's messages stops working instead of staying valid for the rest of its two
minutes. It also clears the cooldown, because there is no longer a code to
resend.

```json
{ "phone": "09123456789" }
```

**200** `{ "ok": true, "data": { "cancelled": true } }`

Cancelling a number with no challenge succeeds — the outcome asked for is
already the case.

---

## GET /auth/session

Who the session cookie belongs to. Takes no body; the cookie is the request.

**200** `{ "ok": true, "data": { "user": { … } } }`

| Failure | Status | Code |
| --- | --- | --- |
| No cookie, or a token that is unknown, expired, revoked, or belongs to a suspended user | 401 | `UNAUTHORIZED` |

Called by `apps/web` while rendering, forwarding the cookie it received. Never
cached: a stale answer here is one user seeing another's session.

---

## POST /auth/logout

Invalidates the token server-side and clears the cookie. Both matter — clearing
the cookie alone would leave a usable session behind.

**200** `{ "ok": true, "data": { "loggedOut": true } }`

Succeeds without a session, so signing out twice is not an error, and the
cookie is cleared either way so a stale one stops being retried.

---

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `OTP_TTL_SECONDS` | `120` | Code lifetime, the countdown, and the resend cooldown. |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong codes before the challenge locks. |
| `OTP_MAX_SENDS` | `5` | Codes per number per window. |
| `OTP_SEND_WINDOW_MINUTES` | `15` | Length of that window. |
| `SMS_PROVIDER` | `mock` | Which gateway adapter is bound — for codes and for admin credentials alike. |
| `SHOW_DEV_OTP` | `false` | Echo the code back in the response. Ignored in production. |
| `SESSION_MAX_AGE_DAYS` | `7` | Session and cookie lifetime. |
| `SESSION_COOKIE_DOMAIN` | *(empty)* | Host-only when empty. Set to the parent domain in production. |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Origins allowed to call with credentials. |
