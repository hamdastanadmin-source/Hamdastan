# External SMS integration

No SMS gateway is contracted, and nothing in this repository talks to one. This
is the seam it plugs into.

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

## The contract

`apps/api/src/integrations/otp/otp-provider.ts`:

```ts
export interface OtpProvider {
  readonly name: string;
  send(message: OtpMessage): Promise<void>;   // { phone, code, expiresInSeconds }
}
```

It is deliberately narrow. A provider delivers a message and reports whether it
managed to. It does not generate the code, decide when it expires, or know
anything about users — those are `auth.service.ts`'s decisions, and keeping
them there is what lets the vendor change without the rules changing.

Failure is reported by rejecting with `OtpDeliveryError`. The service turns
that into `502 OTP_DELIVERY_FAILED` and — because nothing is persisted until
delivery succeeds — leaves the user free to retry immediately.

---

## What exists today

`mock-otp-provider.ts` writes the code to the log instead of sending it, and
keeps the last twenty messages in memory so the tests can read a code they did
not generate. It holds no auth state; the only thing it knows is what it was
handed to deliver.

`index.ts` binds one by environment:

```ts
const providers = { mock: () => mockOtpProvider };
export function otpProvider(): OtpProvider {
  return providers[env.OTP_PROVIDER]();
}
```

---

## Adding a real gateway

1. Write `<vendor>-otp-provider.ts` beside the mock, implementing `OtpProvider`.
   Throw `OtpDeliveryError` on a refusal; let genuine bugs throw as themselves.
2. Add it to the map in `index.ts` and to the `OTP_PROVIDER` enum in
   `config/env.ts`, so an unknown value fails at boot rather than at the first
   sign-in.
3. Put its credentials in the environment and parse them in `config/env.ts`.
   Never in the front-end, never in `packages/`.
4. Set `OTP_PROVIDER=<vendor>` and `SHOW_DEV_OTP=false`.

Nothing in `modules/auth` changes. The service already depends on the
capability rather than the vendor, which is the whole point of the seam.

### Worth settling before it goes live

- **Timeouts and retries.** The mock cannot fail, so no policy has been
  written. A real gateway needs a request timeout and a decision about whether
  a retry is the provider's job or the user's.
- **Delivery reports.** If the vendor offers them, receiving one needs a route
  and a place to put the result — neither exists.
- **Cost as a rate-limit input.** `OTP_MAX_SENDS` is a per-number limit. It is
  not a spend cap, and an abusive volume of distinct numbers is not currently
  bounded.
- **Message template and sender ID.** The mock has neither.
