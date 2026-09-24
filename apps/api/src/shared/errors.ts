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

export class UnauthorizedError extends AppError {
  constructor(message = 'برای این درخواست باید وارد شوید') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'اجازهٔ دسترسی به این بخش را ندارید') {
    super(403, 'FORBIDDEN', message);
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
