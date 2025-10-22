# Saga Board with Express - Example

This example demonstrates how to integrate Saga Board with an Express.js application.

## 📋 Overview

This example shows:
- Setting up Saga Board with Express
- Creating multiple example sagas with different states
- Configuring the dashboard UI
- Accessing the dashboard

## 🚀 Running the Example

1. **Install dependencies**:
   ```bash
   npm install
   ```

   Note: This automatically installs `tsconfig-paths` which is required for TypeScript module resolution.

2. **Start the server**:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Open the dashboard**:
   Visit http://localhost:3000/admin/sagas

### TypeScript Configuration

This example uses `tsconfig-paths` to resolve the `@zrcni/distributed-saga-board-*` packages from source. The configuration in `tsconfig.json` maps these packages to their source directories:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@zrcni/distributed-saga-board-api": ["../../packages/api/src"],
      "@zrcni/distributed-saga-board-express": ["../../packages/express/src"]
    }
  }
}
```

The `package.json` scripts use `-r tsconfig-paths/register` to enable path mapping at runtime.

## 📊 What You'll See

The example creates multiple sagas to demonstrate different states and scenarios:

### Regular Sagas (Order Processing)

#### Saga 1: In Progress (Active)
- Payment processed ✅
- Inventory reservation started but not completed 🔄
- Demonstrates a saga that was interrupted (e.g., server crash)

#### Saga 2: Completed Successfully
- Payment processed ✅
- Inventory reserved ✅
- Confirmation email sent ✅
- Saga completed successfully ✅

#### Saga 3: Aborted and Compensated
- Payment processed ✅
- Saga aborted ❌
- Payment refunded (compensated) ↩️

### Nested Sagas (Web Crawler)

Demonstrates parent-child saga hierarchies with 3 levels of nesting:
- **Parent saga**: `crawl-example-com` - Coordinates webpage crawling
- **5 child sagas**: Page crawlers showing different states (completed, active, aborted)
- **5 nested child sagas**: Content processors (generateSummary → generateEmbeddings)

Total: 11 sagas demonstrating deep parent-child relationships

### Hanging Sagas (Long-Running) ⚠️

**Navigate to the "Hanging Sagas" tab in the dashboard** to see sagas running > 24 hours:

- **order-hanging-001**: 3 days old, stuck at payment processing
- **order-hanging-002**: 2 days old, waiting for inventory service
- **batch-export-001**: 5 days old, long-running export job
- **migration-parent-001**: 4 days old with stuck child sagas (migration workflow)
- **order-hanging-003**: 26 hours old, just crossed the 24-hour threshold

**Use Cases**: 
- Identify stuck workflows
- Detect infinite loops or deadlocks
- Find sagas waiting for failed external services
- Monitor long-running batch operations

## 🔧 Code Structure

```
.
├── index.ts          # Main application file
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## 📝 Key Concepts

### Creating the Dashboard

```typescript
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/sagas');

const sagaAdapter = new SagaAdapter(coordinator, {
  name: 'Orders',
  description: 'Order processing sagas',
});

createSagaBoard({
  adapters: [sagaAdapter],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Order Saga Dashboard',
    },
  },
});
```

### Mounting the Router

```typescript
app.use('/admin/sagas', serverAdapter.getRouter());
```

## 🎯 Try These Features

1. **View All Sagas**: See the list of all sagas on the main page
2. **Check Task Status**: Click into individual sagas to see task progress
3. **View Nested Sagas**: Explore parent-child saga relationships (3 levels deep!)
4. **Monitor Hanging Sagas**: Click the "Hanging Sagas" tab to see long-running sagas (>24 hours)
5. **Abort a Saga**: Try aborting an active or hanging saga
6. **Delete Sagas**: Clean up completed or hanging sagas
7. **Auto-Refresh**: Notice the dashboard updates automatically (every 5-10 seconds)

## 🔐 Adding Authentication

To add authentication to the dashboard:

```typescript
function authMiddleware(req, res, next) {
  // Your authentication logic here
  if (req.headers.authorization === 'Bearer your-token') {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
}

app.use('/admin/sagas', authMiddleware, serverAdapter.getRouter());
```

## 📚 Next Steps

- Explore the source code in `index.ts`
- Try modifying the saga definitions
- Add more saga sources
- Implement custom visibility guards
- Add authentication middleware

## 🐛 Troubleshooting

**Port already in use?**
Change the port in `index.ts`:
```typescript
const port = 3001; // Change to any available port
```

**Dependencies not found?**
Make sure you've built the saga-board packages:
```bash
cd ../../packages/api && npm run build
cd ../express && npm run build
```

## 📄 License

MIT
