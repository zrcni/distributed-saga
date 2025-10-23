# Optional Tasks Implementation - Technical Notes

## Summary
Successfully implemented optional saga tasks feature that allows non-critical tasks to fail without aborting the entire saga.

## Implementation Details

### Files Modified

#### 1. `src/sagas/saga-definition/SagaStep.ts`
- Added `public isOptional = false` property
- Added `optional()` method for fluent API

#### 2. `src/sagas/SagaOrchestrator.ts`
- Added `optionalTaskFailed` event type to `SagaOrchestratorEvents` interface
- Modified `executeSteps()` method with try-catch around task execution:
  - On optional failure: emit event, store `null` as end task data, continue
  - On required failure: throw error to abort saga
- **Key Design Decision**: Store `null` as end task data for failed optional tasks rather than error marker object
  - This ensures next task receives `null` in `context.prev`
  - Error information available via `optionalTaskFailed` event
  - Prevents issue where `saga.getEndTaskData()` was being called at start of each iteration

#### 3. `src/sagas/plugins/HierarchicalLogger.ts`
- Added `optionalTaskFailed: '⚠️'` to emoji map

#### 4. `src/sagas/saga-definition/functional.ts`
- Added `optional?: boolean` to `StepConfig` interface
- Added `optional()` method to `FunctionalStepBuilder` class
- Updated `createSagaStep()` helper to apply optional flag from config

### Files Created

#### 1. `src/sagas/__tests__/OptionalTasks.test.ts`
Comprehensive test suite with 7 test cases:
1. ✅ Should continue saga when optional task fails
2. ✅ Should emit optionalTaskFailed event when optional task fails
3. ✅ Should mark optional task as completed with null
4. ✅ Should pass null as previous result to next task when optional task fails
5. ✅ Should abort saga when required task fails
6. ✅ Should handle multiple optional tasks failing
7. ✅ Should execute successfully when optional task does not fail

#### 2. `docs/generated/OPTIONAL_TASKS_FEATURE.md`
Comprehensive user-facing documentation covering:
- Feature overview and motivation
- Implementation details
- Usage examples (5+ real-world scenarios)
- Functional API examples (step() builder and config object)
- Important considerations
- Testing guidelines
- Migration guide
- Performance notes

#### 3. `src/sagas/saga-definition/__tests__/functional.test.ts`
Added 5 new tests for functional API optional task support:
1. ✅ Should allow marking a step as optional
2. ✅ Should allow chaining optional with other methods
3. ✅ Should support optional tasks with step() builder
4. ✅ Should support optional tasks with config object format
5. ✅ Should emit optionalTaskFailed event for optional tasks in functional API

## Technical Challenges Resolved

### Challenge 1: Incorrect Test API
**Issue**: Initially used `defineSaga()` from functional API which doesn't exist  
**Resolution**: Changed to `SagaBuilder.start()` pattern used throughout codebase

### Challenge 2: Error Event Format
**Issue**: Event listener expected plain error message but received Error object  
**Resolution**: Event handler converts error to message: `error instanceof Error ? error.message : String(error)`

### Challenge 3: Previous Result Handling
**Issue**: Next task received error marker object instead of `null` for `context.prev`  
**Root Cause**: `saga.getEndTaskData(prevStep.taskName)` called at start of each iteration, overwriting `prevStepResult = null`  
**Resolution**: Store `null` as end task data for optional failures instead of error marker
- This design is cleaner: `null` naturally propagates through the `getEndTaskData()` call
- Error information remains accessible via `optionalTaskFailed` event
- Avoids need for complex flag tracking or conditional logic

### Challenge 4: Test Expectation Mismatch
**Issue**: Test expected saga to throw error on required task failure  
**Resolution**: `orchestrator.run()` returns saga object (doesn't throw), check `saga.isSagaAborted()` instead

### Challenge 5: HierarchicalLogger Plugin
**Issue**: TypeScript compilation error - missing `optionalTaskFailed` in emoji map  
**Resolution**: Added entry: `optionalTaskFailed: '⚠️'`

## Test Results

**Before**: 188 tests passing  
**After**: 200 tests passing (188 + 7 new OptionalTasks tests + 5 new functional API tests)

All tests pass including:
- New optional tasks test suite (7 tests)
- New functional API optional tasks tests (5 tests)
- All existing saga orchestrator tests
- All existing saga coordinator tests
- All existing saga implementation tests
- All existing functional API tests
- Build successful (both CJS and ESM)

## API Usage Example

### Using SagaBuilder

```typescript
import { SagaBuilder } from "@zrcni/distributed-saga"

const sagaDef = SagaBuilder.start()
  .invoke(async (data) => {
    // Critical task
    return await processPayment(data)
  })
  .withName("processPayment")
  .compensate(async (data) => {
    await refundPayment(data)
  })
  .next()
  .invoke(async (data) => {
    // Optional task - saga continues even if this fails
    return await sendEmail(data)
  })
  .withName("sendEmail")
  .optional() // 👈 Makes task non-critical
  .next()
  .invoke(async (data) => {
    // Critical task
    return await updateInventory(data)
  })
  .withName("updateInventory")
  .end()
```

### Using Functional API (step builder)

```typescript
import { step, fromSteps } from "@zrcni/distributed-saga"

const sagaDef = fromSteps([
  step("processPayment")
    .invoke(async (data) => await processPayment(data))
    .compensate(async (data, taskData) => await refundPayment(taskData)),
  
  step("sendEmail")
    .invoke(async (data) => await sendEmail(data))
    .optional(), // 👈 Makes task non-critical
  
  step("updateInventory")
    .invoke(async (data) => await updateInventory(data))
])
```

### Using Functional API (config object)

```typescript
import { fromSteps } from "@zrcni/distributed-saga"

const sagaDef = fromSteps([
  {
    name: "processPayment",
    invoke: async (data) => await processPayment(data),
    compensate: async (data, taskData) => await refundPayment(taskData)
  },
  {
    name: "sendEmail",
    invoke: async (data) => await sendEmail(data),
    optional: true // 👈 Makes task non-critical
  },
  {
    name: "updateInventory",
    invoke: async (data) => await updateInventory(data)
  }
])
```

### Event Monitoring

```typescript
// Listen for optional task failures
orchestrator.on("optionalTaskFailed", ({ taskName, error }) => {
  console.warn(`Optional task ${taskName} failed:`, error)
})
```

## Event Flow

**Optional Task Success:**
```
taskStarted → taskSucceeded → (normal flow continues)
```

**Optional Task Failure:**
```
taskStarted → optionalTaskFailed → task marked completed with null → (saga continues)
```

**Required Task Failure:**
```
taskStarted → taskFailed → sagaFailed → compensation begins → (saga aborts)
```

## Design Rationale

### Why store `null` instead of error marker?

**Considered Approach A**: Store error marker `{ __optionalTaskFailed: true, error: string }`
- ❌ Requires next task to check for marker before using `context.prev`
- ❌ Gets overwritten by `saga.getEndTaskData()` call anyway
- ❌ Pollutes task data with internal metadata

**Chosen Approach B**: Store `null`
- ✅ Clean separation: task data stores result, events store metadata
- ✅ Natural propagation through existing code paths
- ✅ Next task receives `null` in `context.prev` as documented
- ✅ Error information available via event system
- ✅ Aligns with TypeScript's handling of absent values

### Why not skip calling `endTask()` for optional failures?

- Saga state tracking requires all tasks to be marked completed
- Recovery mechanism depends on task completion status
- Maintaining state consistency is critical for distributed systems
- Storing `null` indicates "task attempted but produced no result"

## Future Enhancements

Potential features to consider:
1. **Retry logic for optional tasks**: Automatic retry with configurable attempts
2. **Optional task timeout**: Fail fast if optional task hangs
3. **Conditional optionality**: Make task optional based on runtime conditions
4. **Optional task groups**: Mark entire sequences as optional
5. **Error context storage**: Store detailed error context in saga metadata

## Related Documentation

- [OPTIONAL_TASKS_FEATURE.md](./OPTIONAL_TASKS_FEATURE.md) - User-facing documentation
- [ERROR_STANDARDIZATION.md](./ERROR_STANDARDIZATION.md) - Error handling patterns
- [TESTING.md](./TESTING.md) - Testing guidelines

## Date
October 23, 2025
