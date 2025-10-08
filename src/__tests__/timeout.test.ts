import { TimeoutError } from "@/errors"
import { timeout, wait } from "@/utils"

describe("timeout", () => {
  it("don't time out when promise takes less than timeout", async () => {
    const result = await timeout(
      wait(5).then(() => "ok"),
      10
    )
    expect(result).toBe("ok")
  })

  it("time out when promise takes longer than timeout", async () => {
    expect.assertions(1)
    try {
      await timeout(wait(10), 5)
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError)
    }
  })
})
