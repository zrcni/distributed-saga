export class Result<D = unknown> {
  data: D

  constructor(data: D) {
    this.data = data
  }

  isError(): this is ResultError {
    return this instanceof ResultError
  }

  isOk(): this is ResultOk {
    return this instanceof ResultOk
  }

  toJSON() {
    return {
      isError: this.isError,
      isOk: this.isOk,
      data: this.data,
    }
  }

  static ok<D = unknown>(data?: D) {
    return new ResultOk(data)
  }

  static error<D = unknown>(data: D) {
    return new ResultError(data)
  }
}

export class ResultOk<D = unknown> extends Result<D> {}

export class ResultError<D = Error> extends Result<D> {}
