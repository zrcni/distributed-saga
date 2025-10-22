# Transaction Support

This guide explains how to use database transactions when aborting or deleting saga hierarchies.

## Overview

When working with saga hierarchies (parent sagas with child sagas), it's often desirable to ensure that operations like aborting or deleting an entire saga tree are atomic. If any part of the operation fails, the entire operation should be rolled back to maintain consistency.

Transaction support is **optional** and only available for saga log implementations that support it (e.g., `MongoDBSagaLog`). The `InMemorySagaLog` does not support transactions.

## When to Use Transactions

Use transactions when:
- You need atomic operations across multiple sagas
- Partial failures are unacceptable
- You're working with production data and consistency is critical
- You're using a saga log implementation that supports transactions (like MongoDB)

Don't use transactions when:
- You're using `InMemorySagaLog` (transactions are no-ops)
- Performance is more critical than atomicity
- Your saga log implementation doesn't support transactions
- You're okay with eventual consistency

## Usage

### Setting Up MongoDBSagaLog with Transaction Support

Transaction support is automatically available when using `MongoDBSagaLog` - no special setup required:

```typescript
import { MongoClient } from 'mongodb'
import { MongoDBSagaLog } from '@zrcni/distributed-saga'

// Connect to MongoDB
const client = new MongoClient('mongodb://localhost:27017')
await client.connect()

const db = client.db('my-database')
const collection = db.collection('sagas')

// Create the saga log - transaction support is automatic
const sagaLog = new MongoDBSagaLog(collection)

// Or use the static factory method
const coordinator = MongoDBSagaLog.createMongoDBSagaCoordinator(collection)
```

The `MongoDBSagaLog` automatically accesses the MongoDB client from the collection object, so you don't need to pass it explicitly.

### Aborting Sagas with Transactions

```typescript
// Abort a saga and all its children atomically
const result = await coordinator.abortSagaWithChildren('parent-saga-id', true)

if (result.isError()) {
  console.error('Failed to abort saga hierarchy:', result.error)
  // If any child saga failed to abort, the entire operation was rolled back
} else {
  console.log('Successfully aborted saga and all children')
  // All sagas were aborted, or none were
}
```

### Deleting Sagas with Transactions

```typescript
// Delete a saga and all its children atomically
const result = await coordinator.deleteSagaWithChildren('parent-saga-id', true)

if (result.isError()) {
  console.error('Failed to delete saga hierarchy:', result.error)
  // If any child saga failed to delete, the entire operation was rolled back
} else {
  console.log('Successfully deleted saga and all children')
  // All sagas were deleted, or none were
}
```

### Without Transactions (Default Behavior)

If you don't pass `true` as the second parameter, operations will execute without transactions:

```typescript
// Non-transactional abort (eventual consistency)
await coordinator.abortSagaWithChildren('parent-saga-id')

// Non-transactional delete (eventual consistency)
await coordinator.deleteSagaWithChildren('parent-saga-id')
```

This is the default behavior and works with all saga log implementations.

## How It Works

### With Transactions

1. The coordinator checks if the saga log supports transactions
2. A transaction session is started
3. All child sagas are recursively aborted/deleted within the transaction
4. The parent saga is aborted/deleted within the transaction
5. If all operations succeed, the transaction is committed
6. If any operation fails, the transaction is rolled back and an error is returned

### Without Transactions

1. Child sagas are recursively aborted/deleted one by one
2. The parent saga is aborted/deleted
3. If an operation fails, previous operations are NOT rolled back
4. This provides eventual consistency but not atomicity

## Implementation Details

### SagaLog Interface

The `SagaLog` interface defines three optional transaction methods:

```typescript
interface SagaLog {
  // ... other methods ...
  
  beginTransaction?(): Promise<any>
  commitTransaction?(session: any): Promise<void>
  abortTransaction?(session: any): Promise<void>
}
```

These are optional because not all implementations support transactions.

### Transaction Options

Methods that support transactions accept an optional `SagaLogTransactionOptions` parameter:

```typescript
interface SagaLogTransactionOptions {
  session?: any  // Database transaction session (e.g., MongoDB ClientSession)
}
```

## Backwards Compatibility

Transaction support is **fully backwards compatible**:

- Existing code continues to work without modifications
- Transactions are opt-in via the `useTransaction` parameter
- Saga logs without transaction support work as before
- The `MongoDBSagaLog` constructor's second parameter is optional

## Error Handling

When using transactions:

```typescript
const result = await coordinator.deleteSagaWithChildren('saga-id', true)

if (result.isError()) {
  // The transaction was rolled back
  console.error('Operation failed and was rolled back:', result.error)
}
```

When not using transactions:

```typescript
const result = await coordinator.deleteSagaWithChildren('saga-id', false)

if (result.isError()) {
  // Some operations may have succeeded before the failure
  console.error('Operation failed:', result.error)
  // Manual cleanup may be required
}
```

## Best Practices

1. **Use transactions in production** for critical saga hierarchies
2. **Handle errors gracefully** - check the result and act accordingly
3. **Consider performance trade-offs** - transactions add overhead
4. **Test both paths** - test with and without transactions to understand behavior
5. **Document your choice** - make it clear in your code whether you're using transactions

## Example: Complete Workflow

```typescript
import { MongoClient } from 'mongodb'
import { MongoDBSagaLog } from '@zrcni/distributed-saga'

async function main() {
  // Setup
  const client = new MongoClient('mongodb://localhost:27017')
  await client.connect()
  
  const db = client.db('saga-db')
  const collection = db.collection('sagas')
  
  // Create coordinator with automatic transaction support
  const coordinator = MongoDBSagaLog.createMongoDBSagaCoordinator(collection)
  
  // Create a parent saga with children
  const parentSaga = await coordinator.createSaga('parent-1', { task: 'parent' })
  const child1 = await coordinator.createSaga('child-1', { task: 'child-1' }, { parentSagaId: 'parent-1', parentTaskId: 'task-1' })
  const child2 = await coordinator.createSaga('child-2', { task: 'child-2' }, { parentSagaId: 'parent-1', parentTaskId: 'task-2' })
  
  // ... execute saga logic ...
  
  // Delete the entire hierarchy atomically
  const deleteResult = await coordinator.deleteSagaWithChildren('parent-1', true)
  
  if (deleteResult.isError()) {
    console.error('Failed to delete saga hierarchy')
    // All sagas are still present due to rollback
  } else {
    console.log('Successfully deleted entire saga hierarchy')
    // All sagas (parent and children) are gone
  }
  
  await client.close()
}

main()
```

## MongoDB Transaction Requirements

For MongoDB transactions to work, you need:

1. **Replica Set**: MongoDB transactions require a replica set (even for single-node deployments)
2. **MongoDB 4.0+**: Transaction support was added in MongoDB 4.0
3. **Compatible Driver**: Use mongodb driver 3.1+ (this package uses 5.x)

If these requirements aren't met, attempting to use transactions will result in an error.

## Testing

When writing tests, you can mock the transaction methods:

```typescript
const mockLog: SagaLog = {
  // ... other methods ...
  beginTransaction: jest.fn().mockResolvedValue(mockSession),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
}
```

Or test without transactions:

```typescript
// Simply omit the transaction methods or set useTransaction to false
await coordinator.deleteSagaWithChildren('saga-id', false)
```
