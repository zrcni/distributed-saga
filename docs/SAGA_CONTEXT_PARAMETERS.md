# Saga Context Parameters

## Overview

As of this update, `StepInvokeCallback` and `StepMiddlewareCallback` now receive a `SagaContext` object that provides safe, read-only access to saga metadata without exposing the full saga instance.

## SagaContext Interface

The `SagaContext` interface provides safe access to saga hierarchy information:

```typescript
interface SagaContext {
  readonly sagaId: string
  readonly parentSagaId: string | null
  readonly parentTaskId: string | null
}
```

**Key Design Principles:**
- **Read-only**: All properties are readonly to prevent accidental modifications
- **Serialized Data**: Contains only primitive values, no references to internal saga state
- **Safe Access**: Middleware and callbacks cannot call saga methods or modify internal state
- **Hierarchy Tracking**: Provides full context about parent-child saga relationships

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
  sagaContext: SagaContext  // NEW: Single context object
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
  sagaContext: SagaContext  // NEW: Single context object
) => Promise<void | boolean | ResultData> | void | boolean | ResultData
```

## Usage Examples

### Basic Usage - Accessing Saga Context

```typescript
const sagaDefinition = SagaBuilder.start()
  .invoke(async (data, prevResult, middlewareData, sagaContext) => {
    console.log(`Running in saga: ${sagaContext.sagaId}`)
    
    if (sagaContext.parentSagaId) {
      console.log(`This is a child saga of: ${sagaContext.parentSagaId}`)
      console.log(`Spawned by task: ${sagaContext.parentTaskId}`)
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
    sagaContext
  ) => {
    // Create hierarchical log entry
    const logEntry = {
      ...sagaContext,  // Spread the context object
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
    sagaContext
  ) => {
    // Add saga context to middleware data
    return {
      sagaContext,  // Pass the entire context object
      isChildSaga: sagaContext.parentSagaId !== null
    }
  })
  .invoke(async (data, prevResult, middlewareData, sagaContext) => {
    // Access saga context from both sources
    console.log('From parameter:', sagaContext)
    console.log('From middleware:', middlewareData.sagaContext)
    
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
    sagaContext
  ) => {
    // Store relationship for tracking
    if (sagaContext.parentSagaId) {
      await sagaTracker.recordChildSaga({
        childSagaId: sagaContext.sagaId,
        parentSagaId: sagaContext.parentSagaId,
        parentTaskId: sagaContext.parentTaskId,
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
    sagaContext
  ) => {
    // Build execution tree node from context
    const node: SagaNode = {
      ...sagaContext,
      children: []
    }
    
    // Store in distributed tracking system
    await executionTreeService.addNode(node)
    
    return { nodeId: sagaContext.sagaId }
  })
  .withName("buildExecutionTree")
  .end()
```

### Destructuring Context

```typescript
const sagaDefinition = SagaBuilder.start()
  .invoke(async (
    data, 
    prevResult, 
    middlewareData, 
    { sagaId, parentSagaId, parentTaskId }  // Destructure for convenience
  ) => {
    // Use individual properties directly
    if (parentSagaId) {
      console.log(`Child saga ${sagaId} of parent ${parentSagaId}`)
    }
    
    return { processed: true }
  })
  .withName("destructuredContext")
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

If you have existing saga definitions, you'll need to update your invoke callbacks and middleware to accept the new `SagaContext` parameter:

### Before
```typescript
.invoke(async (data, prevResult, middlewareData) => {
  // existing logic
  return result
})
```

### After (Option 1 - Accept full context)
```typescript
.invoke(async (data, prevResult, middlewareData, sagaContext) => {
  // existing logic
  // optionally use sagaContext.sagaId, sagaContext.parentSagaId, etc.
  return result
})
```

### After (Option 2 - Destructure context)
```typescript
.invoke(async (data, prevResult, middlewareData, { sagaId, parentSagaId, parentTaskId }) => {
  // existing logic with destructured context
  return result
})
```

**Note**: If you're not using the context parameter, you can still omit it from your function signature - JavaScript/TypeScript allows functions to ignore trailing parameters. However, for type safety and future compatibility, it's recommended to include the parameter in the signature.

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
    sagaContext: SagaContext   // Readonly context object
  ) => {
    // Full type safety and IntelliSense support
    // sagaContext properties are readonly and cannot be modified
    console.log(sagaContext.sagaId)  // ✓ OK
    // sagaContext.sagaId = 'new-id'  // ✗ Error: Cannot assign to 'sagaId' because it is a read-only property
    
    return { orderId: data.orderId, processed: true }
  })
  .withName("processOrder")
  .end()
```

## Security & Safety Benefits

The `SagaContext` interface provides several safety guarantees:

1. **Immutability**: All properties are `readonly`, preventing accidental modifications
2. **Encapsulation**: Callbacks cannot access internal saga methods or state
3. **Serializable**: Contains only primitive values that can be safely logged or transmitted
4. **Type-safe**: TypeScript enforces correct usage at compile time
5. **No Side Effects**: Middleware cannot call saga methods like `startTask()` or `endTask()`

### Why This Matters

Previously, if middleware had access to the full `Saga` instance, it could potentially:
- Call methods that modify saga state (e.g., `saga.startTask()`)
- Access internal implementation details
- Create race conditions or inconsistent state
- Break saga orchestration logic

Now with `SagaContext`, callbacks and middleware can only:
- Read saga metadata (ID, parent information)
- Log and track saga execution
- Make routing decisions based on hierarchy
- Safely pass context to external systems

This design follows the **principle of least privilege** - callbacks get exactly the information they need, nothing more.
