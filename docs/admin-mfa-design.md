# Admin MFA — design and plan

Status: **proposed, not built.** Needs approval before implementation.

## Why

The admin panel signs in with a one-time code by SMS — one factor: possession
of the phone number. That factor fails in known ways: SIM swap, interception
on the carrier network, and misconfiguration (until this release, production
returned the code in the API response). An admin can export every response,
end anyone's sessions and revoke XP, so one factor is not enough.

## Decision

| | Option | Verdict |
|---|---|---|
| 1 | **TOTP** (RFC 6238, an authenticator app) as a second factor | **Phase 1.** No new service or vendor, works offline, admins already have Google/Microsoft Authenticator. |
| 2 | **WebAuthn / passkeys** | **Phase 3.** Phishing-resistant and the stronger choice, but needs the panel on a stable public HTTPS origin, which it does not have yet (it is not routed through nginx). |
| 3 | A second SMS, or email | No — same channel weaknesses, or a new vendor. |

TOTP is implemented with `node:crypto` (HMAC-SHA1, ~40 lines) and tested
against the RFC 6238 Appendix B vectors, rather than a new dependency.

## Data model — migration `0015`

```sql
CREATE TABLE v2_admin_mfa (
  admin_id         uuid PRIMARY KEY REFERENCES v2_admin_users (id) ON DELETE CASCADE,
  -- AES-256-GCM: iv ‖ ciphertext ‖ tag. Key: ADMIN_MFA_KEY (32 bytes, base64),
  -- never in the database; key_id lets the key rotate.
  secret_enc       bytea NOT NULL,
  key_id           smallint NOT NULL,
  confirmed_at     timestamptz,          -- NULL until the first valid code
  last_used_step   bigint,               -- replay guard: a 30s step is accepted once
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE v2_admin_recovery_codes (
  admin_id  uuid NOT NULL REFERENCES v2_admin_users (id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,            -- SHA-256 of a 10-character random code
  used_at   timestamptz,
  PRIMARY KEY (admin_id, code_hash)
);

ALTER TABLE v2_admin_sessions ADD COLUMN mfa_at timestamptz;  -- for step-up (phase 2)
```

Additive, like `0011`–`0014`; rolling back the code leaves it unused.

## Flow

```
SMS code ✓ ──► enrolled? ──yes──► hd_admin_mfa (5 min, httpOnly, one use)
                  │                    └─► POST /admin/auth/mfa/verify {code}
                  │                              ✓ ──► hd_admin session
                  no ──► policy requires? ──yes──► hd_admin_mfa (enrol only)
                              │                    ├─► POST /admin/auth/mfa/enroll        → otpauth URI (QR drawn in the panel)
                              no ──► session       └─► POST /admin/auth/mfa/enroll/confirm {code} → session + 10 recovery codes, shown once
```

- **No session before the second factor.** The pending cookie opens only the
  three MFA routes; `authenticateAdmin` refuses it everywhere else.
- **Verification:** the current step ±1 (90 s of clock skew), each step
  accepted once (`last_used_step`), five wrong codes end the pending token,
  and the per-admin rate limit applies. A recovery code can stand in for a
  TOTP code, once.
- **Reset:** a system admin (`admins.manage`) can reset another admin's MFA,
  which ends that admin's sessions and makes them enrol again — never their
  own. Audited in the log like session revocation.
- **Secrets never leave the API** except the otpauth URI during enrolment.
  The QR is rendered in the browser from the URI; no third-party QR service.

## Step-up for the most sensitive actions (phase 2)

`xp.revoke`, `admins.manage`, `sessions.manage` and `results.export` require
`mfa_at` within the last 15 minutes; otherwise `403 ADMIN_MFA_REQUIRED` and the
panel asks for a fresh code. Implemented as an option on
`requireAdminPermission(permission, { stepUp: true })`.

## Rollout

| Phase | What | Switch |
|---|---|---|
| 0 | Code shipped, off | `ADMIN_MFA_POLICY=off` |
| 1 | Enrolment offered; required for `system_admin` | `ADMIN_MFA_POLICY=system_admin` |
| 2 | Required for every role; step-up on sensitive actions | `ADMIN_MFA_POLICY=all` |
| 3 | WebAuthn/passkeys as an alternative factor, once the panel has its public origin | — |

Each phase is an environment change, so going back is too.

## Tests

RFC 6238 vectors; ±1 step accepted, ±2 refused; a step reused is refused;
five wrong codes kill the pending token; the pending cookie opens nothing but
the MFA routes; recovery codes work once; a reset ends sessions and cannot
target oneself; the secret is unreadable without `ADMIN_MFA_KEY`; a session
cannot be obtained by skipping the MFA step (every admin route, as in the
role matrix test); E2E: enrol, sign out, sign in with TOTP, with a recovery
code.

## Effort

About 3–4 days for phases 0–1 (API, panel screens, tests), 1–2 days for
phase 2. WebAuthn is a separate piece of work once the panel is served in
production.
