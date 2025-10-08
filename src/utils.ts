import { TimeoutError } from "./errors"
import * as _uuid from "uuid"

export const uuid = _uuid.v4

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let handled = false

  return Promise.race([
    promise.then((result) => {
      handled = true
      return result
    }),
    wait(ms).then(() => {
      if (!handled) {
        throw new TimeoutError("timed out", {
          ms,
        })
      }
    }),
  ]) as Promise<T>
}
