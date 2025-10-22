# Timestamp Implementation Summary

## Overview
Implemented end-to-end timestamp tracking for sagas and tasks, capturing when sagas are created, updated, and when tasks start and complete. This enables the dashboard to display timing information and calculate durations.

## Implementation Approach

### Event Sourcing Architecture
The system uses event sourcing where all saga state changes are captured as `SagaMessage` objects. By adding timestamps to messages at creation time, we automatically capture timing for all events without requiring changes to storage layers.

## Changes Made

### 1. SagaMessage Class (`src/sagas/SagaMessage.ts`)
**Added timestamp field:**
```typescript
type Params<D> = {
  // ... existing fields
  timestamp?: Date  // Optional in constructor
}

export class SagaMessage<Data = unknown> {
  // ... existing fields
  timestamp: Date   // Always present in instance
  
  constructor({ sagaId, msgType, data, taskId, parentSagaId, parentTaskId, timestamp }: Params<Data>) {
    // ... existing assignments
    this.timestamp = timestamp || new Date()  // Auto-set if not provided
  }
}
```

**Key Points:**
- Timestamp is optional in constructor (defaults to `new Date()`)
- Allows custom timestamps for testing or message replay
- All factory methods (`createStartSagaMessage`, `createStartTaskMessage`, etc.) automatically get timestamps

### 2. SagaAdapter (`packages/api/src/SagaAdapter.ts`)
**Extract timestamps from messages:**
```typescript
async getSagaInfo(sagaId: string, withChildren = false): Promise<SagaInfo> {
  let createdAt: Date | undefined
  let updatedAt: Date | undefined
  
  for (const msg of messages) {
    // Capture creation time from first StartSaga message
    if (msg.msgType === SagaMessageType.StartSaga && !createdAt) {
      createdAt = msg.timestamp
    }
    
    // Track latest message timestamp as updatedAt
    if (msg.timestamp && (!updatedAt || msg.timestamp > updatedAt)) {
      updatedAt = msg.timestamp
    }
    
    // Track task timestamps
    if (msg.msgType === SagaMessageType.StartTask) {
      taskMap[msg.taskId!] = {
        // ...
        startedAt: msg.timestamp,
      }
    }
    
    if (msg.msgType === SagaMessageType.EndTask || 
        msg.msgType === SagaMessageType.EndCompensatingTask) {
      taskMap[msg.taskId!] = {
        // ...
        completedAt: msg.timestamp,
      }
    }
  }
  
  return {
    // ...
    createdAt,
    updatedAt,
    tasks: Object.values(taskMap),
  }
}
```

**Extracted Timestamps:**
- `createdAt`: From first `StartSaga` message
- `updatedAt`: From latest message of any type
- `startedAt` (task): From `StartTask` message
- `completedAt` (task): From `EndTask` or `EndCompensatingTask` message

### 3. Storage Layers (Automatic)

#### MongoDBSagaLog (`src/sagas/MongoDBSagaLog.ts`)
No changes required! Stores entire `SagaMessage` objects:
```typescript
await this.collection.updateOne(
  { sagaId: msg.sagaId },
  { $push: { messages: msg } },  // Entire message object including timestamp
  { session }
)
```

#### InMemorySagaLog (`src/sagas/InMemorySagaLog.ts`)
No changes required! Stores entire `SagaMessage` objects in array:
```typescript
sagaData.messages.push(msg)  // Entire message object including timestamp
```

### 4. UI Display (Already Implemented)

#### SagasPage.tsx
Shows creation time on saga cards:
```typescript
{saga.createdAt && (
  <div className="saga-timestamp">
    <span>Created:</span>
    <span>{new Date(saga.createdAt).toLocaleString()}</span>
  </div>
)}
```

#### SagaDetailPage.tsx
Shows saga and task timestamps with duration:
```typescript
// Saga timestamps
{saga.createdAt && <span>Created: {new Date(saga.createdAt).toLocaleString()}</span>}
{saga.updatedAt && <span>Updated: {new Date(saga.updatedAt).toLocaleString()}</span>}

// Task timestamps
{task.startedAt && <span>Started: {new Date(task.startedAt).toLocaleString()}</span>}
{task.completedAt && <span>Completed: {new Date(task.completedAt).toLocaleString()}</span>}

// Duration calculation
{task.startedAt && task.completedAt && (
  <div className="task-duration">
    Duration: {Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000)}s
  </div>
)}
```

## Data Flow

```
1. Event Creation
   SagaMessage.createStartSagaMessage() 
   → timestamp = new Date()

2. Persistence
   → MongoDBSagaLog.logMessage(msg)
   → { messages: [..., msg] }  // Timestamp included
   
3. Reconstruction
   → SagaAdapter.getSagaInfo(sagaId)
   → Extract timestamps from messages
   → Return SagaInfo with createdAt, updatedAt
   
4. API Response
   → ExpressAdapter sends SagaInfo
   → { sagaId, createdAt, updatedAt, tasks: [...] }
   
5. UI Display
   → SagaDetailPage renders timestamps
   → new Date(saga.createdAt).toLocaleString()
```

## Testing

Created comprehensive test suite (`src/sagas/__tests__/SagaMessage-timestamp.test.ts`):

```typescript
✓ should automatically set timestamp when creating messages
✓ should allow custom timestamp when provided  
✓ should preserve timestamps when stored in InMemorySagaLog
✓ should create all message types with timestamps
```

All tests pass, confirming:
- Timestamps auto-generate when not provided
- Custom timestamps work for testing
- InMemorySagaLog preserves timestamps
- All message types get timestamps

## Benefits

1. **Non-invasive**: No changes to storage layer interfaces
2. **Automatic**: Timestamps captured at message creation time
3. **Consistent**: Same mechanism for all message types
4. **Extensible**: Easy to add more time-based metrics
5. **Testable**: Can provide custom timestamps for deterministic tests

## Future Enhancements

Potential additions:
- Task duration metrics aggregation
- Performance analytics (slow tasks)
- Timeline visualization
- Time-based filtering/search
- Retention policies based on age
