# External SMS integration

No SMS gateway is contracted, and nothing in this repository talks to one. This
is the seam it plugs into.

Two things in the product send a message, and both leave through here:

| | |
| --- | --- |
| A one-time code | the product's passwordless sign-in — [auth-flow.md](./auth-flow.md) |
| An admin's credentials | a new admin account, or a password reset — [admin-auth-flow.md](./admin-auth-flow.md) |

---

## The boundary

The front-end never reaches an external service. It calls `apps/api`, and
`apps/api` calls the gateway:

```
browser ──→ apps/api ──→ SMS gateway
```

Nothing in `apps/web` or `apps/admin` may hold a gateway credential or a
gateway URL — `npm run lint` refuses network calls from the React tree for this
reason, and the only egress is `src/services`, which talks to our own backend.

---

## One gateway, two kinds of message

```
integrations/
├── sms/                    the gateway capability — the only place a vendor is named
│   ├── sms-provider.ts       SmsProvider, SmsMessage, SmsDeliveryError
│   ├── mock-sms-provider.ts  logs the message, keeps an outbox
│   └── index.ts              smsProvider(), chosen by SMS_PROVIDER
└── otp/                    one-time codes, as a template over sms/
    ├── otp-provider.ts       OtpProvider, OtpMessage, OtpDeliveryError
    ├── sms-otp-provider.ts   renders the Persian template, delegates to sms/
    └── index.ts              otpProvider()
```

`otp/` is **not** a second gateway. It composes a code into a message and hands
it to `sms/`, which means contracting a vendor is one adapter to write rather
than one per message type. Admin credentials skip the `otp/` layer entirely:
`admin-users.service.ts` composes its own message — the wording is a business
decision — and calls `smsProvider()` directly.

### The contract

`apps/api/src/integrations/sms/sms-provider.ts`:

```ts
export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;   // { phone, text, purpose }
}
```

Deliberately narrow. A provider delivers text to a number and reports whether it
managed to. It composes nothing, decides nothing, and knows nothing about users,
codes or passwords — those are the calling service's decisions, and keeping them
there is what lets the vendor change without the rules changing.

`purpose` is `'OTP' | 'ADMIN_CREDENTIALS'`: it labels the message in the log and
is what a future per-template sender ID or cost report would key on.

### Failure is the caller's decision

A provider reports a refusal by rejecting with `SmsDeliveryError`. What that
means is not the provider's business, and the two callers answer differently:

| Caller | On failure |
| --- | --- |
| `auth.service.ts` (a code) | `502 OTP_DELIVERY_FAILED`. Nothing is persisted, so the user may retry immediately. |
| `admin-users.service.ts` (credentials) | The account is created anyway, and the response says `smsDelivered: false`. The account exists and its password can be reset; failing the request would leave an admin who half-exists because a gateway was down. |

`sms-otp-provider.ts` translates `SmsDeliveryError` into `OtpDeliveryError` at
the boundary, so `modules/auth` still depends only on the OTP capability.

---

## What exists today

`mock-sms-provider.ts` writes the message to the log instead of sending it, and
keeps the last fifty in an in-memory outbox. The outbox is a development
affordance: the tests read a code or a temporary password out of it, which is
the one thing in those tests a real client could not do. It holds no auth state
— the only thing it knows is what it was handed to deliver.

`index.ts` binds one by environment:

```ts
const providers = { mock: () => mockSmsProvider };
export function smsProvider(): SmsProvider {
  return providers[env.SMS_PROVIDER]();
}
```

### Walking the flows without a gateway

Two flags, each scoped to one flow, each forced off in production:

| Flag | What it echoes | Read by |
| --- | --- | --- |
| `SHOW_DEV_OTP` | the one-time code, on the challenge response | the verify screen, and the e2e tests |
| `SHOW_DEV_CREDENTIALS` | a generated temporary password, on the create/reset response | the panel's credentials dialog |

`env.showDevOtp` and `env.showDevCredentials` in `config/env.ts` are
`FLAG && !isProduction`, so production cannot switch either on whatever the
environment says. Neither is ever stored: the echo is attached to the response
that generated the value, and what goes into a record is only ever a hash.

---

## Adding a real gateway

1. Write `<vendor>-sms-provider.ts` beside the mock, implementing `SmsProvider`.
   Throw `SmsDeliveryError` on a refusal; let genuine bugs throw as themselves.
2. Add it to the map in `index.ts` and to the `SMS_PROVIDER` enum in
   `config/env.ts`, so an unknown value fails at boot rather than at the first
   sign-in.
3. Put its credentials in the environment and parse them in `config/env.ts`.
   Never in the front-end, never in `packages/`.
4. Set `SMS_PROVIDER=<vendor>`, `SHOW_DEV_OTP=false` and
   `SHOW_DEV_CREDENTIALS=false`.

Nothing in `modules/auth`, `modules/admin-users` or `integrations/otp` changes.
Both services already depend on the capability rather than the vendor, which is
the whole point of the seam.

### Worth settling before it goes live

- **Timeouts and retries.** The mock cannot fail, so no policy has been
  written. A real gateway needs a request timeout and a decision about whether
  a retry is the provider's job or the caller's.
- **Delivery reports.** If the vendor offers them, receiving one needs a route
  and a place to put the result — neither exists. It matters more for
  credentials than for codes: `smsDelivered: true` today means "the gateway
  accepted it", not "it arrived".
- **Cost as a rate-limit input.** `OTP_MAX_SENDS` is a per-number limit. It is
  not a spend cap, and an abusive volume of distinct numbers is not currently
  bounded. Admin credentials are not rate-limited at all — they are sent only
  by an authenticated admin with `users.create` or `users.reset_password`, which
  is the control.
- **Message templates and sender ID.** The mock has neither. Two templates
  exist in code (`sms-otp-provider.ts` and `admin-users.service.ts`); a vendor
  that requires pre-registered templates will want them named rather than
  composed.
