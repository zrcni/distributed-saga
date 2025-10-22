# Bug Fix: Tasks Not Showing in Dashboard

## Problem

The Saga Dashboard was not displaying any tasks for sagas, even though the sagas had tasks being executed. The UI showed saga cards but with empty task lists.

## Root Cause

The issue was in `/packages/api/src/SagaAdapter.ts`. The `SagaMessageType` enum was incorrectly defined with **numeric values** instead of **string values**:

### Incorrect Code ❌
```typescript
enum SagaMessageType {
  StartSaga = 0,
  EndSaga = 1,
  AbortSaga = 2,
  StartTask = 3,
  EndTask = 4,
  StartCompensatingTask = 5,
  EndCompensatingTask = 6,
}
```

However, the actual `SagaMessageType` enum in the main package (`src/sagas/SagaMessage.ts`) uses **string values**:

### Actual Definition in Core Package ✅
```typescript
export enum SagaMessageType {
  StartSaga = "StartSaga",
  EndSaga = "EndSaga",
  AbortSaga = "AbortSaga",
  StartTask = "StartTask",
  EndTask = "EndTask",
  StartCompensatingTask = "StartCompensatingTask",
  EndCompensatingTask = "EndCompensatingTask",
}
```

## Impact

Because of this mismatch:
1. The `switch` statement in `getSagaInfo()` was comparing string message types against numeric enum values
2. None of the `case` statements would ever match
3. Tasks were never added to the `tasks` Map
4. The dashboard received saga info with empty task arrays

### Debug Output Showing the Problem
```
[SagaAdapter] Got 4 messages for order-001
[SagaAdapter] Processing message type StartSaga for task undefined
[SagaAdapter] Processing message type StartTask for task processPayment  // String "StartTask"
[SagaAdapter] Processing message type EndTask for task processPayment    // String "EndTask"
[SagaAdapter] Processing message type StartTask for task reserveInventory
[SagaAdapter] Saga order-001: { status: 'active', taskCount: 0, tasks: [] }  // No tasks!
```

## Solution

Changed the enum definition in `SagaAdapter.ts` to use **string values** matching the core package:

```typescript
enum SagaMessageType {
  StartSaga = "StartSaga",
  EndSaga = "EndSaga",
  AbortSaga = "AbortSaga",
  StartTask = "StartTask",
  EndTask = "EndTask",
  StartCompensatingTask = "StartCompensatingTask",
  EndCompensatingTask = "EndCompensatingTask",
}
```

## Result

After the fix, tasks are properly tracked and displayed:

### Before Fix
```
order-001: { status: 'active', taskCount: 0, tasks: [] }
order-002: { status: 'completed', taskCount: 0, tasks: [] }
order-003: { status: 'aborted', taskCount: 0, tasks: [] }
```

### After Fix ✅
```
order-001: {
  status: 'active',
  taskCount: 2,
  tasks: [
    { name: 'processPayment', status: 'completed' },
    { name: 'reserveInventory', status: 'started' }
  ]
}

order-002: {
  status: 'completed',
  taskCount: 3,
  tasks: [
    { name: 'processPayment', status: 'completed' },
    { name: 'reserveInventory', status: 'completed' },
    { name: 'sendEmail', status: 'completed' }
  ]
}

order-003: {
  status: 'aborted',
  taskCount: 1,
  tasks: [
    { name: 'processPayment', status: 'compensated' }
  ]
}
```

## Dashboard Display

Now the dashboard correctly shows:

### Example Saga with Active Task
```
┌─────────────────────────────────────────────────────┐
│ Saga ID: order-001                    [ACTIVE]      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                      │
│ Tasks (2)                                           │
│ ─────────────────────────────────────────────────   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ① processPayment               [COMPLETED]   │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ② reserveInventory             [EXECUTING]   │   │
│ │   🔄 Executing...                            │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ [Abort Saga]                                        │
└─────────────────────────────────────────────────────┘
```

### Completed Saga
```
┌─────────────────────────────────────────────────────┐
│ Saga ID: order-002                  [COMPLETED]     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                      │
│ Tasks (3)                                           │
│ ─────────────────────────────────────────────────   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ① processPayment               [COMPLETED]   │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ② reserveInventory             [COMPLETED]   │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ③ sendEmail                    [COMPLETED]   │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Aborted Saga with Compensation
```
┌─────────────────────────────────────────────────────┐
│ Saga ID: order-003                   [ABORTED]      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                      │
│ Tasks (1)                                           │
│ ─────────────────────────────────────────────────   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ① processPayment              [COMPENSATED]  │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Files Changed

- `/packages/api/src/SagaAdapter.ts` - Fixed `SagaMessageType` enum definition

## Lessons Learned

1. **Enum Value Consistency**: When re-declaring enums across packages, ensure the values match exactly (numbers vs strings)
2. **Type Safety Limitations**: TypeScript's enum types are compatible between string and numeric enums at compile time, but runtime behavior differs
3. **Debug Logging**: Adding temporary debug logs was crucial to identifying that messages were being processed but not matching cases
4. **Switch Statement Behavior**: JavaScript switch statements use strict equality (`===`), so `"StartTask"` !== `3`

## Prevention

To prevent this issue in the future:

1. **Import the Actual Enum**: If possible, import the enum from the main package instead of re-declaring it
2. **Runtime Validation**: Add runtime checks to ensure enum values match expected types
3. **Integration Tests**: Add tests that verify tasks are properly tracked from real saga messages
4. **Type Assertions**: Use TypeScript's string literal unions instead of redeclaring enums:

```typescript
type SagaMessageType = 
  | "StartSaga"
  | "EndSaga" 
  | "AbortSaga"
  | "StartTask"
  | "EndTask"
  | "StartCompensatingTask"
  | "EndCompensatingTask";
```

## Related Issues

This bug prevented the full functionality of the task visualization feature documented in `DASHBOARD_TASK_VISUALIZATION.md`.

## Testing

After the fix:
1. ✅ Active sagas show tasks with current execution status
2. ✅ Completed sagas show all tasks as completed
3. ✅ Aborted sagas show compensated tasks
4. ✅ Executing tasks display with animated spinner
5. ✅ Task counts are accurate
6. ✅ Task status badges display correct colors

---

**Fixed**: October 10, 2025
**Impact**: High - Core functionality was broken
**Severity**: Critical - No tasks were visible in dashboard
