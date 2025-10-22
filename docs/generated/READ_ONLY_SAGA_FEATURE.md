# Read-Only Saga Access in Step Callbacks

## Overview
Step callbacks now have access to a read-only version of the Saga instance, allowing them to read task data and results from other steps without being able to modify the saga state.

## Motivation
In complex workflows, later steps often need to access data from earlier steps beyond just the immediately previous result. For example:
- A final step might need to aggregate results from multiple previous tasks
- Compensation logic might need to read multiple task results to properly clean up
- Conditional logic might depend on checking if certain tasks completed successfully

Previously, callbacks could only access:
- `data` - The initial saga data
- `prevResult` - The result from the immediately previous step
- `middlewareData` - Data accumulated from middleware
- `sagaContext` - Basic metadata (sagaId, parentSagaId, parentTaskId)

Now callbacks can also access:
- **`saga` - A read-only view of the entire saga instance**

## Read-Only Saga Interface

The `ReadOnlySaga` interface provides safe read-only access:

```typescript
interface ReadOnlySaga {
  readonly sagaId: string
  
  // Read saga state
  getJob(): Promise<unknown>
  isSagaAborted(): Promise<boolean>
  isSagaCompleted(): Promise<boolean>
  
  // Read task information
  getTaskIds(): Promise<string[]>
  isTaskStarted(taskId: string): Promise<boolean>
  isTaskCompleted(taskId: string): Promise<boolean>
  
  // Read task data
  getStartTaskData(taskId: string): Promise<unknown>
  getEndTaskData<D = unknown>(taskId: string): Promise<D | undefined>
  
  // Read compensation information
  isCompensatingTaskStarted(taskId: string): Promise<boolean>
  isCompensatingTaskCompleted(taskId: string): Promise<boolean>
  getStartCompensatingTaskData(taskId: string): Promise<unknown>
  getEndCompensatingTaskData(taskId: string): Promise<unknown>
}
```

**Important**: Mutation methods like `startTask()`, `endTask()`, `abortSaga()`, etc. are **not** available. The saga parameter is strictly read-only.

## Updated Callback Signatures

### Step Invoke Callback
```typescript
type StepInvokeCallback<
  Data = unknown,
  PrevResultData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  prevResult: PrevResultData,
  middlewareData: MiddlewareData,
  sagaContext: SagaContext,
  saga: ReadOnlySaga  // <-- NEW!
) => Promise<ResultData> | ResultData
```

### Step Compensate Callback
```typescript
type StepCompensateCallback<
  Data = unknown,
  TaskData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  taskData: TaskData,
  middlewareData: MiddlewareData,
  saga: ReadOnlySaga  // <-- NEW!
) => Promise<ResultData> | ResultData
```

## Usage Examples

### Example 1: Accessing Multiple Task Results

```typescript
const orderSaga = SagaBuilder.start()
  .invoke(async () => {
    // Create user account
    return { userId: "usr_123", email: "user@example.com" }
  })
  .withName("createUser")
  .next()
  
  .invoke(async () => {
    // Process payment
    return { transactionId: "txn_456", amount: 99.99 }
  })
  .withName("processPayment")
  .next()
  
  .invoke(async (data, prevResult, middlewareData, sagaContext, saga) => {
    // Final step: Create order using data from multiple previous tasks
    
    // Read user creation result
    const userData = await saga.getEndTaskData("createUser")
    console.log("User:", userData) // { userId: "usr_123", email: "user@example.com" }
    
    // Read payment result
    const paymentData = await saga.getEndTaskData("processPayment")
    console.log("Payment:", paymentData) // { transactionId: "txn_456", amount: 99.99 }
    
    // Create order with all the information
    return {
      orderId: "ord_789",
      userId: userData.userId,
      transactionId: paymentData.transactionId,
      amount: paymentData.amount,
      status: "completed"
    }
  })
  .withName("createOrder")
  .end()
```

### Example 2: Conditional Logic Based on Task Completion

```typescript
const deploymentSaga = SagaBuilder.start()
  .invoke(async () => ({ deployed: true, version: "1.2.3" }))
  .withName("deployApp")
  .next()
  
  .invoke(async () => ({ migrated: true, rows: 1500 }))
  .withName("migrateDatabase")
  .next()
  
  .invoke(async (data, prevResult, middlewareData, sagaContext, saga) => {
    // Send notification only if both tasks completed
    const deployCompleted = await saga.isTaskCompleted("deployApp")
    const migrateCompleted = await saga.isTaskCompleted("migrateDatabase")
    
    if (deployCompleted && migrateCompleted) {
      const deployData = await saga.getEndTaskData("deployApp")
      const migrateData = await saga.getEndTaskData("migrateDatabase")
      
      return {
        message: `Deployed version ${deployData.version}, migrated ${migrateData.rows} rows`,
        sent: true
      }
    }
    
    return { sent: false }
  })
  .withName("sendNotification")
  .end()
```

### Example 3: Smart Compensation Using Multiple Task Data

```typescript
const saga = SagaBuilder.start()
  .invoke(async () => ({ resourceId: "res_123", created: true }))
  .compensate(async (data, taskData, middlewareData, saga) => {
    // Check if other tasks completed before compensating
    const paymentCompleted = await saga.isTaskCompleted("chargePayment")
    
    if (paymentCompleted) {
      // If payment was charged, we need to refund before deleting resource
      const paymentData = await saga.getEndTaskData("chargePayment")
      console.log("Need to refund:", paymentData.transactionId)
    }
    
    // Delete the resource
    return { deleted: taskData.resourceId }
  })
  .withName("createResource")
  .next()
  
  .invoke(async () => ({ transactionId: "txn_456", charged: true }))
  .compensate(async (data, taskData, middlewareData, saga) => {
    // Refund the payment
    return { refunded: taskData.transactionId }
  })
  .withName("chargePayment")
  .end()
```

### Example 4: Aggregating Results from All Tasks

```typescript
const batchProcessSaga = SagaBuilder.start()
  .invoke(async () => ({ processed: 100, errors: 2 }))
  .withName("batch1")
  .next()
  
  .invoke(async () => ({ processed: 150, errors: 0 }))
  .withName("batch2")
  .next()
  
  .invoke(async () => ({ processed: 200, errors: 5 }))
  .withName("batch3")
  .next()
  
  .invoke(async (data, prevResult, middlewareData, sagaContext, saga) => {
    // Aggregate results from all batches
    const taskIds = await saga.getTaskIds()
    
    let totalProcessed = 0
    let totalErrors = 0
    
    for (const taskId of taskIds) {
      if (await saga.isTaskCompleted(taskId)) {
        const result = await saga.getEndTaskData(taskId)
        totalProcessed += result.processed
        totalErrors += result.errors
      }
    }
    
    return {
      summary: {
        totalProcessed,
        totalErrors,
        successRate: ((totalProcessed - totalErrors) / totalProcessed * 100).toFixed(2) + "%"
      }
    }
  })
  .withName("generateReport")
  .end()
```

## Implementation Details

### How It Works

1. **Read-Only Proxy**: The `Saga` class has an `asReadOnly()` method that returns a `ReadOnlySaga` object:

```typescript
class Saga<StartPayload = unknown> {
  asReadOnly(): ReadOnlySaga {
    return {
      sagaId: this.sagaId,
      getJob: () => this.getJob(),
      getTaskIds: () => this.getTaskIds(),
      isTaskStarted: (taskId: string) => this.isTaskStarted(taskId),
      getStartTaskData: (taskId: string) => this.getStartTaskData(taskId),
      isTaskCompleted: (taskId: string) => this.isTaskCompleted(taskId),
      getEndTaskData: <D = unknown>(taskId: string) => this.getEndTaskData<D>(taskId),
      // ... other read methods
    }
  }
}
```

2. **Orchestrator Integration**: The `SagaOrchestrator` passes the read-only saga to callbacks:

```typescript
// In executeSteps
const result = await step.invokeCallback(
  data, 
  prevStepResult, 
  middlewareData,
  sagaContext,
  saga.asReadOnly()  // <-- Pass read-only view
)

// In compensate
const result = await step.compensateCallback(
  data, 
  taskData, 
  {}, 
  saga.asReadOnly()  // <-- Pass read-only view
)
```

3. **Type Safety**: TypeScript ensures you can't call mutation methods on the `ReadOnlySaga` interface.

## Migration Guide

### Updating Existing Callbacks

If you have existing saga definitions, you don't need to change them immediately. The new `saga` parameter is simply added as an additional parameter at the end.

**Before:**
```typescript
.invoke(async (data, prevResult, middlewareData, sagaContext) => {
  return { result: "success" }
})
```

**After (optional - add if you need it):**
```typescript
.invoke(async (data, prevResult, middlewareData, sagaContext, saga) => {
  // Now you can read other task data if needed
  const otherTaskData = await saga.getEndTaskData("otherTask")
  return { result: "success", otherTaskData }
})
```

### TypeScript Compatibility

The callback signatures are backward compatible. If you have typed callbacks, you can optionally add the saga parameter:

```typescript
const myCallback: StepInvokeCallback = async (data, prevResult, middlewareData, sagaContext, saga) => {
  // saga parameter is now available
  const taskData = await saga.getEndTaskData("someTask")
  return taskData
}
```

## Best Practices

1. **Use for Cross-Task Dependencies**: When a step needs data from multiple previous tasks, use the saga parameter instead of passing data through each step.

2. **Check Task Completion**: Always verify a task is completed before reading its data:
   ```typescript
   if (await saga.isTaskCompleted("taskName")) {
     const data = await saga.getEndTaskData("taskName")
   }
   ```

3. **Don't Abuse**: For simple sequential workflows where each step only needs the previous result, continue using the `prevResult` parameter. The saga parameter is for more complex scenarios.

4. **Compensation Logic**: In compensation callbacks, the saga parameter is especially useful for checking what was actually completed before deciding how to compensate.

5. **Type Safety**: Use TypeScript generic types when calling `getEndTaskData` for better type safety:
   ```typescript
   const userData = await saga.getEndTaskData<{ userId: string; email: string }>("createUser")
   ```

## Testing

Tests can verify callbacks receive the read-only saga and can access task data:

```typescript
it("should pass read-only saga to callbacks", async () => {
  const task1 = jest.fn(async () => ({ result: "task1" }))
  const task2 = jest.fn(async (data, prevResult, middlewareData, sagaContext, saga) => {
    expect(typeof saga.getEndTaskData).toBe("function")
    expect(saga.sagaId).toBeDefined()
    
    const task1Data = await saga.getEndTaskData("task1")
    expect(task1Data).toEqual({ result: "task1" })
    
    return { combined: task1Data }
  })
  
  const sagaDef = SagaBuilder.start()
    .invoke(task1).withName("task1").next()
    .invoke(task2).withName("task2").end()
  
  // ... run the saga
})
```

## Performance Considerations

- **Lazy Evaluation**: Task data is only retrieved when you call the getter methods
- **No Additional State**: The read-only view doesn't create copies; it's a lightweight proxy
- **Async Methods**: All data access methods are async to maintain consistency with the saga state access patterns

## Limitations

1. **Cannot Modify State**: By design, the read-only saga cannot modify saga state. If you need to start child sagas or modify state, use the appropriate saga coordinator methods outside of step callbacks.

2. **Current Saga Only**: The read-only saga only provides access to the current saga's state, not parent or child sagas. Use `sagaContext.parentSagaId` if you need parent saga information.

3. **No Real-Time Updates**: The saga state reflects the state when the callback is invoked. Concurrent modifications by other parts of the system won't be visible.

## Summary

Adding read-only saga access to step callbacks enables:
- ✅ Reading results from multiple previous tasks
- ✅ Conditional logic based on task completion status
- ✅ Smart compensation using data from multiple tasks
- ✅ Aggregating results from all completed tasks
- ✅ Type-safe, read-only access without mutation risks

This makes complex workflows more maintainable and reduces the need to pass data through every intermediate step.
