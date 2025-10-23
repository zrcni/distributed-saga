# Optional Saga Tasks Feature

## Overview
Optional tasks allow you to define saga steps that can fail without causing the entire saga to abort. This is useful for non-critical operations like logging, notifications, or analytics that shouldn't block the main business flow.

## Implementation

### 1. SagaStep Enhancement
Added `isOptional` flag and `optional()` method to the `SagaStep` class:

```typescript
export class SagaStep {
  public isOptional = false
  
  /**
   * Mark this task as optional. If an optional task fails, the saga will continue
   * to the next task instead of aborting. The error will be logged and an event
   * will be emitted, but the saga flow will proceed.
   */
  optional() {
    this.isOptional = true
    return this
  }
}
```

### 2. SagaOrchestrator Event
Added new event type `optionalTaskFailed` to track when optional tasks fail:

```typescript
export interface SagaOrchestratorEvents {
  // ... existing events
  optionalTaskFailed: {
    sagaId: string
    data: unknown
    taskName: string
    error: unknown
  }
}
```

### 3. Execution Logic
Modified `executeSteps` method to wrap task execution in try-catch:
- If task succeeds: Normal flow continues
- If task fails and is optional: 
  - Emit `optionalTaskFailed` event with error details
  - Mark task as completed with `null` result
  - Set next task's previous result to `null`
  - Continue to next task
- If task fails and is required: 
  - Throw error to trigger saga abort and compensation

**Important**: Optional task failures store `null` as the end task data, not an error marker object. This ensures the next task receives `null` as its previous result. Error information is available through the `optionalTaskFailed` event.

## Usage Examples

### Basic Optional Task

```typescript
import { defineSaga } from "@zrcni/distributed-saga"

const orderSaga = defineSaga()
  .step()
    .invoke(async (data) => {
      // Critical: Process payment
      return await processPayment(data.orderId)
    })
    .withName("processPayment")
    .compensate(async (data) => {
      await refundPayment(data.orderId)
    })
  .step()
    .invoke(async (data) => {
      // Optional: Send confirmation email
      return await sendEmail(data.customerId, 'order-confirmed')
    })
    .withName("sendEmail")
    .optional() // 👈 Mark as optional
  .step()
    .invoke(async (data) => {
      // Critical: Update inventory
      return await updateInventory(data.items)
    })
    .withName("updateInventory")
    .compensate(async (data) => {
      await restoreInventory(data.items)
    })
  .end()

// If sendEmail fails, the saga continues to updateInventory
// If processPayment or updateInventory fail, saga aborts and compensates
```

### Multiple Optional Tasks

```typescript
const userRegistrationSaga = defineSaga()
  .step()
    .invoke(async (data) => {
      // Critical: Create user account
      return await createUser(data)
    })
    .withName("createUser")
    .compensate(async (data) => {
      await deleteUser(data.userId)
    })
  .step()
    .invoke(async (data) => {
      // Optional: Send welcome email
      return await sendWelcomeEmail(data.email)
    })
    .withName("sendWelcomeEmail")
    .optional()
  .step()
    .invoke(async (data) => {
      // Optional: Track analytics event
      return await trackUserRegistration(data.userId)
    })
    .withName("trackAnalytics")
    .optional()
  .step()
    .invoke(async (data) => {
      // Optional: Create sample data
      return await createSampleData(data.userId)
    })
    .withName("createSampleData")
    .optional()
  .step()
    .invoke(async (data) => {
      // Critical: Activate account
      return await activateAccount(data.userId)
    })
    .withName("activateAccount")
  .end()
```

### Using the Functional API

The functional API also supports optional tasks through both the `step()` builder and config object format:

```typescript
import { step, fromSteps } from "@zrcni/distributed-saga"

// Using step() builder
const sagaWithBuilder = fromSteps([
  step("processPayment")
    .invoke(async (data) => await processPayment(data))
    .compensate(async (data, taskData) => await refundPayment(taskData)),
  
  step("sendEmail")
    .invoke(async (data) => await sendEmail(data))
    .optional(),  // 👈 Mark as optional
  
  step("updateInventory")
    .invoke(async (data) => await updateInventory(data))
])

// Using config object format
const sagaWithConfig = fromSteps([
  {
    name: "processPayment",
    invoke: async (data) => await processPayment(data),
    compensate: async (data, taskData) => await refundPayment(taskData)
  },
  {
    name: "sendEmail",
    invoke: async (data) => await sendEmail(data),
    optional: true  // 👈 Mark as optional
  },
  {
    name: "updateInventory",
    invoke: async (data) => await updateInventory(data)
  }
])
```

### Monitoring Optional Task Failures

```typescript
import { SagaOrchestrator } from "@zrcni/distributed-saga"

const orchestrator = new SagaOrchestrator()

// Listen for optional task failures
orchestrator.on("optionalTaskFailed", ({ sagaId, taskName, error }) => {
  console.warn(`Optional task "${taskName}" failed in saga ${sagaId}:`, error)
  
  // Send to monitoring/logging service
  monitoringService.logWarning({
    type: 'optional_task_failed',
    sagaId,
    taskName,
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date()
  })
})

// Listen for required task failures (saga aborts)
orchestrator.on("sagaFailed", ({ sagaId, error }) => {
  console.error(`Saga ${sagaId} failed:`, error)
  
  // Send to error tracking service
  errorTracker.captureException(error, {
    sagaId,
    severity: 'error'
  })
})

await orchestrator.run(saga, sagaDefinition)
```

### Checking Optional Task Results

```typescript
// After saga completion, you can check if optional tasks failed
const saga = await coordinator.createSaga("order-123", orderData)
await orchestrator.run(saga, orderSaga)

// Check if an optional task failed by checking for null result
const emailResult = await saga.getEndTaskData("sendEmail")
if (emailResult === null) {
  console.log("Email sending may have failed, but order was processed")
  
  // You could retry the optional task manually
  await retryEmailSending(orderData.customerId)
}

// Or listen to the optionalTaskFailed event during execution
orchestrator.on("optionalTaskFailed", ({ taskName, error }) => {
  console.warn(`Optional task ${taskName} failed:`, error)
  // Handle error, send to monitoring, etc.
})
```

## Use Cases

### 1. **Non-Critical Notifications**
```typescript
.step()
  .invoke(async (data) => {
    await sendPushNotification(data.userId, 'Order shipped!')
  })
  .withName("sendPushNotification")
  .optional() // Don't fail order if notification service is down
```

### 2. **Analytics & Tracking**
```typescript
.step()
  .invoke(async (data) => {
    await analyticsService.track('purchase_completed', data)
  })
  .withName("trackPurchase")
  .optional() // Don't fail transaction if analytics is unavailable
```

### 3. **External Integrations**
```typescript
.step()
  .invoke(async (data) => {
    await syncToDataWarehouse(data)
  })
  .withName("syncToWarehouse")
  .optional() // Don't block core flow if warehouse sync fails
```

### 4. **Cache Updates**
```typescript
.step()
  .invoke(async (data) => {
    await updateCache(data.userId, data.profile)
  })
  .withName("updateCache")
  .optional() // Cache failures shouldn't affect core operation
```

### 5. **Audit Logging**
```typescript
.step()
  .invoke(async (data) => {
    await auditLog.record('user_action', data)
  })
  .withName("auditLog")
  .optional() // Audit log failures shouldn't block user actions
```

## Important Considerations

### 1. **No Compensation for Optional Tasks**
Optional tasks that fail are not compensated during saga rollback. If you need compensation logic, the task should be required, not optional.

```typescript
// ❌ Don't do this - compensation won't run if task fails
.step()
  .invoke(async (data) => {
    await reserveInventory(data.items)
  })
  .compensate(async (data) => {
    await releaseInventory(data.items)
  })
  .optional() // If this fails, compensation never runs!

// ✅ Do this instead - make critical tasks required
.step()
  .invoke(async (data) => {
    await reserveInventory(data.items)
  })
  .compensate(async (data) => {
    await releaseInventory(data.items)
  })
  // Not optional - will trigger compensation on failure
```

### 2. **Previous Step Results**
When an optional task fails, the next task receives `null` as its previous result:

```typescript
.step()
  .invoke(async (data) => {
    return { emailId: '123' }
  })
  .withName("sendEmail")
  .optional()
.step()
  .invoke(async (data, { prev }) => {
    // prev will be null if sendEmail failed
    if (prev?.emailId) {
      console.log("Email was sent successfully")
    } else {
      console.log("Email sending failed or returned null")
    }
  })
  .withName("nextTask")
```

### 3. **Error Handling Strategy**
Consider implementing retry logic for optional tasks that fail:

```typescript
orchestrator.on("optionalTaskFailed", async ({ sagaId, taskName, error }) => {
  // Retry optional tasks after saga completes
  await retryQueue.add({
    sagaId,
    taskName,
    error,
    retryAfter: Date.now() + 60000 // Retry after 1 minute
  })
})
```

## Testing

```typescript
import { describe, it, expect } from '@jest/globals'
import { InMemorySagaLog } from '@zrcni/distributed-saga'

describe('Optional Tasks', () => {
  it('should continue saga when optional task fails', async () => {
    const orchestrator = new SagaOrchestrator()
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    
    let optionalTaskCalled = false
    let nextTaskCalled = false
    
    const saga = defineSaga()
      .step()
        .invoke(async () => {
          optionalTaskCalled = true
          throw new Error('Optional task failed')
        })
        .withName('optionalTask')
        .optional()
      .step()
        .invoke(async () => {
          nextTaskCalled = true
          return 'success'
        })
        .withName('nextTask')
      .end()
    
    const instance = await coordinator.createSaga('test', {})
    await orchestrator.run(instance, saga)
    
    expect(optionalTaskCalled).toBe(true)
    expect(nextTaskCalled).toBe(true)
    expect(await instance.isSagaCompleted()).toBe(true)
  })
  
  it('should emit optionalTaskFailed event', async () => {
    const orchestrator = new SagaOrchestrator()
    const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
    
    let failedEvent: any = null
    orchestrator.on('optionalTaskFailed', (event) => {
      failedEvent = event
    })
    
    const saga = defineSaga()
      .step()
        .invoke(async () => {
          throw new Error('Test error')
        })
        .withName('optionalTask')
        .optional()
      .end()
    
    const instance = await coordinator.createSaga('test', {})
    await orchestrator.run(instance, saga)
    
    expect(failedEvent).not.toBeNull()
    expect(failedEvent.taskName).toBe('optionalTask')
    expect(failedEvent.error.message).toBe('Test error')
  })
})
```

## Migration Guide

If you have existing sagas and want to make some tasks optional:

1. Identify non-critical tasks that shouldn't block the saga
2. Add `.optional()` to those task definitions
3. Add monitoring for `optionalTaskFailed` events
4. Update any logic that depends on optional task results to handle null values
5. Test thoroughly to ensure saga flow works as expected

## Performance Considerations

- Optional task failures are logged to the saga state with error markers
- This adds minimal overhead (one additional object in task data)
- Event emissions are synchronous but listeners should be non-blocking
- Consider batching optional task retries to avoid overwhelming external services
