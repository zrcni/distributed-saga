import { InMemorySagaLog } from "../InMemorySagaLog"

describe("InMemorySagaLog", () => {
  it("add new saga to the log", async () => {
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result1 = await coordinator.createSaga("mock id", "mock data")
    expect(result1).toBeOkResult()

    const result2 = await coordinator.log.getActiveSagaIds()
    expect(result2).toBeOkResult()
    expect(result2.data).toEqual(["mock id"])
  })
})
