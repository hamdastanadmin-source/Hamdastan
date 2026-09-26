/**
 * The error vocabulary of the API.
 *
 * A service throws one of these; the error handler in `middleware/` turns it
 * into the `ApiFailure` shape from `@hamdastan/types`. Nothing below the
 * middleware ever writes a status code by hand.
 */

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'ورودی نامعتبر است', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * A rejected request whose reason the client has to tell apart from other
 * rejections — so, like `TooManyRequestsError`, the code comes first. Use
 * `ValidationError` for a malformed body; this is for a body that parsed and
 * still cannot be honoured.
 */
export class BadRequestError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'برای این درخواست باید وارد شوید') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/**
 * A rejected sign-in whose reason the client has to tell apart from a missing
 * session — the admin login form shows a wrong password differently from an
 * expired one. Like `TooManyRequestsError`, the code comes first.
 */
export class AuthenticationFailedError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  /** `code` narrows the refusal where the client reacts to the reason. */
  constructor(message = 'اجازهٔ دسترسی به این بخش را ندارید', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  /**
   * Rate limits are told apart by their code, not their message — the UI
   * reacts differently to a resend cooldown and to a locked-out code — so the
   * code comes first here rather than being fixed per class.
   */
  constructor(code: string, message: string, details?: unknown) {
    super(429, code, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'موردی یافت نشد') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'این مورد از قبل وجود دارد') {
    super(409, 'CONFLICT', message);
  }
}

/** A service this API depends on failed, and the failure is not the caller's. */
export class UpstreamUnavailableError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(502, code, message, details);
  }
}

/**
 * Thrown when a repository is called before any data layer has been bound to
 * it. It is the expected state of a fresh checkout, not a bug — see
 * `shared/repository.ts`.
 */
export class DataLayerNotConfiguredError extends AppError {
  constructor(moduleName: string) {
    super(
      501,
      'DATA_LAYER_NOT_CONFIGURED',
      `No data layer is bound to the "${moduleName}" repository yet. ` +
        `Call set${moduleName[0].toUpperCase()}${moduleName.slice(1)}Repository() during boot.`
    );
  }
}
