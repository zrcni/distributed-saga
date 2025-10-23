import { SagaBuilder } from "../saga-definition/SagaBuilder"
import { InMemorySagaLog } from "../InMemorySagaLog"
import { SagaOrchestrator } from "../SagaOrchestrator"
import { Saga } from "../Saga"

describe("ReadOnlySaga in callbacks", () => {
  it("should allow step callbacks to read other tasks data and results", async () => {
    const task1Result = { userId: "123", action: "created" }
    const task2Result = { orderId: "456", status: "pending" }
    
    const task1 = jest.fn(async () => task1Result)
    const task2 = jest.fn(async () => task2Result)
    
    // Task 3 should be able to read results from task1 and task2
    const task3 = jest.fn(async (data, context) => {
      // Verify saga methods are available
      expect(context.api.sagaId).toBe("test-saga-id")
      expect(typeof context.api.getJob).toBe("function")
      expect(typeof context.api.getEndTaskData).toBe("function")
      
      // Read task 1 data
      const task1Data = await context.api.getEndTaskData("task1")
      expect(task1Data).toEqual(task1Result)
      
      // Read task 2 data
      const task2Data = await context.api.getEndTaskData("task2")
      expect(task2Data).toEqual(task2Result)
      
      // Check task completion status
      const isTask1Completed = await context.api.isTaskCompleted("task1")
      expect(isTask1Completed).toBe(true)
      
      const isTask2Completed = await context.api.isTaskCompleted("task2")
      expect(isTask2Completed).toBe(true)
      
      // Get all task IDs
      const taskIds = await context.api.getTaskIds()
      expect(taskIds).toContain("task1")
      expect(taskIds).toContain("task2")
      
      // Return combined result
      return {
        combinedData: {
          user: task1Data,
          order: task2Data,
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
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const saga = await coordinator.createSaga("test-saga-id", { initial: "data" }) as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(task1).toHaveBeenCalled()
    expect(task2).toHaveBeenCalled()
    expect(task3).toHaveBeenCalled()
    
    // Verify task 3 got the combined result
    const task3Data = await saga.getEndTaskData("task3")
    expect(task3Data).toEqual({
      combinedData: {
        user: task1Result,
        order: task2Result,
      }
    })
  })
  
  it("should allow compensation callbacks to read task data", async () => {
    const task1Result = { resource: "created", resourceId: "res-123" }
    const task2Result = { payment: "charged", transactionId: "txn-456" }
    
    const task1 = jest.fn(async () => task1Result)
    const task2 = jest.fn(async () => {
      // Simulate failure
      throw new Error("Task 2 failed")
    })
    
    // Compensation should be able to read task1 data
    const task1Compensate = jest.fn(async (data, context) => {
      // Verify saga is available
      expect(typeof context.api.getEndTaskData).toBe("function")
      
      // Read task 1 result
      const task1Data = await context.api.getEndTaskData("task1")
      expect(task1Data).toEqual(task1Result)
      
      // Use the data to properly compensate
      return { deleted: task1Data.resourceId }
    })
    
    const sagaDef = SagaBuilder.start()
      .invoke(task1)
      .compensate(task1Compensate)
      .withName("task1")
      .next()
      .invoke(task2)
      .withName("task2")
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const saga = await coordinator.createSaga("test-saga-id", { initial: "data" }) as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(task1).toHaveBeenCalled()
    expect(task2).toHaveBeenCalled()
    expect(task1Compensate).toHaveBeenCalled()
    
    // Verify compensation ran and used the task data
    const compensationResult = await saga.getEndCompensatingTaskData("task1")
    expect(compensationResult).toEqual({ deleted: "res-123" })
  })
  
  it("should not allow callbacks to modify saga state", async () => {
    const task1 = jest.fn(async (data, context) => {
      // Verify that mutation methods are not available
      expect(context.api.endTask).toBeUndefined()
      expect(context.api.startTask).toBeUndefined()
      expect(context.api.abortSaga).toBeUndefined()
      expect(context.api.endSaga).toBeUndefined()
      expect(context.api.logMessage).toBeUndefined()
      
      // Only read methods should be available
      expect(typeof context.api.getJob).toBe("function")
      expect(typeof context.api.getEndTaskData).toBe("function")
      expect(typeof context.api.isTaskCompleted).toBe("function")
      
      return { success: true }
    })
    
    const sagaDef = SagaBuilder.start()
      .invoke(task1)
      .withName("task1")
      .end()
    
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    const saga = await coordinator.createSaga("test-saga-id", { initial: "data" }) as Saga<{ initial: string }>
    const orchestrator = new SagaOrchestrator()
    await orchestrator.run(saga, sagaDef)
    
    expect(task1).toHaveBeenCalled()
  })
})
