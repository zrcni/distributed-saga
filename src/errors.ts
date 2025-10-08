export interface AppErrorJSON<D = unknown, M = unknown> {
  name: string
  message: string
  data: D
  metadata: M
}

export class AppError<D = unknown, M = unknown> extends Error {
  private _data: D
  private _metadata: M

  constructor(message?: string, data?: D, metadata?: M) {
    super(message)
    this._data = data
    this._metadata = metadata
  }

  toJSON(): AppErrorJSON<D, M> {
    return {
      name: this.constructor.name,
      message: this.message,
      data: this.data,
      metadata: this.metadata,
    }
  }

  get data() {
    return this._data
  }

  get metadata() {
    return this._metadata
  }
}

export class UnexpectedError extends AppError {}
export class ValidationError extends AppError {}
export class NotFoundError extends AppError {}
export class ConflictError extends AppError {}
export class TimeoutError extends AppError {}

export class InvalidSagaMessageError extends AppError {}
export class InvalidSagaStateError extends AppError {}
export class InvalidSagaStateUpdateError extends AppError {}
export class SagaNotRunningError extends AppError {}
export class SagaAlreadyRunningError extends AppError {}

export class InvoiceNotFoundError extends NotFoundError {}
export class InvoiceCancelledError extends ConflictError {}

export function appErrorStatusCode(err: AppError | Error) {
  if (err instanceof ValidationError) {
    return 400
  }
  if (err instanceof NotFoundError) {
    return 404
  }
  if (err instanceof ConflictError) {
    return 409
  }
  if (err instanceof TimeoutError) {
    return 408
  }
  if (err instanceof InvalidSagaMessageError) {
    return 400
  }
  if (err instanceof InvalidSagaStateError) {
    return 400
  }
  if (err instanceof InvalidSagaStateUpdateError) {
    return 400
  }
  if (err instanceof SagaNotRunningError) {
    return 400
  }
  if (err instanceof SagaAlreadyRunningError) {
    return 400
  }
  if (err instanceof UnexpectedError) {
    return 500
  }

  return 500
}
