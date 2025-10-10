# Saga Board

A lightweight, pluggable dashboard for monitoring and managing distributed sagas in real-time.

![Saga Board](https://img.shields.io/badge/status-alpha-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

## 📋 Overview

Saga Board provides a beautiful web-based UI for visualizing and managing your distributed sagas. Inspired by [bull-board](https://github.com/felixmosh/bull-board), it offers a modular architecture with support for multiple server frameworks.

## ✨ Features

- 📊 **Real-time Monitoring** - View all active, completed, and aborted sagas
- 🎯 **Task Visualization** - See the status of each task in your saga workflow
- 🔄 **Saga Actions** - Abort active sagas directly from the UI
- 🔌 **Framework Agnostic** - Pluggable adapters for Express, and easily extensible to other frameworks
- 🎨 **Customizable** - Configure titles, logos, and styling to match your brand
- 🔒 **Access Control** - Built-in visibility guards for multi-tenancy and authentication
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- ⚡ **Lightweight** - Minimal dependencies and fast performance

## 📦 Packages

Saga Board is split into multiple packages following a modular architecture:

| Package | Description | Version |
|---------|-------------|---------|
| `@saga-board/api` | Core API and adapter interfaces | `0.0.1` |
| `@saga-board/express` | Express.js server adapter | `0.0.1` |
| `@saga-board/ui` | Static UI assets | `0.0.1` |

## 🚀 Quick Start

### Installation

```bash
# Install the core API and your preferred server adapter
npm install @saga-board/api @saga-board/express

# Or with yarn
yarn add @saga-board/api @saga-board/express
```

### Basic Usage with Express

```typescript
import express from 'express';
import { createSagaBoard, SagaAdapter } from '@saga-board/api';
import { ExpressAdapter } from '@saga-board/express';
import { InMemorySagaLog } from '@zrcni/distributed-saga';

const app = express();

// Create your saga coordinator
const coordinator = InMemorySagaLog.createInMemorySagaCoordinator();

// Setup the server adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/sagas');

// Create a saga adapter
const sagaAdapter = new SagaAdapter(coordinator, {
  name: 'Orders',
  description: 'Order processing sagas',
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

app.listen(3000, () => {
  console.log('Saga Dashboard: http://localhost:3000/admin/sagas');
});
```

### TypeScript Configuration

If you're using TypeScript with `ts-node` during development, you may need to configure path mapping. See [TYPESCRIPT_SETUP.md](./TYPESCRIPT_SETUP.md) for detailed instructions.

**Quick setup for ts-node:**

1. Install `tsconfig-paths`:
   ```bash
   npm install --save-dev tsconfig-paths
   ```

2. Add paths to your `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@saga-board/api": ["./node_modules/@saga-board/api/src"],
         "@saga-board/express": ["./node_modules/@saga-board/express/src"]
       }
     }
   }
   ```

3. Register paths when running:
   ```bash
   ts-node -r tsconfig-paths/register your-app.ts
   ```

## 📖 Configuration

### Board Options

Customize the dashboard appearance and behavior:

```typescript
createSagaBoard({
  adapters: [sagaAdapter],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'My Custom Title',
      boardLogo: {
        path: 'https://example.com/logo.png',
        width: '100px',
        height: '50px',
      },
      miscLinks: [
        { text: 'Documentation', url: '/docs' },
        { text: 'Logout', url: '/logout' },
      ],
      favIcon: {
        default: '/static/favicon.svg',
        alternative: '/static/favicon-32x32.png',
      },
    },
  },
});
```

### Adapter Options

Configure individual saga sources:

```typescript
const sagaAdapter = new SagaAdapter(coordinator, {
  name: 'OrderSagas',
  description: 'Handles order processing workflows',
  readOnlyMode: false, // Disable actions like abort/retry
});
```

### Visibility Guards

Implement access control with visibility guards:

```typescript
sagaAdapter.setVisibilityGuard((request) => {
  // Check authentication
  const token = request.headers.authorization;
  return isValidToken(token);
});
```

### Multiple Saga Sources

Monitor multiple saga coordinators:

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

## 🔧 API Reference

### SagaAdapter

The adapter connects your saga coordinator to the dashboard:

```typescript
class SagaAdapter {
  constructor(coordinator: SagaCoordinator, options?: SagaAdapterOptions);
  
  getName(): string;
  getSagaIds(): Promise<string[]>;
  getSagaInfo(sagaId: string): Promise<SagaInfo | null>;
  abortSaga(sagaId: string): Promise<void>;
  retrySaga(sagaId: string): Promise<void>;
  setVisibilityGuard(guard: (req: SagaBoardRequest) => boolean): void;
}
```

### ExpressAdapter

The Express server adapter provides routing:

```typescript
class ExpressAdapter {
  setBasePath(path: string): void;
  getRouter(): Router;
  getBasePath(): string;
}
```

## 🎨 UI Features

### Dashboard View

- **Saga Sources**: View all configured saga coordinators
- **Real-time Updates**: Dashboard auto-refreshes every 5 seconds
- **Status Indicators**: Color-coded status badges (Active, Completed, Aborted)

### Saga Details

- **Task Progress**: See which tasks are started, completed, or compensating
- **Saga Actions**: Abort active sagas with confirmation
- **Job Data**: View the initial job payload (coming soon)

## 🔒 Security Considerations

**Important**: The dashboard provides administrative access to your sagas. Always:

1. ✅ Place behind authentication middleware
2. ✅ Use visibility guards for multi-tenant scenarios
3. ✅ Restrict network access (e.g., VPN, internal network)
4. ✅ Enable read-only mode in production if needed

Example with authentication:

```typescript
import { authMiddleware } from './auth';

app.use('/admin/sagas', authMiddleware, serverAdapter.getRouter());
```

## 📊 Example

A complete working example is available in the `examples/with-express-dashboard` directory:

```bash
cd examples/with-express-dashboard
npm install
npm start
```

Then visit: http://localhost:3000/admin/sagas

## 🛣️ Roadmap

- [ ] Add support for saga retry functionality
- [ ] Display job data and task results in UI
- [ ] Add filtering and search capabilities
- [ ] Export saga history to JSON/CSV
- [ ] WebSocket support for real-time updates
- [ ] Additional server adapters (Fastify, Koa, Hapi)
- [ ] Metrics and analytics dashboard
- [ ] Custom action plugins

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgements

Inspired by [@bull-board](https://github.com/felixmosh/bull-board) by [Felix Mosheev](https://github.com/felixmosh)

## 📞 Support

- 📖 [Documentation](https://github.com/zrcni/distributed-saga)
- 🐛 [Issue Tracker](https://github.com/zrcni/distributed-saga/issues)
- 💬 [Discussions](https://github.com/zrcni/distributed-saga/discussions)

---

Made with ❤️ for the distributed saga community
