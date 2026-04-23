/**
 Status Codes Required
 ======================
 400-Bad Request
 401-Unauthorised
 403-Forbidden
 404-Not found
 409-Conflict
 418-I'm a Teapot
 422-Unprocessable Entity
 429-Too Many Requests
 500-Internal Server Error
 =======================
 Remaining status can be implemented additionally

 -Aki
 last change: 29/03/26
 **/

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    if ("captureStackTrace" in Error) {
      const ctor = this.constructor as typeof AppError;
      Error.captureStackTrace(this, ctor);
    }
  }
}

// ====================== 4xx ==========================

/*  400 - Bad Request  */ export class BadRequestError extends AppError {
  details?: object;
  constructor(message = "Bad Request", details?: object) {
    super(message, 400);
    this.details = details;
  }
}

/*  401 - Unauthorised  */
export class UnauthorisedError extends AppError {
  constructor(message = "Unauthorised") {
    super(message, 401);
  }
}

/*  403 - Forbidden  */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

/*  404 - Not Found  */
export class NotFoundError extends AppError {
  constructor(message = "Resource Not Found") {
    super(message, 404);
  }
}

/*  409 - Conflict  */
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

/*  418 - I'm a Teapot  */
export class TeaPotError extends AppError {
  constructor(message = "I'm a teapot :)") {
    super(message, 418);
  }
}

/*  422 - Unprocessable Entity  */
export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable Entity") {
    super(message, 422);
  }
}

/*  429 - Too Many Requests  */
export class TooManyRequestsError extends AppError {
  constructor(message = "Too Many Requests") {
    super(message, 429);
  }
}

// ====================== 5xx ==========================

/*  500 - Internal Server Error  */
export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, 500);
  }
}
