import { SagaBuilder } from "../saga-definition"
import { SagaOrchestrator } from "../SagaOrchestrator"
import { InMemorySagaLog } from "../InMemorySagaLog"

describe("SagaOrchestrator", () => {
  const step1Invoke = jest.fn()
  const step1Compensate = jest.fn()
  const step2Invoke = jest.fn()
  const step2Compensate = jest.fn()
  const step3Invoke = jest.fn()
  const step3Compensate = jest.fn()

  const testSagaDefinition = SagaBuilder.start()
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

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock implementations
    step1Invoke.mockResolvedValue(undefined)
    step2Invoke.mockResolvedValue(undefined)
    step3Invoke.mockResolvedValue(undefined)
  })

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
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, testSagaDefinition)

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
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, testSagaDefinition)

    expect(step1Invoke).toHaveBeenCalled()
    expect(step2Invoke).toHaveBeenCalled()
    expect(step3Invoke).not.toHaveBeenCalled()

    expect(step1Compensate).toHaveBeenCalled()
    expect(step2Compensate).not.toHaveBeenCalled()
    expect(step3Compensate).not.toHaveBeenCalled()
  })

  /**
   * when a saga is recovered after server crash during step execution
   * the started but not completed step should be retried
   */
  it("retry step that was started but not completed during recovery", async () => {
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data

    // Simulate step1 completing successfully
    await saga.startTask("step1")
    await saga.endTask("step1", "step1 result")

    // Simulate step2 starting but not completing (server crash scenario)
    await saga.startTask("step2")
    // Note: step2.endTask is NOT called


    // Now recover the saga on another server
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, testSagaDefinition)

    // step1 should not be invoked again (already completed)
    expect(step1Invoke).not.toHaveBeenCalled()
    
    // step2 should be invoked (retry the incomplete task)
    expect(step2Invoke).toHaveBeenCalled()
    
    // step3 should be invoked (continue after step2)
    expect(step3Invoke).toHaveBeenCalled()

    expect(step1Compensate).not.toHaveBeenCalled()
    expect(step2Compensate).not.toHaveBeenCalled()
    expect(step3Compensate).not.toHaveBeenCalled()
  })

  /**
   * when a step has middleware functions
   * they should be called before the step is invoked
   */
  it("run middleware before step execution", async () => {
    const middleware1 = jest.fn()
    const middleware2 = jest.fn()
    
    const sagaDefWithMiddleware = SagaBuilder.start()
      .invoke(step1Invoke)
      .compensate(step1Compensate)
      .withName("step1")
      .next()
      .invoke(step2Invoke)
      .compensate(step2Compensate)
      .withName("step2")
      .withMiddleware(middleware1)
      .withMiddleware(middleware2)
      .next()
      .invoke(step3Invoke)
      .compensate(step3Compensate)
      .withName("step3")
      .end()

    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDefWithMiddleware)

    expect(middleware1).toHaveBeenCalledWith("mock data", null, {}, { sagaId: "test id", parentSagaId: null, parentTaskId: null })
    expect(middleware2).toHaveBeenCalledWith("mock data", null, {}, { sagaId: "test id", parentSagaId: null, parentTaskId: null })
    expect(step1Invoke).toHaveBeenCalled()
    expect(step2Invoke).toHaveBeenCalled()
    expect(step3Invoke).toHaveBeenCalled()
  })

  /**
   * when a middleware function throws an error
   * the step should not be invoked and saga should be compensated
   */
  it("abort saga when middleware fails with error", async () => {
    const middleware = jest.fn().mockRejectedValue(new Error("middleware error"))
    
    const sagaDefWithMiddleware = SagaBuilder.start()
      .invoke(step1Invoke)
      .compensate(step1Compensate)
      .withName("step1")
      .next()
      .invoke(step2Invoke)
      .compensate(step2Compensate)
      .withName("step2")
      .withMiddleware(middleware)
      .next()
      .invoke(step3Invoke)
      .compensate(step3Compensate)
      .withName("step3")
      .end()

    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDefWithMiddleware)

    expect(middleware).toHaveBeenCalled()
    expect(step1Invoke).toHaveBeenCalled()
    expect(step2Invoke).not.toHaveBeenCalled()
    expect(step3Invoke).not.toHaveBeenCalled()

    // step1 should be compensated
    expect(step1Compensate).toHaveBeenCalled()
    expect(step2Compensate).not.toHaveBeenCalled()
    expect(step3Compensate).not.toHaveBeenCalled()
  })

  /**
   * when a middleware function returns false
   * the step should not be invoked and saga should be compensated
   */
  it("abort saga when middleware returns false", async () => {
    const middleware = jest.fn().mockReturnValue(false)
    
    const sagaDefWithMiddleware = SagaBuilder.start()
      .invoke(step1Invoke)
      .compensate(step1Compensate)
      .withName("step1")
      .next()
      .invoke(step2Invoke)
      .compensate(step2Compensate)
      .withName("step2")
      .withMiddleware(middleware)
      .next()
      .invoke(step3Invoke)
      .compensate(step3Compensate)
      .withName("step3")
      .end()

    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDefWithMiddleware)

    expect(middleware).toHaveBeenCalled()
    expect(step1Invoke).toHaveBeenCalled()
    expect(step2Invoke).not.toHaveBeenCalled()
    expect(step3Invoke).not.toHaveBeenCalled()

    // step1 should be compensated
    expect(step1Compensate).toHaveBeenCalled()
    expect(step2Compensate).not.toHaveBeenCalled()
    expect(step3Compensate).not.toHaveBeenCalled()
  })

  /**
   * middleware should receive previous step result
   */
  it("pass previous step result to middleware", async () => {
    const middleware = jest.fn()
    step1Invoke.mockResolvedValue("step1 result")
    
    const sagaDefWithMiddleware = SagaBuilder.start()
      .invoke(step1Invoke)
      .compensate(step1Compensate)
      .withName("step1")
      .next()
      .invoke(step2Invoke)
      .compensate(step2Compensate)
      .withName("step2")
      .withMiddleware(middleware)
      .next()
      .invoke(step3Invoke)
      .compensate(step3Compensate)
      .withName("step3")
      .end()

    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDefWithMiddleware)

    expect(middleware).toHaveBeenCalledWith("mock data", "step1 result", {}, { sagaId: "test id", parentSagaId: null, parentTaskId: null })
    expect(step2Invoke).toHaveBeenCalledWith("mock data", "step1 result", {}, { sagaId: "test id", parentSagaId: null, parentTaskId: null })
  })

  /**
   * middleware should accumulate returned data
   */
  it("accumulate and pass middleware data", async () => {
    const middleware1 = jest.fn(async () => ({ key1: "value1" }))
    const middleware2 = jest.fn(async (data, prevResult, middlewareData) => {
      expect(middlewareData).toEqual({ key1: "value1" })
      return { key2: "value2" }
    })
    const step2Invoke = jest.fn()

    const sagaDefWithMiddleware = SagaBuilder.start()
      .invoke(step1Invoke)
      .compensate(step1Compensate)
      .withName("step1")
      .next()
      .invoke(step2Invoke)
      .compensate(step2Compensate)
      .withName("step2")
      .withMiddleware(middleware1)
      .withMiddleware(middleware2)
      .next()
      .invoke(step3Invoke)
      .compensate(step3Compensate)
      .withName("step3")
      .end()

    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test id", "mock data")
    expect(result).toBeOkResult()
    if (result.isError()) return
    const saga = result.data
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDefWithMiddleware)

    expect(middleware1).toHaveBeenCalled()
    expect(middleware2).toHaveBeenCalled()
    expect(step2Invoke).toHaveBeenCalledWith(
      "mock data", 
      null, 
      {
        key1: "value1",
        key2: "value2",
      },
      { sagaId: "test id", parentSagaId: null, parentTaskId: null }
    )
  })
})

