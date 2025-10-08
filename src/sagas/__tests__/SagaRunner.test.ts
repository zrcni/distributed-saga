import { start } from "../saga-definition"
import { SagaRunner } from "../SagaRunner"
import { InMemorySagaLog } from "../InMemorySagaLog"

describe("SagaRunner", () => {
  const step1Invoke = jest.fn()
  const step1Compensate = jest.fn()
  const step2Invoke = jest.fn()
  const step2Compensate = jest.fn()
  const step3Invoke = jest.fn()
  const step3Compensate = jest.fn()

  const testSagaDefinition = start()
    .invoke(step1Invoke)
    .compensate(step1Compensate)
    .withName("step1")
    .next()
    .invoke(step2Invoke)
    .compensate(step2Compensate)
    .withName("step2")
    .next()
    .invoke(step3Invoke)
    .compensate(step3Compensate)
    .withName("step3")
    .end()

  beforeEach(() => jest.clearAllMocks())

  /**
   * all steps are invoked and complete successfully
   * none are compensated
   */
  it("run all steps successfully", async () => {
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    await new SagaRunner(saga, testSagaDefinition).run()

    expect(step1Invoke).toHaveBeenCalled()
    expect(step2Invoke).toHaveBeenCalled()
    expect(step3Invoke).toHaveBeenCalled()

    expect(step1Compensate).not.toHaveBeenCalled()
    expect(step2Compensate).not.toHaveBeenCalled()
    expect(step3Compensate).not.toHaveBeenCalled()
  })

  /**
   * when step2 fails
   * step3 will not be invoked
   * step1 is compensated
   */
  it("compensate previous steps when a step fails", async () => {
    step2Invoke.mockRejectedValue(new Error("mock error"))

    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    await new SagaRunner(saga, testSagaDefinition).run()

    expect(step1Invoke).toHaveBeenCalled()
    expect(step2Invoke).toHaveBeenCalled()
    expect(step3Invoke).not.toHaveBeenCalled()

    expect(step1Compensate).toHaveBeenCalled()
    expect(step2Compensate).not.toHaveBeenCalled()
    expect(step3Compensate).not.toHaveBeenCalled()
  })
})
