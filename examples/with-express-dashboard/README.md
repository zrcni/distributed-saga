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

This example uses `tsconfig-paths` to resolve the `@saga-board/*` packages from source. The configuration in `tsconfig.json` maps these packages to their source directories:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@saga-board/api": ["../../packages/api/src"],
      "@saga-board/express": ["../../packages/express/src"]
    }
  }
}
```

The `package.json` scripts use `-r tsconfig-paths/register` to enable path mapping at runtime.

## 📊 What You'll See

The example creates three sagas to demonstrate different states:

### Saga 1: In Progress (Active)
- Payment processed ✅
- Inventory reservation started but not completed 🔄
- Demonstrates a saga that was interrupted (e.g., server crash)

### Saga 2: Completed Successfully
- Payment processed ✅
- Inventory reserved ✅
- Confirmation email sent ✅
- Saga completed successfully ✅

### Saga 3: Aborted and Compensated
- Payment processed ✅
- Saga aborted ❌
- Payment refunded (compensated) ↩️

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
3. **Abort a Saga**: Try aborting the active saga (Saga 1)
4. **Auto-Refresh**: Notice the dashboard updates every 5 seconds

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
