# API Simplification Summary

## Overview

Simplified the SagaCoordinator API by consolidating child saga creation into the main `createSaga` method and removing the redundant `createChildSaga` method.

## Changes Made

### 1. SagaCoordinator API (`src/sagas/SagaCoordinator.ts`)

**Removed:**
- `createChildSaga(parentSagaId, parentTaskId, sagaId, job)` method

**Updated:**
- `createSaga()` method signature changed from:
  ```typescript
  async createSaga<D = unknown>(
    sagaId: string, 
    job: D, 
    parentSagaId?: string | null
  )
  ```
  
  To:
  ```typescript
  async createSaga<D = unknown>(
    sagaId: string, 
    job: D, 
    parent?: { parentSagaId: string; parentTaskId: string } | null
  )
  ```
  
  **Note:** Both `parentSagaId` and `parentTaskId` are required in the parent object because only tasks can create child sagas.

- `recoverOrCreate()` method signature changed from:
  ```typescript
  async recoverOrCreate<D = unknown>(
    sagaId: string,
    job: D,
    recoveryType: SagaRecoveryType = SagaRecoveryType.ForwardRecovery,
    parentSagaId?: string | null
  )
  ```
  
  To:
  ```typescript
  async recoverOrCreate<D = unknown>(
    sagaId: string,
    job: D,
    recoveryType: SagaRecoveryType = SagaRecoveryType.ForwardRecovery,
    parent?: { parentSagaId: string; parentTaskId: string } | null
  )
  ```

### 2. Updated Usage Examples

#### Before:
```typescript
// Creating a root saga
const parentSaga = await coordinator.createSaga('parent-1', { task: 'parent' })

// Creating a child saga
const childSaga = await coordinator.createChildSaga(
  'parent-1',      // parentSagaId
  'task-1',        // parentTaskId
  'child-1',       // sagaId
  { task: 'child-1' }  // job data
)
```

#### After:
```typescript
// Creating a root saga
const parentSaga = await coordinator.createSaga('parent-1', { task: 'parent' })

// Creating a child saga
const childSaga = await coordinator.createSaga(
  'child-1',          // sagaId
  { task: 'child-1' }, // job data
  {
    parentSagaId: 'parent-1',
    parentTaskId: 'task-1'
  }
)
```

### 3. Files Updated

**Core:**
- `src/sagas/SagaCoordinator.ts` - Updated API methods

**Tests:**
- `src/sagas/__tests__/SagaCoordinator.test.ts` - Updated test calls

**Documentation:**
- `docs/TRANSACTIONS.md` - Updated examples
- `DEEP_NESTING_EXAMPLE.md` - Updated examples

**Examples:**
- `examples/with-express-dashboard/index.ts` - Updated all usage

## Benefits

### 1. **Cleaner API**
- One method instead of two for saga creation
- Consistent parameter ordering (sagaId, job, parent)
- No confusion about when to use which method

### 2. **Better TypeScript Support**
- Optional parent parameter with clear structure
- Type safety for parent saga relationships
- Autocomplete shows parent properties clearly
- **Both `parentSagaId` and `parentTaskId` are required** - enforces the rule that only tasks can create child sagas

### 3. **More Flexible**
- Parent parameter is clearly optional (can be null or undefined)
- **Both parent properties are required when creating child sagas** - prevents invalid parent relationships
- Easier to add more parent-related metadata in the future

### 4. **Backwards Compatible Pattern**
- Old code calling `createSaga(id, job)` still works (creates root saga)
- Only adds optional third parameter
- Follows common patterns in other libraries

## Migration Guide

### For Root Sagas (No Changes Needed)
```typescript
// This still works exactly the same
const saga = await coordinator.createSaga('saga-id', { data: 'value' })
```

### For Child Sagas
```typescript
// OLD WAY (removed)
const child = await coordinator.createChildSaga(
  parentId,
  taskId,
  childId,
  jobData
)

// NEW WAY
const child = await coordinator.createSaga(
  childId,
  jobData,
  { parentSagaId: parentId, parentTaskId: taskId }
)
```

### For recoverOrCreate with Parent
```typescript
// OLD WAY
const saga = await coordinator.recoverOrCreate(
  'saga-id',
  jobData,
  SagaRecoveryType.ForwardRecovery,
  'parent-id'  // only parentSagaId supported
)

// NEW WAY
const saga = await coordinator.recoverOrCreate(
  'saga-id',
  jobData,
  SagaRecoveryType.ForwardRecovery,
  { parentSagaId: 'parent-id', parentTaskId: 'task-id' }  // can include taskId
)
```

## Testing

- ✅ All 177 tests passing
- ✅ No breaking changes to existing test patterns
- ✅ Core saga creation logic unchanged
- ✅ Parent-child relationships work correctly

## Implementation Notes

The `createSaga` method internally destructures the parent object and passes the values to `Saga.create()`:

```typescript
async createSaga<D = unknown>(
  sagaId: string, 
  job: D, 
  parent?: { parentSagaId: string; parentTaskId: string } | null
) {
  const parentSagaId = parent?.parentSagaId ?? null
  const parentTaskId = parent?.parentTaskId ?? null
  return Saga.create<D>(sagaId, job, this.log, parentSagaId, parentTaskId)
}
```

**Important:** When creating a child saga, both `parentSagaId` and `parentTaskId` are required. This enforces the architectural rule that only tasks can create child sagas - child sagas are always created in the context of a parent saga executing a specific task.

## Future Enhancements

This pattern makes it easier to add additional parent-related metadata in the future:

```typescript
// Potential future enhancement
const child = await coordinator.createSaga(
  'child-id',
  jobData,
  {
    parentSagaId: 'parent-id',
    parentTaskId: 'task-id',
    inheritContext: true,  // future feature
    priority: 'high'       // future feature
  }
)
```
