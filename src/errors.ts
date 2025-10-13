export interface SagaErrorJSON<D = unknown, M = unknown> {
  name: string
  message: string
  data: D
  metadata: M
}

export class SagaError<D = unknown, M = unknown> extends Error {
  private _data: D
  private _metadata: M

  constructor(message?: string, data?: D, metadata?: M) {
    super(message)
    this._data = data
    this._metadata = metadata
  }

  toJSON(): SagaErrorJSON<D, M> {
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

export class TimeoutError extends SagaError {}

export class InvalidSagaMessageError extends SagaError {}
export class InvalidSagaStateError extends SagaError {}
export class InvalidSagaStateUpdateError extends SagaError {}
export class SagaNotRunningError extends SagaError {}
export class SagaAlreadyRunningError extends SagaError {}
export class InvalidSagaDefinitionError extends SagaError {}
