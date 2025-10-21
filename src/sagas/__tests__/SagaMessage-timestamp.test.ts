import { SagaMessage, SagaMessageType } from "../SagaMessage"
import { InMemorySagaLog } from "../InMemorySagaLog"
import { Result } from "@/Result"

describe("SagaMessage timestamps", () => {
  it("should automatically set timestamp when creating messages", () => {
    const beforeTime = new Date()
    
    const msg = SagaMessage.createStartSagaMessage("test-saga-1", { test: "data" })
    
    const afterTime = new Date()
    
    expect(msg.timestamp).toBeDefined()
    expect(msg.timestamp).toBeInstanceOf(Date)
    expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    expect(msg.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime())
  })

  it("should allow custom timestamp when provided", () => {
    const customTime = new Date("2024-01-15T10:30:00Z")
    
    const msg = new SagaMessage({
      msgType: SagaMessageType.StartSaga,
      sagaId: "test-saga-2",
      data: { test: "data" },
      timestamp: customTime,
    })
    
    expect(msg.timestamp).toEqual(customTime)
  })

  it("should preserve timestamps when stored in InMemorySagaLog", async () => {
    const log = new InMemorySagaLog()
    const startTime = new Date()
    
    // Start a saga
    const startResult = await log.startSaga("test-saga-3", { test: "data" })
    expect(startResult.isOk()).toBe(true)
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Add another message
    const taskMsg = SagaMessage.createStartTaskMessage("test-saga-3", "task-1", { task: "data" })
    const logResult = await log.logMessage(taskMsg)
    expect(logResult.isOk()).toBe(true)
    
    // Retrieve messages
    const messagesResult = await log.getMessages("test-saga-3")
    expect(messagesResult.isOk()).toBe(true)
    
    if (messagesResult.isOk()) {
      const messages = messagesResult.data
      expect(messages).toHaveLength(2)
      
      // Check first message (StartSaga)
      expect(messages[0].timestamp).toBeDefined()
      expect(messages[0].timestamp).toBeInstanceOf(Date)
      expect(messages[0].timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime())
      
      // Check second message (StartTask)
      expect(messages[1].timestamp).toBeDefined()
      expect(messages[1].timestamp).toBeInstanceOf(Date)
      expect(messages[1].timestamp.getTime()).toBeGreaterThanOrEqual(messages[0].timestamp.getTime())
    }
  })

  it("should create all message types with timestamps", () => {
    const sagaId = "test-saga-4"
    const taskId = "task-1"
    
    const messages = [
      SagaMessage.createStartSagaMessage(sagaId, { test: "data" }),
      SagaMessage.createEndSagaMessage(sagaId),
      SagaMessage.createStartTaskMessage(sagaId, taskId, { task: "data" }),
      SagaMessage.createEndTaskMessage(sagaId, taskId, { result: "done" }),
      SagaMessage.createStartCompensatingTaskMessage(sagaId, taskId, { reason: "failed" }),
      SagaMessage.createEndCompensatingTaskMessage(sagaId, taskId, { result: "compensated" }),
    ]
    
    messages.forEach((msg, index) => {
      expect(msg.timestamp).toBeDefined()
      expect(msg.timestamp).toBeInstanceOf(Date)
    })
  })
})
