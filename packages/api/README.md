# @zrcni/distributed-saga-board-api

Core API for monitoring distributed sagas in real-time.

## Installation

```bash
npm install @zrcni/distributed-saga-board-api
```

## Overview

This package provides the core API interfaces and adapters for building saga monitoring dashboards. It works alongside `@zrcni/distributed-saga` to provide real-time visibility into saga execution.

## Features

- **SagaAdapter**: Transform saga states into dashboard-friendly data structures
- **TaskInfo**: Detailed task execution information with child saga tracking
- **Real-time Monitoring**: Query saga state, tasks, and nested sagas
- **Parent-Child Relationships**: Track nested saga hierarchies

## Usage

### Basic Setup

```typescript
import { SagaAdapter } from '@zrcni/distributed-saga-board-api';
import { sagaCoordinator } from './your-saga-setup';

// Create an adapter for your saga source
const adapter = new SagaAdapter({
  name: 'Orders',
  coordinator: sagaCoordinator
});

// Get all sagas
const sagas = await adapter.getSagas();

// Get a specific saga
const saga = await adapter.getSaga('order-123');
```

### Task Information

Each saga includes detailed task information:

```typescript
{
  sagaId: 'order-123',
  status: 'active',
  tasks: [
    {
      taskName: 'validateOrder',
      status: 'completed',
      childSagas: [] // Child sagas created by this task
    },
    {
      taskName: 'processPayment',
      status: 'started',
      childSagas: [
        {
          sagaId: 'payment-456',
          status: 'active',
          parentSagaId: 'order-123',
          parentTaskId: 'processPayment'
        }
      ]
    }
  ]
}
```

### Nested Sagas

Track parent-child relationships:

```typescript
// Child sagas automatically reference their parent
const childSaga = {
  parentSagaId: 'order-123',
  parentTaskId: 'processPayment'
};
```

## API Reference

### SagaAdapter

#### Constructor

```typescript
new SagaAdapter({
  name: string,
  coordinator: SagaCoordinator
})
```

#### Methods

- `getSagas(): Promise<SagaInfo[]>` - Get all sagas
- `getSaga(sagaId: string): Promise<SagaInfo | null>` - Get a specific saga
- `abortSaga(sagaId: string): Promise<void>` - Abort a saga

### Interfaces

#### SagaInfo

```typescript
interface SagaInfo {
  sagaId: string;
  status: string;
  tasks?: TaskInfo[];
  parentSagaId?: string | null;
  parentTaskId?: string | null;
}
```

#### TaskInfo

```typescript
interface TaskInfo {
  taskName: string;
  status: string;
  childSagas?: SagaInfo[];
}
```

## Integration

This package is typically used with:

- **@zrcni/distributed-saga**: Core saga orchestration
- **@zrcni/distributed-saga-board-express**: Express.js adapter
- **@zrcni/distributed-saga-board-ui**: React dashboard UI

## License

MIT
