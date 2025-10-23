# Result Class Removal Migration

## Summary

Removed the custom `Result` class pattern from the distributed-saga library and replaced it with standard JavaScript/TypeScript error handling (try-catch with thrown errors). This modernizes the codebase and makes it more idiomatic.

## Status: 🟡 Core Complete, Tests/Examples Pending

### ✅ Completed
- All core library code converted (src/sagas/*)
- All package code converted (packages/api/*, packages/express/*)
- SagaLog implementations updated
- SagaCoordinator, Saga, SagaOrchestrator converted
- Type definitions updated

### ⏳ Remaining
- ~60 test file assertions need updating
- ~18 example file locations need updating  
- Result.ts file removal and export cleanup

## Changes Made

### Before (Result Pattern)
```typescript
// Old API - methods returned Result<T>
const result = await coordinator.createSaga("id", data)
if (result.isError()) {
  console.error(result.data) // error object
  return
}
const saga = result.data // actual saga

const messages = await log.getMessages(sagaId)
if (messages.isError()) {
  throw messages.data
}
return messages.data
```

### After (Standard Exceptions)
```typescript
// New API - methods return T directly or throw
const saga = await coordinator.createSaga("id", data) // throws on error

try {
  const messages = await log.getMessages(sagaId) // throws on error
  return messages
} catch (error) {
  console.error(error)
}
```

## Breaking Changes

### 1. SagaLog Interface
All methods now throw errors instead of returning `Result`:

```typescript
// Before
interface SagaLog {
  getMessages(sagaId: string): Promise<ResultOk<SagaMessage[]> | ResultError>
  startSaga<D>(sagaId: string, job: D): Promise<ResultOk | ResultError>
  logMessage(msg: SagaMessage): Promise<ResultOk | ResultError>
  deleteSaga(sagaId: string): Promise<ResultOk | ResultError>
}

// After
interface SagaLog {
  getMessages(sagaId: string): Promise<SagaMessage[]> // throws
  startSaga<D>(sagaId: string, job: D): Promise<void> // throws
  logMessage(msg: SagaMessage): Promise<void> // throws
  deleteSaga(sagaId: string): Promise<void> // throws
}
```

### 2. Saga Methods
All saga state modification methods now return `Promise<void>` and throw on error:

```typescript
// Before
const result = await saga.startTask(taskId, data)
if (result.isError()) {
  throw result.data
}

// After
await saga.startTask(taskId, data) // throws on error
```

Changed methods:
- `updateSagaContext()`
- `endSaga()`
- `abortSaga()`
- `startTask()`
- `endTask()`
- `startCompensatingTask()`
- `endCompensatingTask()`

### 3. SagaCoordinator Methods
```typescript
// Before
interface SagaCoordinator {
  createSaga<D>(sagaId: string, job: D): Promise<ResultOk<Saga<D>> | ResultError>
  recoverSagaState<D>(sagaId: string, type: SagaRecoveryType): Promise<ResultOk<Saga<D>> | ResultError>
  abortSagaWithChildren(sagaId: string): Promise<ResultOk | ResultError>
  deleteSagaWithChildren(sagaId: string): Promise<ResultOk | ResultError>
}

// After
interface SagaCoordinator {
  createSaga<D>(sagaId: string, job: D): Promise<Saga<D>> // throws
  recoverSagaState<D>(sagaId: string, type: SagaRecoveryType): Promise<Saga<D>> // throws
  abortSagaWithChildren(sagaId: string): Promise<void> // throws
  deleteSagaWithChildren(sagaId: string): Promise<void> // throws
}
```

### 4. SagaRecovery
```typescript
// Before
const result = await SagaRecovery.recoverState(sagaId, coordinator)
if (result.isError()) return result
const state = result.data

// After
const state = await SagaRecovery.recoverState(sagaId, coordinator)
// Returns SagaState | null, throws on error
```

### 5. Helper Functions
`updateSagaState()` now returns `void` and throws:

```typescript
// Before
const result = updateSagaState(state, msg)
if (result.isError()) {
  return result
}

// After
updateSagaState(state, msg) // throws on error
```

## Migration Guide

### For Library Users

If you're using the distributed-saga library in your code:

**1. Remove Result checks from saga creation:**
```typescript
// Before
const result = await coordinator.createSaga("order-123", orderData)
if (result.isError()) {
  console.error("Failed to create saga:", result.data)
  return
}
const saga = result.data

// After
try {
  const saga = await coordinator.createSaga("order-123", orderData)
  // use saga...
} catch (error) {
  console.error("Failed to create saga:", error)
  return
}
```

**2. Update saga orchestrator usage:**
```typescript
// Before
const result = await orchestrator.run(saga, definition)
if (result.isError()) {
  await saga.abortSaga() // This also returned Result
}

// After
try {
  await orchestrator.run(saga, definition)
} catch (error) {
  await saga.abortSaga() // Now throws instead of returning Result
}
```

**3. Remove `.data` accessors:**
```typescript
// Before
const messagesResult = await log.getMessages(sagaId)
if (messagesResult.isOk()) {
  for (const msg of messagesResult.data) {
    // process message
  }
}

// After
try {
  const messages = await log.getMessages(sagaId)
  for (const msg of messages) {
    // process message
  }
} catch (error) {
  // saga not found or other error
}
```

### For Test Files

**Pattern 1: Simple Result checks**
```typescript
// Before
const result = await coordinator.createSaga("test", data)
expect(result).toBeOkResult()
if (result.isError()) return
const saga = result.data

// After
const saga = await coordinator.createSaga("test", data)
```

**Pattern 2: Error expectations**
```typescript
// Before
const result = await log.startSaga(sagaId, data)
expect(result.isError()).toBe(true)

// After
await expect(log.startSaga(sagaId, data)).rejects.toThrow()
// Or more specific:
await expect(log.startSaga(sagaId, data)).rejects.toThrow(SagaAlreadyRunningError)
```

**Pattern 3: Data access**
```typescript
// Before
const result = await log.getMessages(sagaId)
if (result.isOk()) {
  expect(result.data).toHaveLength(3)
  expect(result.data[0].msgType).toBe(SagaMessageType.StartSaga)
}

// After
const messages = await log.getMessages(sagaId)
expect(messages).toHaveLength(3)
expect(messages[0].msgType).toBe(SagaMessageType.StartSaga)
```

### For Examples

Update example files to use try-catch:

```typescript
// Before (examples/saga-plugins-example.ts)
const sagaResult = await orchestrator.run(saga, definition)
if (!sagaResult.isOk()) {
  console.error("Saga failed:", sagaResult.data)
  return
}

// After
try {
  await orchestrator.run(saga, definition)
  console.log("Saga completed successfully")
} catch (error) {
  console.error("Saga failed:", error)
  return
}
```

## Files Modified

### Core Library
- `src/sagas/types.ts` - Updated SagaLog interface
- `src/sagas/InMemorySagaLog.ts` - Converted to throw errors
- `src/sagas/MongoDBSagaLog.ts` - Converted to throw errors  
- `src/sagas/SagaCoordinator.ts` - Removed Result handling
- `src/sagas/Saga.ts` - Updated all methods to throw
- `src/sagas/SagaRecovery.ts` - Throws instead of returning Result
- `src/sagas/saga-state-update.ts` - `updateSagaState()` throws
- `src/sagas/SagaOrchestrator.ts` - Removed Result checks

### Packages
- `packages/api/src/SagaAdapter.ts` - Updated to throw errors

### Pending Updates
- `src/sagas/__tests__/*.test.ts` - ~60 locations
- `src/sagas/saga-definition/__tests__/*.test.ts` - ~40 locations
- `examples/saga-plugins-example.ts` - ~4 locations
- `examples/with-express-dashboard/index.ts` - ~14 locations
- `examples/saga-context-example.ts` - ~1 location
- `setup-tests.ts` - Remove `toBeOkResult` matcher
- `src/index.ts` - Remove Result export
- `src/Result.ts` - Delete file

## Testing Strategy

After completing the remaining updates:

1. **Run all tests**: `npm test`
2. **Check examples**: Run each example and verify behavior
3. **Verify error handling**: Ensure errors properly propagate
4. **Check TypeScript compilation**: `npm run build`

## Rationale

### Why Remove Result?

1. **Idiomatic JavaScript/TypeScript**: Standard exception handling is more familiar to most developers
2. **Reduced Complexity**: One less abstraction to learn and maintain
3. **Better Stack Traces**: Native errors provide better debugging information
4. **Framework Integration**: Easier to integrate with frameworks that expect thrown errors
5. **Less Boilerplate**: No need for constant `isError()` checks

### Why Not Keep Result?

The Result pattern can be useful in some contexts (Rust, functional programming), but for this library:
- Most operations are inherently exceptional (saga not found, etc.)
- The pattern was adding cognitive overhead without clear benefits
- Error recovery was typically done at saga level, not per-operation
- The `try-catch` approach is more natural for async operations

## Notes

- All error types (SagaAlreadyRunningError, SagaNotRunningError, etc.) are preserved
- Error messages and context remain the same
- The library now follows JavaScript best practices for error handling
- Breaking change requires major version bump (0.1.0 → 1.0.0)

## Completion Checklist

- [x] Update SagaLog interface and implementations
- [x] Update Saga class
- [x] Update SagaCoordinator
- [x] Update SagaOrchestrator
- [x] Update SagaRecovery
- [x] Update saga-state-update
- [x] Update packages/api
- [ ] Update test files (~60 locations)
- [ ] Update example files (~18 locations)
- [ ] Remove Result.ts exports
- [ ] Delete Result.ts file
- [ ] Remove toBeOkResult matcher
- [ ] Run full test suite
- [ ] Update CHANGELOG.md
- [ ] Version bump to 1.0.0

## Timeline

- **Core Migration**: Completed in current session
- **Test/Example Updates**: Estimated 1-2 hours
- **Testing & Validation**: Estimated 30 minutes
- **Total Remaining**: ~2-3 hours

---

*Migration started: Current session*  
*Core completed: Current session*  
*Estimated completion: Next session*
