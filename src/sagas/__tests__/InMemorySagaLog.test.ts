import { InMemorySagaLog } from "../InMemorySagaLog"
import { Saga } from "../Saga"

describe("InMemorySagaLog", () => {
  it("add new saga to the log", async () => {
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result1 = await coordinator.createSaga("mock id", "mock data")
    expect(result1).toBeInstanceOf(Saga)

    const result2 = await coordinator.log.getActiveSagaIds()
    expect(result2).toEqual(["mock id"])
  })
})
