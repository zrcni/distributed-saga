import { SagaBuilder } from "../saga-definition/SagaBuilder"
import { InMemorySagaLog } from "../InMemorySagaLog"
import { SagaOrchestrator } from "../SagaOrchestrator"
import { Saga } from "../Saga"

describe("ReadOnlySaga in middleware callbacks", () => {
  it("should pass read-only saga to middleware callbacks", async () => {
    const task1Result = { userId: "123", created: true }
    const task2Result = { orderId: "456", status: "pending" }
    
    const task1 = jest.fn(async () => task1Result)
    const task2 = jest.fn(async () => task2Result)
    
    // Middleware should be able to read task1 data before task3 executes
    const task3Middleware = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
      // Verify saga is available
      expect(saga).toBeDefined()
      expect(saga.sagaId).toBe("test-saga-id")
      expect(typeof saga.getEndTaskData).toBe("function")
      
      // Read task1 result
      const task1Data = await saga.getEndTaskData("task1")
      expect(task1Data).toEqual(task1Result)
      
      // Check task completion
      const isTask1Completed = await saga.isTaskCompleted("task1")
      expect(isTask1Completed).toBe(true)
      
      // Return data for the step to use
      return { validatedUserId: task1Data.userId }
    })
    
    const task3 = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
      // Middleware should have added validatedUserId
      expect(middlewareData.validatedUserId).toBe("123")
      
      // Task3 can also read previous task data
      const task1Data = await saga.getEndTaskData("task1")
      const task2Data = await saga.getEndTaskData("task2")
      
      return {
        finalResult: {
          user: task1Data,
          order: task2Data,
          validated: true
        }
      }
    })
    
    const sagaDef = SagaBuilder.start()
      .invoke(task1)
      .withName("task1")
      .next()
      .invoke(task2)
      .withName("task2")
      .next()
      .invoke(task3)
      .withName("task3")
      .withMiddleware(task3Middleware)
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test-saga-id", { initial: "data" })
    if (!result.isOk()) throw new Error("Failed to create saga")
    
    const saga = result.data as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(task1).toHaveBeenCalled()
    expect(task2).toHaveBeenCalled()
    expect(task3Middleware).toHaveBeenCalled()
    expect(task3).toHaveBeenCalled()
    
    // Verify the final result
    const task3Data = await saga.getEndTaskData("task3")
    expect(task3Data).toEqual({
      finalResult: {
        user: task1Result,
        order: task2Result,
        validated: true
      }
    })
  })
  
  it("should allow middleware to check task completion before proceeding", async () => {
    const prerequisiteTask = jest.fn(async () => ({ initialized: true }))
    
    const validationMiddleware = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
      // Check if prerequisite task completed
      const isPrerequisiteComplete = await saga.isTaskCompleted("prerequisite")
      
      if (!isPrerequisiteComplete) {
        throw new Error("Prerequisite task not completed")
      }
      
      const prerequisiteData = await saga.getEndTaskData("prerequisite")
      expect(prerequisiteData.initialized).toBe(true)
      
      return { validated: true }
    })
    
    const mainTask = jest.fn(async (data, prevResult, middlewareData) => {
      expect(middlewareData.validated).toBe(true)
      return { completed: true }
    })
    
    const sagaDef = SagaBuilder.start()
      .invoke(prerequisiteTask)
      .withName("prerequisite")
      .next()
      .invoke(mainTask)
      .withName("mainTask")
      .withMiddleware(validationMiddleware)
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test-saga-id", { initial: "data" })
    if (!result.isOk()) throw new Error("Failed to create saga")
    
    const saga = result.data as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(prerequisiteTask).toHaveBeenCalled()
    expect(validationMiddleware).toHaveBeenCalled()
    expect(mainTask).toHaveBeenCalled()
  })
  
  it("should allow multiple middleware to access saga state", async () => {
    const setupTask = jest.fn(async () => ({ config: "value" }))
    
    const middleware1 = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
      const setupData = await saga.getEndTaskData("setup")
      return { fromMiddleware1: setupData.config }
    })
    
    const middleware2 = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
      // Middleware2 can see data from middleware1
      expect(middlewareData.fromMiddleware1).toBe("value")
      
      // And can also read saga state
      const setupData = await saga.getEndTaskData("setup")
      return { fromMiddleware2: setupData.config + "-processed" }
    })
    
    const finalTask = jest.fn(async (data, prevResult, middlewareData) => {
      // Final task receives accumulated middleware data
      expect(middlewareData.fromMiddleware1).toBe("value")
      expect(middlewareData.fromMiddleware2).toBe("value-processed")
      return { success: true }
    })
    
    const sagaDef = SagaBuilder.start()
      .invoke(setupTask)
      .withName("setup")
      .next()
      .invoke(finalTask)
      .withName("final")
      .withMiddleware(middleware1)
      .withMiddleware(middleware2)
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test-saga-id", { initial: "data" })
    if (!result.isOk()) throw new Error("Failed to create saga")
    
    const saga = result.data as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(setupTask).toHaveBeenCalled()
    expect(middleware1).toHaveBeenCalled()
    expect(middleware2).toHaveBeenCalled()
    expect(finalTask).toHaveBeenCalled()
  })
  
  it("should verify middleware cannot modify saga state", async () => {
    const task1 = jest.fn(async () => ({ result: "task1" }))
    
    const middleware = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
      // Verify mutation methods are not available
      expect(saga.startTask).toBeUndefined()
      expect(saga.endTask).toBeUndefined()
      expect(saga.abortSaga).toBeUndefined()
      expect(saga.endSaga).toBeUndefined()
      
      // Only read methods should be available
      expect(typeof saga.getEndTaskData).toBe("function")
      expect(typeof saga.isTaskCompleted).toBe("function")
      
      return { checked: true }
    })
    
    const task2 = jest.fn(async () => ({ result: "task2" }))
    
    const sagaDef = SagaBuilder.start()
      .invoke(task1)
      .withName("task1")
      .next()
      .invoke(task2)
      .withName("task2")
      .withMiddleware(middleware)
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const result = await coordinator.createSaga("test-saga-id", { initial: "data" })
    if (!result.isOk()) throw new Error("Failed to create saga")
    
    const saga = result.data as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(middleware).toHaveBeenCalled()
  })
})
