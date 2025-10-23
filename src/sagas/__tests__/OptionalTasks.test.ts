import { describe, it, expect, beforeEach } from '@jest/globals'
import { SagaOrchestrator } from '../SagaOrchestrator'
import { InMemorySagaLog } from '../InMemorySagaLog'
import { SagaBuilder } from '../saga-definition/SagaBuilder'

describe('Optional Tasks', () => {
  let orchestrator: SagaOrchestrator
  let coordinator: ReturnType<typeof InMemorySagaLog.createInMemorySagaCoordinator>

  beforeEach(() => {
    orchestrator = new SagaOrchestrator()
    coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
  })

  it('should continue saga when optional task fails', async () => {
    let optionalTaskCalled = false
    let nextTaskCalled = false

    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        optionalTaskCalled = true
        throw new Error('Optional task failed')
      })
      .withName('optionalTask')
      .optional()
      .next()
      .invoke(async () => {
        nextTaskCalled = true
        return 'success'
      })
      .withName('nextTask')
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    expect(optionalTaskCalled).toBe(true)
    expect(nextTaskCalled).toBe(true)
    expect(await saga.isSagaCompleted()).toBe(true)
  })

  it('should emit optionalTaskFailed event when optional task fails', async () => {
    const events: string[] = []

    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        throw new Error('Optional task failed')
      })
      .withName('optionalTask')
      .optional()
      .end()

    orchestrator.on('optionalTaskFailed', ({ taskName, error }) => {
      const errorMsg = error instanceof Error ? error.message : String(error)
      events.push(`optionalTaskFailed:${taskName}:${errorMsg}`)
    })

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    expect(events).toContain('optionalTaskFailed:optionalTask:Optional task failed')
  })

  it('should mark optional task as completed with null', async () => {
    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        throw new Error('Optional task failed')
      })
      .withName('optionalTask')
      .optional()
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    // Task should be completed with null to indicate optional failure
    const taskData = await saga.getEndTaskData('optionalTask')
    expect(taskData).toBe(null)
    
    // Saga should still be completed successfully
    expect(await saga.isSagaCompleted()).toBe(true)
  })

  it('should pass null as previous result to next task when optional task fails', async () => {
    let receivedPrevResult: any = 'not-set'

    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        throw new Error('Optional task failed')
      })
      .withName('optionalTask')
      .optional()
      .next()
      .invoke(async (data, context) => {
        receivedPrevResult = context.prev
        return 'success'
      })
      .withName('nextTask')
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    expect(receivedPrevResult).toBe(null)
  })

  it('should abort saga when required task fails', async () => {
    let nextTaskCalled = false

    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        throw new Error('Required task failed')
      })
      .withName('requiredTask')
      .next()
      .invoke(async () => {
        nextTaskCalled = true
        return 'success'
      })
      .withName('nextTask')
      .end()

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)
    
    expect(nextTaskCalled).toBe(false)
    expect(await saga.isSagaAborted()).toBe(true)
    expect(await saga.isSagaCompleted()).toBe(false)
  })

  it('should handle multiple optional tasks failing', async () => {
    let task1Called = false
    let task2Called = false
    let task3Called = false
    const events: string[] = []

    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        task1Called = true
        throw new Error('Task 1 failed')
      })
      .withName('task1')
      .optional()
      .next()
      .invoke(async () => {
        task2Called = true
        throw new Error('Task 2 failed')
      })
      .withName('task2')
      .optional()
      .next()
      .invoke(async () => {
        task3Called = true
        return 'success'
      })
      .withName('task3')
      .end()

    orchestrator.on('optionalTaskFailed', ({ taskName }) => {
      events.push(taskName)
    })

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    expect(task1Called).toBe(true)
    expect(task2Called).toBe(true)
    expect(task3Called).toBe(true)
    expect(events).toEqual(['task1', 'task2'])
    expect(await saga.isSagaCompleted()).toBe(true)
  })

  it('should execute successfully when optional task does not fail', async () => {
    let optionalTaskCalled = false
    const events: string[] = []

    const sagaDefinition = SagaBuilder.start()
      .invoke(async () => {
        optionalTaskCalled = true
        return 'success'
      })
      .withName('optionalTask')
      .optional()
      .end()

    orchestrator.on('optionalTaskFailed', ({ taskName }) => {
      events.push(taskName)
    })

    const saga = await coordinator.createSaga('test-saga', {})
    await orchestrator.run(saga, sagaDefinition)

    expect(optionalTaskCalled).toBe(true)
    expect(events).toHaveLength(0)
    expect(await saga.isSagaCompleted()).toBe(true)
  })
})
