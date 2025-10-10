# Quick Setup Guide - Saga Board

Get your Saga Dashboard up and running in 5 minutes!

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install @saga-board/api @saga-board/express
```

### Step 2: Add to Your Express App

```typescript
// Import required packages
import express from 'express';
import { createSagaBoard, SagaAdapter } from '@saga-board/api';
import { ExpressAdapter } from '@saga-board/express';

const app = express();

// Your existing saga coordinator
const coordinator = InMemorySagaLog.createInMemorySagaCoordinator();

// Create the Express adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/sagas');

// Create a saga adapter for your coordinator
const sagaAdapter = new SagaAdapter(coordinator, {
  name: 'MySagas',
  description: 'My application sagas',
});

// Create the board
createSagaBoard({
  adapters: [sagaAdapter],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'My Saga Dashboard',
    },
  },
});

// Mount the router
app.use('/admin/sagas', serverAdapter.getRouter());

// Start your server
app.listen(3000, () => {
  console.log('Dashboard: http://localhost:3000/admin/sagas');
});
```

### Step 3: Visit Your Dashboard

Open http://localhost:3000/admin/sagas in your browser!

## 🔒 Add Authentication (Recommended)

```typescript
// Simple authentication middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (isValidToken(token)) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
}

// Protect the dashboard
app.use('/admin/sagas', requireAuth, serverAdapter.getRouter());
```

## 📊 Multiple Saga Sources

```typescript
const orderAdapter = new SagaAdapter(orderCoordinator, {
  name: 'Orders',
});

const paymentAdapter = new SagaAdapter(paymentCoordinator, {
  name: 'Payments',
});

createSagaBoard({
  adapters: [orderAdapter, paymentAdapter],
  serverAdapter,
});
```

## 🎨 Customize the UI

```typescript
createSagaBoard({
  adapters: [sagaAdapter],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Production Saga Monitor',
      boardLogo: {
        path: 'https://yoursite.com/logo.png',
        width: '120px',
      },
      miscLinks: [
        { text: 'Documentation', url: '/docs' },
        { text: 'Logout', url: '/logout' },
      ],
    },
  },
});
```

## 🛡️ Visibility Guards

Control access per saga source:

```typescript
sagaAdapter.setVisibilityGuard((request) => {
  // Check user permissions
  const user = request.headers['x-user-id'];
  return hasAccess(user);
});
```

## 📖 Next Steps

1. ✅ Check out the [full documentation](./packages/SAGA_BOARD_README.md)
2. ✅ Run the [example application](./examples/with-express-dashboard)
3. ✅ Review the [architecture](./packages/ARCHITECTURE.md)

## 🐛 Troubleshooting

**Can't find the packages?**
- Make sure you've built them: `cd packages/api && npm run build`

**Port 3000 is in use?**
- Change the port: `app.listen(3001)`

**Sagas not showing up?**
- Verify your coordinator has active sagas
- Check the browser console for errors
- Ensure the adapter name matches your requests

## 💡 Tips

- Dashboard auto-refreshes every 5 seconds
- Use read-only mode in production if you don't want actions
- Add multiple adapters to monitor different saga sources
- Always protect the dashboard with authentication in production

---

Need help? Check the [main README](./packages/SAGA_BOARD_README.md) or open an issue!
