import { MongoDBSagaLog } from "../MongoDBSagaLog"
import { SagaMessage, SagaMessageType } from "../SagaMessage"
import { MongoClient, Db, Collection, ObjectId } from "mongodb"

interface SagaDocument {
  _id: ObjectId
  sagaId: string
  messages: SagaMessage[]
  createdAt: Date
  updatedAt: Date
}

describe("MongoDBSagaLog", () => {
  let mongoClient: MongoClient
  let db: Db
  let collection: Collection<SagaDocument>
  let sagaLog: MongoDBSagaLog

  beforeAll(async () => {
    // Connect to the in-memory database from global setup
    const uri = process.env.MONGO_URI

    if (!uri) {
      throw new Error("MONGO_URI is not set in environment")
    }

    mongoClient = new MongoClient(uri)
    await mongoClient.connect()
    db = mongoClient.db("test-saga-db")
  })

  afterAll(async () => {
    // Cleanup connection (server is stopped in global teardown)
    if (mongoClient) {
      await mongoClient.close()
    }
  })

  beforeEach(async () => {
    // Create a fresh collection for each test
    collection = db.collection<SagaDocument>("sagas")
    await collection.deleteMany({}) // Clear any existing data
    sagaLog = new MongoDBSagaLog(collection)
  })

  afterEach(async () => {
    // Clean up after each test
    await collection.deleteMany({})
  })

  describe("startSaga", () => {
    it("should start a new saga successfully", async () => {
      const result = await sagaLog.startSaga("saga-1", { job: "test-data" })
      expect(result).toBeOkResult()

      // Verify the saga was created in the database
      const doc = await collection.findOne({ sagaId: "saga-1" })
      expect(doc).toBeTruthy()
      expect(doc?.sagaId).toBe("saga-1")
      expect(doc?.messages).toHaveLength(1)
      expect(doc?.messages[0].msgType).toBe(SagaMessageType.StartSaga)
    })

    it("should return error when starting a saga that already exists", async () => {
      // Start saga first time
      const result1 = await sagaLog.startSaga("saga-1", { job: "test-data" })
      expect(result1).toBeOkResult()

      // Try to start same saga again
      const result2 = await sagaLog.startSaga("saga-1", { job: "test-data" })
      expect(result2.isError()).toBe(true)
    })

    it("should handle different saga IDs independently", async () => {
      const result1 = await sagaLog.startSaga("saga-1", { job: "data-1" })
      const result2 = await sagaLog.startSaga("saga-2", { job: "data-2" })

      expect(result1).toBeOkResult()
      expect(result2).toBeOkResult()

      const count = await collection.countDocuments()
      expect(count).toBe(2)
    })
  })

  describe("logMessage", () => {
    beforeEach(async () => {
      // Start a saga for logging tests
      await sagaLog.startSaga("saga-1", { job: "test-data" })
    })

    it("should log a message to an existing saga", async () => {
      const message = new SagaMessage({
        sagaId: "saga-1",
        msgType: SagaMessageType.StartTask,
        taskId: "task-1",
        data: { step: "step-1" },
      })

      const result = await sagaLog.logMessage(message)
      expect(result).toBeOkResult()

      // Verify message was added
      const doc = await collection.findOne({ sagaId: "saga-1" })
      expect(doc?.messages).toHaveLength(2) // StartSaga + StartTask
      expect(doc?.messages[1].msgType).toBe(SagaMessageType.StartTask)
      expect(doc?.messages[1].taskId).toBe("task-1")
    })

    it("should return error when logging to non-existent saga", async () => {
      const message = new SagaMessage({
        sagaId: "non-existent-saga",
        msgType: SagaMessageType.StartTask,
        taskId: "task-1",
      })

      const result = await sagaLog.logMessage(message)
      expect(result.isError()).toBe(true)
    })

    it("should log multiple messages in order", async () => {
      const messages = [
        new SagaMessage({
          sagaId: "saga-1",
          msgType: SagaMessageType.StartTask,
          taskId: "task-1",
        }),
        new SagaMessage({
          sagaId: "saga-1",
          msgType: SagaMessageType.EndTask,
          taskId: "task-1",
        }),
        new SagaMessage({
          sagaId: "saga-1",
          msgType: SagaMessageType.EndSaga,
        }),
      ]

      for (const msg of messages) {
        const result = await sagaLog.logMessage(msg)
        expect(result).toBeOkResult()
      }

      const doc = await collection.findOne({ sagaId: "saga-1" })
      expect(doc?.messages).toHaveLength(4) // StartSaga + 3 messages
      expect(doc?.messages[1].msgType).toBe(SagaMessageType.StartTask)
      expect(doc?.messages[2].msgType).toBe(SagaMessageType.EndTask)
      expect(doc?.messages[3].msgType).toBe(SagaMessageType.EndSaga)
    })
  })

  describe("getMessages", () => {
    beforeEach(async () => {
      await sagaLog.startSaga("saga-1", { job: "test-data" })
    })

    it("should retrieve all messages for a saga", async () => {
      // Add some messages
      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-1",
          msgType: SagaMessageType.StartTask,
          taskId: "task-1",
        })
      )
      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-1",
          msgType: SagaMessageType.EndTask,
          taskId: "task-1",
        })
      )

      const result = await sagaLog.getMessages("saga-1")
      expect(result).toBeOkResult()

      if (result.isOk()) {
        expect(result.data).toHaveLength(3) // StartSaga + 2 messages
        expect(result.data[0].msgType).toBe(SagaMessageType.StartSaga)
        expect(result.data[1].msgType).toBe(SagaMessageType.StartTask)
        expect(result.data[2].msgType).toBe(SagaMessageType.EndTask)
      }
    })

    it("should return error for non-existent saga", async () => {
      const result = await sagaLog.getMessages("non-existent-saga")
      expect(result.isError()).toBe(true)
    })

    it("should return only the StartSaga message for newly started saga", async () => {
      const result = await sagaLog.getMessages("saga-1")
      expect(result).toBeOkResult()

      if (result.isOk()) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].msgType).toBe(SagaMessageType.StartSaga)
      }
    })
  })

  describe("getActiveSagaIds", () => {
    it("should return empty array when no sagas exist", async () => {
      const result = await sagaLog.getActiveSagaIds()
      expect(result).toBeOkResult()

      if (result.isOk()) {
        expect(result.data).toEqual([])
      }
    })

    it("should return all saga IDs", async () => {
      await sagaLog.startSaga("saga-1", { job: "data-1" })
      await sagaLog.startSaga("saga-2", { job: "data-2" })
      await sagaLog.startSaga("saga-3", { job: "data-3" })

      const result = await sagaLog.getActiveSagaIds()
      expect(result).toBeOkResult()

      if (result.isOk()) {
        expect(result.data).toHaveLength(3)
        expect(result.data).toContain("saga-1")
        expect(result.data).toContain("saga-2")
        expect(result.data).toContain("saga-3")
      }
    })

    it("should return saga IDs after some are deleted", async () => {
      await sagaLog.startSaga("saga-1", { job: "data-1" })
      await sagaLog.startSaga("saga-2", { job: "data-2" })
      await sagaLog.deleteSaga("saga-1")

      const result = await sagaLog.getActiveSagaIds()
      expect(result).toBeOkResult()

      if (result.isOk()) {
        expect(result.data).toHaveLength(1)
        expect(result.data).toContain("saga-2")
        expect(result.data).not.toContain("saga-1")
      }
    })
  })

  describe("deleteSaga", () => {
    beforeEach(async () => {
      await sagaLog.startSaga("saga-1", { job: "test-data" })
    })

    it("should delete an existing saga", async () => {
      const result = await sagaLog.deleteSaga("saga-1")
      expect(result).toBeOkResult()

      // Verify saga was deleted
      const doc = await collection.findOne({ sagaId: "saga-1" })
      expect(doc).toBeNull()
    })

    it("should succeed even when deleting non-existent saga", async () => {
      const result = await sagaLog.deleteSaga("non-existent-saga")
      expect(result).toBeOkResult()
    })
  })

  describe("createMongoDBSagaCoordinator", () => {
    it("should create a saga coordinator with MongoDB log", async () => {
      const coordinator = MongoDBSagaLog.createMongoDBSagaCoordinator(collection)
      expect(coordinator).toBeTruthy()
      expect(coordinator.log).toBeInstanceOf(MongoDBSagaLog)
    })

    it("should create saga using the coordinator", async () => {
      const coordinator = MongoDBSagaLog.createMongoDBSagaCoordinator(collection)
      const result = await coordinator.createSaga("saga-1", { job: "test-data" })
      expect(result).toBeOkResult()

      // Verify saga was created in database
      const doc = await collection.findOne({ sagaId: "saga-1" })
      expect(doc).toBeTruthy()
      expect(doc?.sagaId).toBe("saga-1")
    })
  })

  describe("createIndexes", () => {
    it("should create indexes on the collection", async () => {
      await MongoDBSagaLog.createIndexes(collection)

      // Verify indexes were created
      const indexes = await collection.indexes()
      const sagaIdIndex = indexes.find((idx) =>
        idx.key.hasOwnProperty("sagaId")
      )

      expect(sagaIdIndex).toBeTruthy()
      expect(sagaIdIndex?.unique).toBe(true)
    })
  })

  describe("integration test", () => {
    it("should handle a complete saga workflow", async () => {
      // Start saga
      const startResult = await sagaLog.startSaga("saga-workflow", {
        orderId: "12345",
      })
      expect(startResult).toBeOkResult()

      // Log task start
      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-workflow",
          msgType: SagaMessageType.StartTask,
          taskId: "reserve-inventory",
        })
      )

      // Log task end
      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-workflow",
          msgType: SagaMessageType.EndTask,
          taskId: "reserve-inventory",
        })
      )

      // Log another task
      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-workflow",
          msgType: SagaMessageType.StartTask,
          taskId: "process-payment",
        })
      )

      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-workflow",
          msgType: SagaMessageType.EndTask,
          taskId: "process-payment",
        })
      )

      // End saga
      await sagaLog.logMessage(
        new SagaMessage({
          sagaId: "saga-workflow",
          msgType: SagaMessageType.EndSaga,
        })
      )

      // Verify complete message history
      const messagesResult = await sagaLog.getMessages("saga-workflow")
      expect(messagesResult).toBeOkResult()

      if (messagesResult.isOk()) {
        expect(messagesResult.data).toHaveLength(6)
        expect(messagesResult.data[0].msgType).toBe(SagaMessageType.StartSaga)
        expect(messagesResult.data[5].msgType).toBe(SagaMessageType.EndSaga)
      }

      // Clean up
      const deleteResult = await sagaLog.deleteSaga("saga-workflow")
      expect(deleteResult).toBeOkResult()

      // Verify saga is deleted
      const getResult = await sagaLog.getMessages("saga-workflow")
      expect(getResult.isError()).toBe(true)
    })
  })
})
