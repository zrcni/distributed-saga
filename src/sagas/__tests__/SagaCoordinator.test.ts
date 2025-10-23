import { SagaCoordinator } from "../SagaCoordinator"
import { InMemorySagaLog } from "../InMemorySagaLog"
import { SagaRecoveryType } from "../SagaRecovery"
import { SagaMessage, SagaMessageType } from "../SagaMessage"
import { SagaLog } from "../types"
import { Saga } from "../Saga"

describe("SagaCoordinator", () => {
  let coordinator: SagaCoordinator
  let log: InMemorySagaLog

  beforeEach(() => {
    log = new InMemorySagaLog()
    coordinator = new SagaCoordinator(log)
  })

  describe("create", () => {
    it("should create a new SagaCoordinator instance", () => {
      const coordinator = SagaCoordinator.create(log)
      expect(coordinator).toBeInstanceOf(SagaCoordinator)
      expect(coordinator.log).toBe(log)
    })
  })

  describe("constructor", () => {
    it("should initialize with a saga log", () => {
      const coordinator = new SagaCoordinator(log)
      expect(coordinator.log).toBe(log)
    })
  })

  describe("createSaga", () => {
    it("should create a new saga with given id and job data", async () => {
      const sagaId = "test-saga-1"
      const jobData = { orderId: "order-123", amount: 100 }

      const result = await coordinator.createSaga(sagaId, jobData)

      expect(result).toBeInstanceOf(Saga)
      expect(result.sagaId).toBe(sagaId)
      expect(await result.getJob()).toEqual(jobData)
    })

    it("should return error when saga with same id already exists", async () => {
      const sagaId = "duplicate-saga"
      const jobData = { test: "data" }

      await coordinator.createSaga(sagaId, jobData)

      await expect(
        coordinator.createSaga(sagaId, jobData)
      ).rejects.toThrow("already been started")
    })

    it("should handle different data types for job", async () => {
      const stringResult = await coordinator.createSaga(
        "saga-string",
        "string-data"
      )

      const numberResult = await coordinator.createSaga("saga-number", 42)

      const objectResult = await coordinator.createSaga("saga-object", {
        key: "value",
      })

      const arrayResult = await coordinator.createSaga("saga-array", [1, 2, 3])
    })
  })

  describe("getActiveSagaIds", () => {
    it("should return empty array when no sagas exist", async () => {
      const result = await coordinator.getActiveSagaIds()


      expect(result).toEqual([])
    })

    it("should return array with single saga id", async () => {
      const sagaId = "test-saga"
      await coordinator.createSaga(sagaId, { test: "data" })

      const result = await coordinator.getActiveSagaIds()


      expect(result).toEqual([sagaId])
    })

    it("should return all active saga ids", async () => {
      const sagaId1 = "saga-1"
      const sagaId2 = "saga-2"
      const sagaId3 = "saga-3"

      await coordinator.createSaga(sagaId1, { test: "data1" })
      await coordinator.createSaga(sagaId2, { test: "data2" })
      await coordinator.createSaga(sagaId3, { test: "data3" })

      const result = await coordinator.getActiveSagaIds()


      expect(result).toHaveLength(3)
      expect(result).toContain(sagaId1)
      expect(result).toContain(sagaId2)
      expect(result).toContain(sagaId3)
    })
  })

  describe("recoverSagaState", () => {
    describe("ForwardRecovery", () => {
      it("should recover saga state without additional actions", async () => {
        const sagaId = "recovery-saga"
        const jobData = { orderId: "order-456" }

        // Create and set up initial saga
        const createResult = await coordinator.createSaga(sagaId, jobData)

        const saga = createResult
        await saga.startTask("task-1", { step: 1 })
        await saga.endTask("task-1", { result: "success" })

        // Recover the saga
        const recoveryResult = await coordinator.recoverSagaState(
          sagaId,
          SagaRecoveryType.ForwardRecovery
        )


        expect(recoveryResult).toBeInstanceOf(Saga)
        expect(recoveryResult.sagaId).toBe(sagaId)
        expect(await recoveryResult.isTaskCompleted("task-1")).toBe(true)
      })

      it("should recover saga with multiple completed tasks", async () => {
        const sagaId = "multi-task-saga"
        const createResult = await coordinator.createSaga(sagaId, {})

        const saga = createResult
        await saga.startTask("task-1", {})
        await saga.endTask("task-1", {})
        await saga.startTask("task-2", {})
        await saga.endTask("task-2", {})

        const recoveryResult = await coordinator.recoverSagaState(
          sagaId,
          SagaRecoveryType.ForwardRecovery
        )


        expect(await recoveryResult.isTaskCompleted("task-1")).toBe(true)
        expect(await recoveryResult.isTaskCompleted("task-2")).toBe(true)
      })
    })

    describe("RollbackRecovery", () => {
      it("should abort saga when it is not in a safe state", async () => {
        const sagaId = "unsafe-saga"
        const createResult = await coordinator.createSaga(sagaId, {})

        const saga = createResult
        // Start a task but don't complete it (unsafe state)
        await saga.startTask("incomplete-task", {})

        const recoveryResult = await coordinator.recoverSagaState(
          sagaId,
          SagaRecoveryType.RollbackRecovery
        )


        expect(await recoveryResult.isSagaAborted()).toBe(true)
      })

      it("should not abort saga when it is in a safe state", async () => {
        const sagaId = "safe-saga"
        const createResult = await coordinator.createSaga(sagaId, {})

        const saga = createResult
        // Complete the task (safe state)
        await saga.startTask("complete-task", {})
        await saga.endTask("complete-task", {})

        const recoveryResult = await coordinator.recoverSagaState(
          sagaId,
          SagaRecoveryType.RollbackRecovery
        )


        expect(await recoveryResult.isSagaAborted()).toBe(false)
      })

      it("should not abort saga that is already aborted", async () => {
        const sagaId = "aborted-saga"
        const createResult = await coordinator.createSaga(sagaId, {})

        const saga = createResult
        await saga.abortSaga()

        const recoveryResult = await coordinator.recoverSagaState(
          sagaId,
          SagaRecoveryType.RollbackRecovery
        )


        expect(await recoveryResult.isSagaAborted()).toBe(true)
      })
    })

    it("should return error when saga does not exist", async () => {
      const sagaId = "non-existent-saga"

      await expect(
        coordinator.recoverSagaState(sagaId, SagaRecoveryType.ForwardRecovery)
      ).rejects.toThrow("has not started yet")
    })

    it("should handle recovery of completed saga", async () => {
      const sagaId = "completed-saga"
      const createResult = await coordinator.createSaga(sagaId, {})

      const saga = createResult
      await saga.startTask("task-1", {})
      await saga.endTask("task-1", {})
      await saga.endSaga()

      const recoveryResult = await coordinator.recoverSagaState(
        sagaId,
        SagaRecoveryType.ForwardRecovery
      )


      expect(await recoveryResult.isSagaCompleted()).toBe(true)
    })
  })

  describe("integration with custom SagaLog", () => {
    it("should work with custom saga log implementation", async () => {
      const customLog: SagaLog = {
        startSaga: jest.fn().mockResolvedValue(undefined),
        logMessage: jest.fn().mockResolvedValue(undefined),
        getMessages: jest.fn().mockResolvedValue([]),
        getActiveSagaIds: jest.fn().mockResolvedValue(["saga-1"]),
        getChildSagaIds: jest.fn().mockResolvedValue([]),
        deleteSaga: jest.fn().mockResolvedValue(undefined),
      }

      const customCoordinator = new SagaCoordinator(customLog)

      const result = await customCoordinator.getActiveSagaIds()

      expect(result).toEqual(["saga-1"])
      expect(customLog.getActiveSagaIds).toHaveBeenCalled()
    })

    it("should propagate errors from saga log", async () => {
      const errorLog: SagaLog = {
        startSaga: jest.fn().mockRejectedValue(new Error("Start saga error")),
        logMessage: jest.fn().mockResolvedValue(undefined),
        getMessages: jest.fn().mockResolvedValue([]),
        getActiveSagaIds: jest.fn().mockRejectedValue(new Error("Get IDs error")),
        getChildSagaIds: jest.fn().mockResolvedValue([]),
        deleteSaga: jest.fn().mockResolvedValue(undefined),
      }

      const errorCoordinator = new SagaCoordinator(errorLog)

      await expect(errorCoordinator.createSaga("test-saga", {})).rejects.toThrow(
        "Start saga error"
      )

      await expect(errorCoordinator.getActiveSagaIds()).rejects.toThrow(
        "Get IDs error"
      )
    })
  })

  describe("concurrent saga creation", () => {
    it("should handle multiple concurrent saga creations", async () => {
      const sagaPromises = []

      for (let i = 0; i < 10; i++) {
        sagaPromises.push(
          coordinator.createSaga(`concurrent-saga-${i}`, { index: i })
        )
      }

      const results = await Promise.all(sagaPromises)

      results.forEach((result, index) => {

        expect(result.sagaId).toBe(`concurrent-saga-${index}`)
      })

      const activeIdsResult = await coordinator.getActiveSagaIds()

      expect(activeIdsResult).toHaveLength(10)
    })
  })

  describe("type safety", () => {
    it("should maintain type safety for job data", async () => {
      interface OrderJob {
        orderId: string
        amount: number
        items: string[]
      }

      const jobData: OrderJob = {
        orderId: "order-789",
        amount: 250.5,
        items: ["item1", "item2"],
      }

      const result = await coordinator.createSaga<OrderJob>(
        "typed-saga",
        jobData
      )


      const retrievedJob = await result.getJob()
      expect(retrievedJob).toEqual(jobData)
      expect(retrievedJob.orderId).toBe("order-789")
      expect(retrievedJob.amount).toBe(250.5)
      expect(retrievedJob.items).toHaveLength(2)
    })
  })

  describe("recoverOrCreate", () => {
    it("should create a new saga when saga does not exist", async () => {
      const sagaId = "new-saga"
      const jobData = { orderId: "order-001", amount: 100 }

      const result = await coordinator.recoverOrCreate(sagaId, jobData)


      expect(result).toBeInstanceOf(Saga)
      expect(result.sagaId).toBe(sagaId)
      
      const retrievedJob = await result.getJob()
      expect(retrievedJob).toEqual(jobData)
    })

    it("should recover existing saga when saga exists", async () => {
      const sagaId = "existing-saga"
      const jobData = { orderId: "order-002", amount: 200 }

      // First, create a saga and add some tasks
      const createResult = await coordinator.createSaga(sagaId, jobData)

      const saga = createResult

      // Start and complete a task
      await saga.startTask("task-1", { input: "data" })
      await saga.endTask("task-1", { output: "result" })

      // Now try to recover or create - should recover the existing saga
      const recoverResult = await coordinator.recoverOrCreate(
        sagaId,
        jobData,
        SagaRecoveryType.ForwardRecovery
      )


      expect(recoverResult).toBeInstanceOf(Saga)
      expect(recoverResult.sagaId).toBe(sagaId)
      
      const recoveredJob = await recoverResult.getJob()
      expect(recoveredJob).toEqual(jobData)
      
      // Verify the task is still completed
      expect(await recoverResult.isTaskCompleted("task-1")).toBe(true)
    })

    it("should use default ForwardRecovery when recoveryType not specified", async () => {
      const sagaId = "default-recovery-saga"
      const jobData = { test: "data" }

      // Create saga and add a task
      const createResult = await coordinator.createSaga(sagaId, jobData)

      const saga = createResult
      await saga.startTask("task-1", {})
      await saga.endTask("task-1", {})

      // Recover without specifying recovery type (should default to ForwardRecovery)
      const result = await coordinator.recoverOrCreate(sagaId, jobData)


      expect(result.sagaId).toBe(sagaId)
      expect(await result.isTaskCompleted("task-1")).toBe(true)
    })

    it("should create new saga when recovery fails for non-existent saga", async () => {
      const sagaId = "non-existent-saga"
      const jobData = { orderId: "order-003", amount: 300 }

      // Try to recover a saga that doesn't exist - should create new one
      const result = await coordinator.recoverOrCreate(
        sagaId,
        jobData,
        SagaRecoveryType.ForwardRecovery
      )


      expect(result).toBeInstanceOf(Saga)
      expect(result.sagaId).toBe(sagaId)
      
      const retrievedJob = await result.getJob()
      expect(retrievedJob).toEqual(jobData)
    })

    it("should support parentSagaId parameter", async () => {
      const parentSagaId = "parent-saga"
      const childSagaId = "child-saga"
      const jobData = { test: "child-data" }

      // Create parent saga first
      const parentResult = await coordinator.createSaga(parentSagaId, {
        test: "parent",
      })

      // Create child saga with parent reference
      const result = await coordinator.recoverOrCreate(
        childSagaId,
        jobData,
        SagaRecoveryType.ForwardRecovery,
        { parentSagaId, parentTaskId: "test-task" }
      )


      expect(result.sagaId).toBe(childSagaId)
      
      // Verify the saga was created with parent reference
      const messages = await log.getMessages(childSagaId)

      const startMessage = messages[0]
      expect(startMessage.parentSagaId).toBe(parentSagaId)
      expect(startMessage.parentTaskId).toBe("test-task")
    })

    it("should work with different data types", async () => {
      const stringResult = await coordinator.recoverOrCreate(
        "saga-string",
        "string-data"
      )

      const numberResult = await coordinator.recoverOrCreate(
        "saga-number",
        42
      )

      const objectResult = await coordinator.recoverOrCreate(
        "saga-object",
        { key: "value" }
      )

      const arrayResult = await coordinator.recoverOrCreate(
        "saga-array",
        [1, 2, 3]
      )
    })
  })
})
