export {}

declare global {
  /** 'YYYY-MM-DD' */
  type DateOfYear = string

  namespace jest {
    interface Matchers<R> {
      toBeOkResult(): R
      toBeErrorResult(): R
    }
  }
}
