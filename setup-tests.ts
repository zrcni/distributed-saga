import { Result } from "./src/Result"

expect.extend({
  toBeOkResult(received) {
    if (!(received instanceof Result)) {
      throw new Error("Value must be an instance of Result!")
    }

    if (!received.isOk()) {
      return {
        pass: false,
        message: () => `expected value not to be an instance of ResultOk`,
      }
    }

    return {
      pass: true,
      message: () =>
        `expected an instance of ResultOk, but received instance of ${this.utils.printReceived(
          received.constructor
        )}`,
    }
  },

  toBeErrorResult(received) {
    if (!(received instanceof Result)) {
      throw new Error("Value must be an instance of Result!")
    }

    if (!received.isOk()) {
      return {
        pass: false,
        message: () => `expected value not to be an instance of ResultError`,
      }
    }

    return {
      pass: true,
      message: () =>
        `expected an instance of ResultError, but received instance of ${this.utils.printReceived(
          received.constructor
        )}`,
    }
  },
})
