# API Simplification - Callback Parameter Restructuring

## Overview

The saga task callback signatures have been simplified from having 5-6 individual parameters to just 2 parameters: `(data, context)`. This makes the API cleaner, more intuitive, and easier to work with.

## Breaking Changes

### Old Signature (Before)

```typescript
// Invoke callback
async (data, prevResult, middlewareData, sagaContext, saga, ctx) => {
  // Use parameters directly
  const previousValue = prevResult.value
  const middlewareValue = middlewareData.key
  const sagaId = sagaContext.sagaId
  // ...
}

// Compensate callback
async (data, taskData, middlewareData, saga, ctx) => {
  // Use parameters directly
  const originalData = taskData
  // ...
}

// Middleware callback
async (data, prevResult, middlewareData, sagaContext, saga, ctx) => {
  // Use parameters directly
  return { key: 'value' }
}
```

### New Signature (After)

```typescript
// Invoke callback - all context in one object
async (data, context) => {
  // Access context properties
  const previousValue = context.prev.value
  const middlewareValue = context.middleware.key
  const sagaId = context.sagaId
  const parentId = context.parentSagaId
  
  // Use saga API
  const isCompleted = await context.api.isTaskCompleted('someTask')
  
  // Use writable context
  await context.ctx.update({ myData: 'value' })
  const sharedData = await context.ctx.get()
  
  return { result: 'data' }
}

// Compensate callback
async (data, context) => {
  // Access compensation-specific context
  const originalData = context.taskData
  const middlewareValue = context.middleware.key
  
  // Same api and ctx access
  await context.api.isTaskCompleted('someTask')
  await context.ctx.update({ rolledBack: true })
}

// Middleware callback  
async (data, context) => {
  // Same as invoke callback
  const previousValue = context.prev
  return { key: 'value' }
}
```

## Context Structure

### TaskContext (for invoke and middleware)

```typescript
interface TaskContext<PrevResultData, MiddlewareData> {
  // Previous task's result
  prev: PrevResultData
  
  // Accumulated middleware data
  middleware: MiddlewareData
  
  // Read-only saga API
  api: ReadOnlySaga
  
  // Saga metadata
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  
  // Writable saga context
  ctx: WritableSagaContext
}
```

### CompensationContext (for compensate)

```typescript
interface CompensationContext<TaskData, MiddlewareData> {
  // Data from when task was executed
  taskData: TaskData
  
  // Accumulated middleware data
  middleware: MiddlewareData
  
  // Read-only saga API
  api: ReadOnlySaga
  
  // Saga metadata
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  
  // Writable saga context
  ctx: WritableSagaContext
}
```

## Migration Guide

### Step 1: Update Callback Signatures

**Before:**
```typescript
SagaBuilder.start()
  .invoke(async (data, prevResult, middleware, sagaContext, saga, ctx) => {
    // old code
  })
  .compensate(async (data, taskData, middleware, saga, ctx) => {
    // old code
  })
  .withMiddleware(async (data, prevResult, middleware, sagaContext, saga, ctx) => {
    // old code
  })
```

**After:**
```typescript
SagaBuilder.start()
  .invoke(async (data, context) => {
    // Access via context.prev, context.middleware, context.api, etc.
  })
  .compensate(async (data, context) => {
    // Access via context.taskData, context.api, etc.
  })
  .withMiddleware(async (data, context) => {
    // Access via context.prev, context.middleware, etc.
  })
```

### Step 2: Update Parameter Access

Replace direct parameter usage with context property access:

| Old Parameter | New Access | Notes |
|--------------|------------|-------|
| `prevResult` | `context.prev` | Previous task result |
| `middlewareData` | `context.middleware` | Accumulated middleware data |
| `saga` | `context.api` | Read-only saga interface |
| `sagaContext.sagaId` | `context.sagaId` | Direct property |
| `sagaContext.parentSagaId` | `context.parentSagaId` | Direct property |
| `sagaContext.parentTaskId` | `context.parentTaskId` | Direct property |
| `ctx` | `context.ctx` | Writable saga context |
| `taskData` | `context.taskData` | (compensate only) |

### Step 3: Update Tests

**Before:**
```typescript
const myTask = jest.fn(async (data, prevResult, middleware, sagaContext, saga, ctx) => {
  return { result: prevResult.value + 1 }
})

expect(myTask).toHaveBeenCalledWith(
  { id: 1 },
  { value: 10 },
  {},
  { sagaId: "test", parentSagaId: null, parentTaskId: null },
  expect.objectContaining({ sagaId: "test" }),
  expect.objectContaining({ get: expect.any(Function) })
)
```

**After:**
```typescript
const myTask = jest.fn(async (data, context) => {
  return { result: context.prev.value + 1 }
})

expect(myTask).toHaveBeenCalledWith(
  { id: 1 },
  expect.objectContaining({
    prev: { value: 10 },
    middleware: {},
    sagaId: "test",
    parentSagaId: null,
    parentTaskId: null,
    api: expect.objectContaining({ sagaId: "test" }),
    ctx: expect.objectContaining({ 
      get: expect.any(Function),
      update: expect.any(Function)
    })
  })
)
```

## Examples

### Example 1: Simple Task Chain

**Before:**
```typescript
const orderSaga = SagaBuilder.start()
  .invoke(async (data, _, __, ___, ____, ctx) => {
    const total = calculateTotal(data.items)
    await ctx.update({ total })
    return { total }
  })
  .withName("calculateTotal")
  .next()
  .invoke(async (data, prevResult, __, ___, saga, ctx) => {
    const context = await ctx.get()
    const paymentId = await processPayment(context.total)
    return { paymentId }
  })
  .withName("processPayment")
  .end()
```

**After:**
```typescript
const orderSaga = SagaBuilder.start()
  .invoke(async (data, context) => {
    const total = calculateTotal(data.items)
    await context.ctx.update({ total })
    return { total }
  })
  .withName("calculateTotal")
  .next()
  .invoke(async (data, context) => {
    const sharedContext = await context.ctx.get()
    const paymentId = await processPayment(sharedContext.total)
    return { paymentId }
  })
  .withName("processPayment")
  .end()
```

### Example 2: Using Previous Result

**Before:**
```typescript
.invoke(async (data, prevResult, middlewareData) => {
  const previousValue = prevResult?.value || 0
  return { value: previousValue + 1 }
})
```

**After:**
```typescript
.invoke(async (data, context) => {
  const previousValue = context.prev?.value || 0
  return { value: previousValue + 1 }
})
```

### Example 3: Using Middleware Data

**Before:**
```typescript
.withMiddleware(async (data) => {
  return { validated: true, timestamp: Date.now() }
})
.invoke(async (data, prevResult, middlewareData) => {
  if (!middlewareData.validated) {
    throw new Error('Not validated')
  }
  return { success: true }
})
```

**After:**
```typescript
.withMiddleware(async (data) => {
  return { validated: true, timestamp: Date.now() }
})
.invoke(async (data, context) => {
  if (!context.middleware.validated) {
    throw new Error('Not validated')
  }
  return { success: true }
})
```

### Example 4: Using Saga API

**Before:**
```typescript
.invoke(async (data, prevResult, middlewareData, sagaContext, saga) => {
  const taskIds = await saga.getTaskIds()
  const isCompleted = await saga.isTaskCompleted('previousTask')
  return { taskIds, isCompleted }
})
```

**After:**
```typescript
.invoke(async (data, context) => {
  const taskIds = await context.api.getTaskIds()
  const isCompleted = await context.api.isTaskCompleted('previousTask')
  return { taskIds, isCompleted }
})
```

### Example 5: Compensation

**Before:**
```typescript
.compensate(async (data, taskData, middlewareData, saga, ctx) => {
  const context = await ctx.get()
  await refundPayment(context.paymentId)
})
```

**After:**
```typescript
.compensate(async (data, context) => {
  const sharedContext = await context.ctx.get()
  await refundPayment(sharedContext.paymentId)
})
```

## Benefits

1. **Cleaner API**: Two parameters instead of 5-6
2. **Better Discoverability**: IDE autocomplete shows all available properties in `context`
3. **Easier to Remember**: No need to remember parameter order
4. **Future-Proof**: Adding new context properties won't break existing code
5. **Consistent**: Same pattern for all callback types

## Implementation Details

### Type Definitions

The new types are defined in `src/sagas/saga-definition/types.ts`:

```typescript
export interface TaskContext<PrevResultData, MiddlewareData> {
  prev: PrevResultData
  middleware: MiddlewareData
  api: ReadOnlySaga
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  ctx: WritableSagaContext
}

export interface CompensationContext<TaskData, MiddlewareData> {
  taskData: TaskData
  middleware: MiddlewareData
  api: ReadOnlySaga
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  ctx: WritableSagaContext
}
```

### Orchestrator Changes

The `SagaOrchestrator` now has helper methods to create context objects:

```typescript
private createTaskContext<StartPayload, PrevResultData, MiddlewareData>(
  saga: Saga<StartPayload>,
  prevResult: PrevResultData,
  middlewareData: MiddlewareData
): TaskContext<PrevResultData, MiddlewareData>

private createCompensationContext<StartPayload, TaskData, MiddlewareData>(
  saga: Saga<StartPayload>,
  taskData: TaskData,
  middlewareData: MiddlewareData
): CompensationContext<TaskData, MiddlewareData>
```

## Backward Compatibility

This is a **breaking change**. The old signature is no longer supported. All saga definitions and tests must be updated to use the new signature.

The old `SagaContext` interface is marked as deprecated but still exists for reference.

## Migration Checklist

- [ ] Update all `.invoke()` callbacks to use `(data, context)` signature
- [ ] Update all `.compensate()` callbacks to use `(data, context)` signature
- [ ] Update all `.withMiddleware()` callbacks to use `(data, context)` signature
- [ ] Replace `prevResult` with `context.prev`
- [ ] Replace `middlewareData` with `context.middleware`
- [ ] Replace `saga` with `context.api`
- [ ] Replace `sagaContext.sagaId` with `context.sagaId`
- [ ] Replace `sagaContext.parentSagaId` with `context.parentSagaId`
- [ ] Replace `sagaContext.parentTaskId` with `context.parentTaskId`
- [ ] Replace `ctx` with `context.ctx`
- [ ] In compensate: replace `taskData` with `context.taskData`
- [ ] Update all test mocks to use new signature
- [ ] Update all test expectations to use new context structure
- [ ] Test all sagas thoroughly

## See Also

- [Saga Context Feature](./SAGA_CONTEXT.md) - Using shared saga context
- [API Documentation](../../README.md) - Main documentation
