# Saga Context Parameters

## Overview

As of this update, `StepInvokeCallback` and `StepMiddlewareCallback` now receive additional context parameters that provide information about the saga's hierarchy and identity.

## New Parameters

All invoke callbacks and middleware now receive three additional parameters:

1. **`sagaId`** (string): The unique identifier of the current saga
2. **`parentSagaId`** (string | null): The ID of the parent saga if this is a child saga, or `null` if this is a root saga
3. **`parentTaskId`** (string | null): The task ID in the parent saga that spawned this child saga, or `null` if this is a root saga

## Updated Signatures

### StepInvokeCallback

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
  sagaId: string,              // NEW
  parentSagaId: string | null, // NEW
  parentTaskId: string | null  // NEW
) => Promise<ResultData> | ResultData
```

### StepMiddlewareCallback

```typescript
type StepMiddlewareCallback<
  Data = unknown,
  PrevResultData = unknown,
  MiddlewareData = Record<string, unknown>,
  ResultData = Record<string, unknown>
> = (
  data: Data,
  prevResult: PrevResultData,
  middlewareData: MiddlewareData,
  sagaId: string,              // NEW
  parentSagaId: string | null, // NEW
  parentTaskId: string | null  // NEW
) => Promise<void | boolean | ResultData> | void | boolean | ResultData
```

## Usage Examples

### Basic Usage - Accessing Saga Context

```typescript
const sagaDefinition = SagaBuilder.start()
  .invoke(async (data, prevResult, middlewareData, sagaId, parentSagaId, parentTaskId) => {
    console.log(`Running in saga: ${sagaId}`)
    
    if (parentSagaId) {
      console.log(`This is a child saga of: ${parentSagaId}`)
      console.log(`Spawned by task: ${parentTaskId}`)
    } else {
      console.log('This is a root saga')
    }
    
    return { processed: true }
  })
  .withName("processWithContext")
  .end()
```

### Logging with Hierarchy Information

```typescript
const sagaDefinition = SagaBuilder.start()
  .invoke(async (
    orderData, 
    prevResult, 
    middlewareData, 
    sagaId, 
    parentSagaId, 
    parentTaskId
  ) => {
    // Create hierarchical log entry
    const logEntry = {
      sagaId,
      parentSagaId,
      parentTaskId,
      timestamp: new Date(),
      action: 'processing_order',
      orderData
    }
    
    await logService.log(logEntry)
    
    return { orderId: orderData.id, status: 'processed' }
  })
  .withName("processOrder")
  .end()
```

### Middleware with Saga Context

```typescript
const sagaDefinition = SagaBuilder.start()
  .withMiddleware(async (
    data, 
    prevResult, 
    middlewareData, 
    sagaId, 
    parentSagaId, 
    parentTaskId
  ) => {
    // Add saga context to middleware data
    return {
      sagaContext: {
        sagaId,
        parentSagaId,
        parentTaskId,
        isChildSaga: parentSagaId !== null
      }
    }
  })
  .invoke(async (data, prevResult, middlewareData) => {
    // Access saga context from middleware data
    const { sagaContext } = middlewareData
    console.log('Saga context:', sagaContext)
    
    return { success: true }
  })
  .withName("taskWithContext")
  .end()
```

### Tracking Child Sagas

```typescript
const sagaDefinition = SagaBuilder.start()
  .invoke(async (
    data, 
    prevResult, 
    middlewareData, 
    sagaId, 
    parentSagaId, 
    parentTaskId
  ) => {
    // Store relationship for tracking
    if (parentSagaId) {
      await sagaTracker.recordChildSaga({
        childSagaId: sagaId,
        parentSagaId,
        parentTaskId,
        startedAt: new Date()
      })
    }
    
    // Process task
    const result = await processTask(data)
    
    return result
  })
  .withName("trackedTask")
  .end()
```

### Building Saga Execution Tree

```typescript
interface SagaNode {
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  children: SagaNode[]
}

const sagaDefinition = SagaBuilder.start()
  .invoke(async (
    data, 
    prevResult, 
    middlewareData, 
    sagaId, 
    parentSagaId, 
    parentTaskId
  ) => {
    // Build execution tree node
    const node: SagaNode = {
      sagaId,
      parentSagaId,
      parentTaskId,
      children: []
    }
    
    // Store in distributed tracking system
    await executionTreeService.addNode(node)
    
    return { nodeId: sagaId }
  })
  .withName("buildExecutionTree")
  .end()
```

## Use Cases

These new parameters enable several advanced use cases:

1. **Hierarchical Logging**: Create structured logs that show the parent-child relationships between sagas
2. **Distributed Tracing**: Track saga execution across distributed systems with proper hierarchy
3. **Debugging**: Understand the execution flow and identify which parent saga spawned a child saga
4. **Metrics & Monitoring**: Aggregate metrics by saga hierarchy level or track child saga completion
5. **Access Control**: Implement context-aware authorization based on the parent saga's permissions
6. **Data Aggregation**: Roll up results from child sagas back to their parent
7. **Execution Trees**: Build visual representations of saga execution hierarchies

## Migration Guide

If you have existing saga definitions, you'll need to update your invoke callbacks and middleware to accept the new parameters:

### Before
```typescript
.invoke(async (data, prevResult, middlewareData) => {
  // existing logic
  return result
})
```

### After
```typescript
.invoke(async (data, prevResult, middlewareData, sagaId, parentSagaId, parentTaskId) => {
  // existing logic
  // optionally use the new parameters
  return result
})
```

**Note**: If you're not using the new parameters, you can still omit them from your function signature - JavaScript/TypeScript allows functions to ignore trailing parameters. However, for type safety, it's recommended to include all parameters in the signature.

## TypeScript Type Safety

TypeScript will enforce that all parameters are properly typed. The saga framework ensures type safety across the entire execution chain:

```typescript
type OrderData = {
  orderId: string
  amount: number
}

const sagaDefinition = SagaBuilder.start()
  .invoke(async (
    data: OrderData,           // Type-safe data
    prevResult: unknown,        // Previous step result
    middlewareData: Record<string, unknown>, // Middleware data
    sagaId: string,            // Always string
    parentSagaId: string | null, // Can be null for root sagas
    parentTaskId: string | null  // Can be null for root sagas
  ) => {
    // Full type safety and IntelliSense support
    return { orderId: data.orderId, processed: true }
  })
  .withName("processOrder")
  .end()
```
