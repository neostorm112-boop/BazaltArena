export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  readonly status: number
  readonly code: AppErrorCode
  readonly details?: unknown

  constructor(status: number, code: AppErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, 'UNAUTHORIZED', message)
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(403, 'FORBIDDEN', message)
  }
  static notFound(message = 'Not found') {
    return new AppError(404, 'NOT_FOUND', message)
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message)
  }
  static validation(message: string, details?: unknown) {
    return new AppError(400, 'VALIDATION_ERROR', message, details)
  }
  static invalidCredentials() {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
  }
  static internal(message = 'Internal server error') {
    return new AppError(500, 'INTERNAL_ERROR', message)
  }
}
