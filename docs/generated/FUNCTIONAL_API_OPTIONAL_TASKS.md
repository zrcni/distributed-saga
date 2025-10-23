# Functional API Support for Optional Tasks

## Summary
Extended the optional tasks feature to work seamlessly with the functional API (`step()` and `fromSteps()`), providing two convenient ways to define optional tasks.

## Changes Made

### 1. `StepConfig` Interface Enhancement
Added `optional?: boolean` field to the `StepConfig` interface:

```typescript
export interface StepConfig<Data, PrevResult, ResultData, TaskData> {
  name: string
  invoke?: StepInvokeCallback<Data, PrevResult, ResultData>
  compensate?: StepCompensateCallback<Data, TaskData, ResultData>
  middleware?: StepMiddlewareCallback<Data, PrevResult>[]
  optional?: boolean  // 👈 New field
}
```

### 2. `FunctionalStepBuilder` Enhancement
Added `optional()` method to the `FunctionalStepBuilder` class:

```typescript
/**
 * Mark this step as optional. If an optional step fails, the saga will continue
 * to the next step instead of aborting. The error will be logged and an event
 * will be emitted, but the saga flow will proceed.
 */
optional(): FunctionalStepBuilder<Data, PrevResult, ResultData> {
  this.config.optional = true
  return this
}
```

### 3. `createSagaStep()` Helper Update
Modified the internal `createSagaStep()` function to apply the optional flag:

```typescript
function createSagaStep(builder: SagaBuilder, config: StepConfig): SagaStep {
  const sagaStep = new SagaStep(builder)
    .withName(config.name)
    .invoke(config.invoke)

  // ... existing code ...

  if (config.optional) {
    sagaStep.optional()  // 👈 Apply optional flag
  }

  return sagaStep
}
```

## Usage Examples

### Method 1: Using `step()` Builder with Fluent API

```typescript
import { step, fromSteps } from "@zrcni/distributed-saga"

const orderSaga = fromSteps([
  step("processPayment")
    .invoke(async (data) => {
      return await processPayment(data.orderId)
    })
    .compensate(async (data, result) => {
      await refundPayment(result.paymentId)
    }),
  
  step("sendConfirmationEmail")
    .invoke(async (data) => {
      return await sendEmail(data.customerId, 'order-confirmed')
    })
    .optional(),  // 👈 Mark as optional - saga continues if this fails
  
  step("updateInventory")
    .invoke(async (data) => {
      return await updateInventory(data.items)
    })
    .compensate(async (data, result) => {
      await restoreInventory(data.items)
    })
])
```

### Method 2: Using Config Object Format

```typescript
import { fromSteps } from "@zrcni/distributed-saga"

const orderSaga = fromSteps([
  {
    name: "processPayment",
    invoke: async (data) => await processPayment(data.orderId),
    compensate: async (data, result) => await refundPayment(result.paymentId)
  },
  {
    name: "sendConfirmationEmail",
    invoke: async (data) => await sendEmail(data.customerId, 'order-confirmed'),
    optional: true  // 👈 Mark as optional
  },
  {
    name: "updateInventory",
    invoke: async (data) => await updateInventory(data.items),
    compensate: async (data, result) => await restoreInventory(data.items)
  }
])
```

### Method 3: Mixed Approach

You can even mix both approaches:

```typescript
import { step, fromSteps } from "@zrcni/distributed-saga"

const orderSaga = fromSteps([
  step("processPayment")
    .invoke(async (data) => await processPayment(data))
    .compensate(async (data, result) => await refundPayment(result)),
  
  {
    name: "sendEmail",
    invoke: async (data) => await sendEmail(data),
    optional: true  // Config object with optional flag
  },
  
  step("updateInventory")
    .invoke(async (data) => await updateInventory(data))
    .optional()  // Builder method
])
```

## Complete Example with Error Handling

```typescript
import { fromSteps, step } from "@zrcni/distributed-saga"
import { SagaOrchestrator } from "@zrcni/distributed-saga"

// Define saga with optional tasks
const userRegistrationSaga = fromSteps([
  step("createUserAccount")
    .invoke(async (data) => {
      const user = await database.createUser(data)
      return { userId: user.id }
    })
    .compensate(async (data, result) => {
      await database.deleteUser(result.userId)
    }),
  
  step("sendWelcomeEmail")
    .invoke(async (data, context) => {
      const userId = context.prev.userId
      await emailService.sendWelcome(data.email, userId)
    })
    .optional(),  // Email failures don't block user creation
  
  step("trackAnalytics")
    .invoke(async (data, context) => {
      const userId = context.prev  // Will be null if sendEmail failed
      await analytics.track('user_registered', { userId })
    })
    .optional(),  // Analytics failures don't block user creation
  
  step("activateAccount")
    .invoke(async (data, context) => {
      const userId = context.api.getEndTaskData('createUserAccount').userId
      await database.activateUser(userId)
    })
])

// Execute saga with monitoring
const orchestrator = new SagaOrchestrator()

// Monitor optional task failures
orchestrator.on("optionalTaskFailed", ({ sagaId, taskName, error }) => {
  console.warn(`[${sagaId}] Optional task "${taskName}" failed:`, error)
  
  // Send to monitoring service
  monitoring.logWarning({
    saga: sagaId,
    task: taskName,
    error: error instanceof Error ? error.message : String(error),
    severity: 'low',
    timestamp: new Date()
  })
  
  // Could trigger retry logic here
  if (taskName === 'sendWelcomeEmail') {
    retryQueue.add({ task: 'send-welcome-email', data: { sagaId } })
  }
})

// Execute
const coordinator = createSagaCoordinator()
const saga = await coordinator.createSaga('user-reg-123', {
  email: 'user@example.com',
  name: 'John Doe'
})

await orchestrator.run(saga, userRegistrationSaga)

// Check results
if (await saga.isSagaCompleted()) {
  console.log('User registered successfully!')
  
  // Check if optional tasks completed
  const emailResult = await saga.getEndTaskData('sendWelcomeEmail')
  if (emailResult === null) {
    console.log('Note: Welcome email failed to send')
  }
}
```

## Benefits of Functional API Support

1. **Consistency**: Same optional task behavior across both builder and functional APIs
2. **Flexibility**: Choose the syntax that best fits your use case
3. **Configuration-Driven**: Easily build sagas from configuration files or dynamic sources
4. **Type Safety**: Full TypeScript support with proper type inference
5. **Composability**: Mix and match approaches within the same saga

## Testing

Added comprehensive tests covering:
- ✅ `optional()` method on `FunctionalStepBuilder`
- ✅ `optional` property in config objects
- ✅ Optional task execution with step builder
- ✅ Optional task execution with config objects
- ✅ Event emission for optional task failures
- ✅ Integration with saga orchestrator

All 200 tests pass, including:
- 5 new functional API optional task tests
- 7 builder API optional task tests
- 188 existing tests (no regressions)

## TypeScript Support

Full type inference works with optional tasks:

```typescript
const saga = fromSteps([
  step("getUser")
    .invoke(async (data: { userId: string }) => {
      return { name: "John", age: 30 }
    }),
  
  step("sendNotification")
    .invoke(async (data, context) => {
      // context.prev is typed as { name: string, age: number }
      const userName = context.prev.name
      await notify(userName)
    })
    .optional(),
  
  step("processUser")
    .invoke(async (data, context) => {
      // context.prev is typed as null | { notification result }
      // because previous task is optional
      if (context.prev !== null) {
        console.log("Notification sent")
      }
    })
])
```

## Comparison with Builder API

Both APIs provide identical functionality:

| Feature | SagaBuilder | Functional API |
|---------|-------------|----------------|
| Define steps | `.invoke()` then `.next()` | `step().invoke()` or config object |
| Mark as optional | `.optional()` | `.optional()` or `optional: true` |
| Compensation | `.compensate()` | `.compensate()` or `compensate: ...` |
| Middleware | `.withMiddleware()` | `.withMiddleware()` or `middleware: [...]` |
| Type safety | ✅ Full support | ✅ Full support |
| Event emission | ✅ `optionalTaskFailed` | ✅ `optionalTaskFailed` |

## Migration Guide

If you're using the builder API and want to switch to functional API:

### Before (SagaBuilder)
```typescript
import { SagaBuilder } from "@zrcni/distributed-saga"

const saga = SagaBuilder.start()
  .invoke(task1)
  .withName("task1")
  .next()
  .invoke(task2)
  .withName("task2")
  .optional()
  .end()
```

### After (Functional API - step builder)
```typescript
import { step, fromSteps } from "@zrcni/distributed-saga"

const saga = fromSteps([
  step("task1").invoke(task1),
  step("task2").invoke(task2).optional()
])
```

### After (Functional API - config object)
```typescript
import { fromSteps } from "@zrcni/distributed-saga"

const saga = fromSteps([
  { name: "task1", invoke: task1 },
  { name: "task2", invoke: task2, optional: true }
])
```

## Related Documentation

- [OPTIONAL_TASKS_FEATURE.md](./OPTIONAL_TASKS_FEATURE.md) - Main feature documentation
- [OPTIONAL_TASKS_IMPLEMENTATION_NOTES.md](./OPTIONAL_TASKS_IMPLEMENTATION_NOTES.md) - Technical implementation details

## Date
October 23, 2025
