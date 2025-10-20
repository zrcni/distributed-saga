# @zrcni/distributed-saga-board-express

Express.js adapter for the Distributed Saga Dashboard.

## Installation

```bash
npm install @zrcni/distributed-saga-board-express express
```

## Overview

This package provides an Express.js middleware and router for serving the Saga Dashboard. It integrates with your Express application to provide real-time saga monitoring capabilities.

## Features

- **Express Middleware**: Easy integration with existing Express apps
- **Static Asset Serving**: Automatically serves the dashboard UI
- **RESTful API**: Full API for saga monitoring and management
- **Real-time Updates**: Dashboard polls for saga state changes
- **Multi-Source Support**: Monitor multiple saga coordinators
- **Nested Saga Visualization**: View parent-child saga relationships

## Quick Start

```typescript
import express from 'express';
import { createSagaBoardRouter } from '@zrcni/distributed-saga-board-express';
import { orderSagaCoordinator, paymentSagaCoordinator } from './your-sagas';

const app = express();

// Create saga board router with your coordinators
const sagaBoardRouter = createSagaBoardRouter({
  sources: [
    { name: 'Orders', coordinator: orderSagaCoordinator },
    { name: 'Payments', coordinator: paymentSagaCoordinator }
  ]
});

// Mount the dashboard at /admin/sagas
app.use('/admin/sagas', sagaBoardRouter);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Saga Dashboard: http://localhost:3000/admin/sagas');
});
```

## Configuration

### Basic Configuration

```typescript
createSagaBoardRouter({
  sources: [
    {
      name: 'Orders',        // Display name for this saga source
      coordinator: sagaCoordinator  // Your SagaCoordinator instance
    }
  ]
})
```

### Multiple Sources

Monitor multiple saga coordinators:

```typescript
createSagaBoardRouter({
  sources: [
    { name: 'Orders', coordinator: orderCoordinator },
    { name: 'Payments', coordinator: paymentCoordinator },
    { name: 'Inventory', coordinator: inventoryCoordinator }
  ]
})
```

## API Endpoints

The router exposes the following endpoints:

### GET `/`
Serves the dashboard UI

### GET `/api/sources`
Returns list of available saga sources
```json
[
  { "name": "Orders" },
  { "name": "Payments" }
]
```

### GET `/api/sources/:name/sagas`
Returns all sagas for a specific source
```json
[
  {
    "sagaId": "order-123",
    "status": "active",
    "tasks": [...],
    "parentSagaId": null,
    "parentTaskId": null
  }
]
```

### GET `/api/sources/:name/sagas/:sagaId`
Returns a specific saga
```json
{
  "sagaId": "order-123",
  "status": "completed",
  "tasks": [
    {
      "taskName": "validateOrder",
      "status": "completed",
      "childSagas": []
    }
  ]
}
```

### POST `/api/sources/:name/sagas/:sagaId/abort`
Aborts a running saga

## Dashboard Features

The dashboard provides:

- **Saga List View**: View all sagas with status indicators
- **Root Saga Highlighting**: Visually distinguish parent sagas
- **Parent Links**: Navigate from child sagas to their parents
- **Expandable Tasks**: View child sagas nested under tasks
- **Real-time Updates**: Auto-refresh every 5 seconds
- **Filter Toggle**: Show only root sagas or all sagas
- **Abort Actions**: Stop running sagas directly from the UI

## Advanced Usage

### Custom Mount Path

```typescript
// Mount at a custom path
app.use('/monitoring/sagas', sagaBoardRouter);
// Dashboard at: http://localhost:3000/monitoring/sagas
```

### With Authentication

```typescript
import { isAuthenticated } from './middleware/auth';

app.use('/admin/sagas', isAuthenticated, sagaBoardRouter);
```

### With CORS

```typescript
import cors from 'cors';

app.use('/admin/sagas', cors(), sagaBoardRouter);
```

## Example: Nested Sagas

The dashboard excels at visualizing nested saga hierarchies:

```typescript
// Parent saga creates child sagas within tasks
const parentSaga = saga('process-order', [
  task('validateOrder', async ({ runChildSaga }) => {
    // Create a child saga for validation
    await runChildSaga('validate-customer', validationSaga, {
      sagaId: 'validate-customer-123',
      taskId: 'validateOrder'
    });
  }),
  task('processPayment', async ({ runChildSaga }) => {
    // Create a child saga for payment
    await runChildSaga('process-payment', paymentSaga, {
      sagaId: 'payment-456',
      taskId: 'processPayment'
    });
  })
]);
```

The dashboard will show:
- Parent saga: `process-order`
  - Task: `validateOrder` (with 1 child saga)
    - Child: `validate-customer-123`
  - Task: `processPayment` (with 1 child saga)
    - Child: `payment-456`

## Troubleshooting

### Dashboard not loading
Ensure the UI package is installed:
```bash
npm install @zrcni/distributed-saga-board-ui
```

### Sagas not appearing
Verify your coordinator is properly initialized and sagas are registered with the saga log.

### CORS errors
Add CORS middleware before the saga board router:
```typescript
app.use(cors());
app.use('/admin/sagas', sagaBoardRouter);
```

## Related Packages

- **@zrcni/distributed-saga**: Core saga orchestration library
- **@zrcni/distributed-saga-board-api**: Core dashboard API
- **@zrcni/distributed-saga-board-ui**: React dashboard UI

## License

MIT
