import { describe, it, expect, beforeEach } from '@jest/globals'
import { SagaOrchestrator } from '../SagaOrchestrator'
import { InMemorySagaLog } from '../InMemorySagaLog'
import { SagaBuilder } from '../saga-definition/SagaBuilder'
import { SagaMessageType } from '../SagaMessage'

describe('Optional Tasks Metadata', () => {
  let orchestrator: SagaOrchestrator
  let coordinator: ReturnType<typeof InMemorySagaLog.createInMemorySagaCoordinator>

  beforeEach(() => {
    orchestrator = new SagaOrchestrator()
    coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
  })

  it('should store isOptional=true in StartTask message metadata for optional tasks', async () => {
    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => 'result1')
      .withName('task1')
      .next()
      .invoke(async () => 'result2')
      .withName('task2')
      .optional()
      .next()
      .invoke(async () => 'result3')
      .withName('task3')
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    // Get all messages from coordinator's log
    const messages = await coordinator.log.getMessages('test-saga')
    
    // Find StartTask messages
    const task1Start = messages.find(m => m.msgType === SagaMessageType.StartTask && m.taskId === 'task1')
    const task2Start = messages.find(m => m.msgType === SagaMessageType.StartTask && m.taskId === 'task2')
    const task3Start = messages.find(m => m.msgType === SagaMessageType.StartTask && m.taskId === 'task3')

    // task1 should not have isOptional (or it should be false/undefined)
    expect(task1Start?.metadata?.isOptional).toBeFalsy()

    // task2 should have isOptional=true
    expect(task2Start?.metadata?.isOptional).toBe(true)

    // task3 should not have isOptional
    expect(task3Start?.metadata?.isOptional).toBeFalsy()
  })

  it('should store isOptional=true even when optional task fails', async () => {
    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        throw new Error('Optional task failed')
      })
      .withName('optionalTask')
      .optional()
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    // Get all messages from coordinator's log
    const messages = await coordinator.log.getMessages('test-saga')
    
    // Find StartTask message for optional task
    const taskStart = messages.find(m => m.msgType === SagaMessageType.StartTask && m.taskId === 'optionalTask')

    // Should have isOptional=true
    expect(taskStart?.metadata?.isOptional).toBe(true)
    
    // Saga should still complete
    expect(await saga.isSagaCompleted()).toBe(true)
  })

  it('should store isOptional=true for multiple optional tasks', async () => {
    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => 'result1')
      .withName('task1')
      .optional()
      .next()
      .invoke(async () => 'result2')
      .withName('task2')
      .optional()
      .next()
      .invoke(async () => 'result3')
      .withName('task3')
      .optional()
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    // Get all messages from coordinator's log
    const messages = await coordinator.log.getMessages('test-saga')
    
    // Find all StartTask messages
    const startTaskMessages = messages.filter(m => m.msgType === SagaMessageType.StartTask)

    // All tasks should have isOptional=true
    expect(startTaskMessages.length).toBe(3)
    startTaskMessages.forEach(msg => {
      expect(msg.metadata?.isOptional).toBe(true)
    })
  })

  it('should not set metadata when task is not optional', async () => {
    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => 'result')
      .withName('requiredTask')
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    // Get all messages from coordinator's log
    const messages = await coordinator.log.getMessages('test-saga')
    
    // Find StartTask message
    const taskStart = messages.find(m => m.msgType === SagaMessageType.StartTask && m.taskId === 'requiredTask')

    // Should not have isOptional=true (should be false or undefined)
    expect(taskStart?.metadata?.isOptional).toBeFalsy()
  })
})
