# Saga Context Feature - Implementation Summary

## Overview

Implemented saga-level shared context that allows tasks within a saga to read and update shared data throughout the saga lifecycle.

## Changes Made

### 1. Core State Management

#### `src/sagas/SagaState.ts`
- Added `sagaContext: Record<string, any>` property to store shared context
- Added `getSagaContext<T>()` method for type-safe context retrieval
- Added `updateSagaContext(updates)` method to merge context updates

#### `src/sagas/SagaMessage.ts`
- Added `UpdateSagaContext` message type
- Added `createUpdateSagaContextMessage()` factory function

#### `src/sagas/saga-state-update.ts`
- Added handler for `UpdateSagaContext` messages
- Validates that context cannot be updated after saga completion/abortion
- Merges updates with existing context using spread operator

### 2. Saga Instance Methods

#### `src/sagas/Saga.ts`
- Added `getSagaContext<T>()` method that returns wrapped state method in Result type
- Added `updateSagaContext(updates)` method that sends UpdateSagaContext message
- Updated `asReadOnly()` to include `getSagaContext` in ReadOnlySaga interface

### 3. Type System

#### `src/sagas/saga-definition/types.ts`
- Added `WritableSagaContext` interface with `get<T>()` and `update()` methods
- Updated `ReadOnlySaga` interface to include `getSagaContext<T>()` method
- Updated all callback type signatures:
  - `StepInvokeCallback`: Added `ctx: WritableSagaContext` as 6th parameter
  - `StepCompensateCallback`: Added `ctx: WritableSagaContext` as 5th parameter
  - `StepMiddlewareCallback`: Added `ctx: WritableSagaContext` as 6th parameter

### 4. Orchestrator Integration

#### `src/sagas/SagaOrchestrator.ts`
- Added `createWritableContext()` helper method to wrap saga context access
- Updated `executeSteps()` to pass writable context to `step.invokeCallback()`
- Updated `runMiddleware()` to create and pass writable context to middleware callbacks
- Updated `compensate()` to pass writable context to `step.compensateCallback()`

### 5. Documentation

#### `docs/generated/SAGA_CONTEXT.md`
- Comprehensive feature documentation
- API reference with interface definitions
- Usage examples for common patterns:
  - Accumulating data across tasks
  - Progress tracking
  - Using context in compensation
- Implementation details
- Best practices and migration guide

### 6. Examples

#### `examples/saga-context-example.ts`
- Complete working example demonstrating order processing saga
- Shows how to:
  - Calculate and store shared data (total amount)
  - Pass data between tasks using context
  - Read context in compensation logic
  - Display accumulated context at the end

### 7. Test Updates

#### Updated test expectations in:
- `src/sagas/saga-definition/__tests__/functional.test.ts`
- `src/sagas/__tests__/SagaOrchestrator.test.ts`

All callback assertion expectations now include the `ctx` parameter with `get` and `update` functions.

## Key Features

### Persistence
- Context is stored in `SagaState.sagaContext`
- Updates are persisted through the message system
- Context survives saga recovery and reconstruction

### Type Safety
- Generic `get<T>()` method for typed context access
- TypeScript interfaces ensure proper callback signatures
- Optional properties support gradual context population

### Async API
- Both `get()` and `update()` return Promises
- Supports async persistence layers (MongoDB, etc.)
- Compatible with existing async saga operations

### Merging Behavior
- Updates merge with existing context (spread operator)
- Allows multiple tasks to contribute to context
- No accidental overwrites of unrelated context data

### Validation
- Prevents context updates after saga completion
- Prevents context updates after saga abortion
- Returns meaningful error messages

## Use Cases

1. **Order Processing**: Calculate totals, track payment IDs, shipping IDs across tasks
2. **Data Pipelines**: Track records processed, validation results, performance metrics
3. **User Onboarding**: Track completed steps, progress percentage, created resource IDs
4. **Multi-Step Workflows**: Share metadata, timestamps, accumulated results

## Testing

- All existing tests pass (188 total)
- Test suite updated to expect new `ctx` parameter
- Example runs successfully and demonstrates feature
- Full build completes without errors

## Migration Impact

Existing saga definitions need to update callback signatures to include the new `ctx` parameter:

```typescript
// Before
.invoke(async (data, prevResult, middleware, sagaContext, saga) => { ... })

// After  
.invoke(async (data, prevResult, middleware, sagaContext, saga, ctx) => { ... })
```

If context is not needed, the parameter can be prefixed with underscore to indicate it's unused:

```typescript
.invoke(async (data, prevResult, middleware, sagaContext, saga, _ctx) => { ... })
```

## Files Modified

1. `src/sagas/SagaState.ts`
2. `src/sagas/SagaMessage.ts`
3. `src/sagas/saga-state-update.ts`
4. `src/sagas/Saga.ts`
5. `src/sagas/saga-definition/types.ts`
6. `src/sagas/SagaOrchestrator.ts`
7. `src/sagas/saga-definition/__tests__/functional.test.ts`
8. `src/sagas/__tests__/SagaOrchestrator.test.ts`

## Files Created

1. `docs/generated/SAGA_CONTEXT.md`
2. `examples/saga-context-example.ts`

## Verification

✅ TypeScript compilation successful (CJS and ESM)
✅ All 188 tests passing
✅ Example runs successfully
✅ Documentation complete
✅ Feature working as designed
