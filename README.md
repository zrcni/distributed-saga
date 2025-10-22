NOT INTENDED FOR PRODUCTION USAGE

# Distributed Sagas

A TypeScript library for distributed saga orchestration.

## Installation

```bash
npm install distributed-sagas
```

## Usage

### CommonJS (Node.js)

```javascript
const { sagaCoordinator } = require('distributed-sagas');
const { start } = require('distributed-sagas/saga-definition');
const { sagaInChannel } = require('distributed-sagas/channel');
```

### ESM (ES Modules)

```javascript
import { sagaCoordinator } from 'distributed-sagas';
import { start } from 'distributed-sagas/saga-definition';
import { sagaInChannel } from 'distributed-sagas/channel';
```

### TypeScript

```typescript
import { sagaCoordinator } from 'distributed-sagas';
import { start } from 'distributed-sagas/saga-definition';
import { sagaInChannel } from 'distributed-sagas/channel';
```

## Development

### Build

The library is built with dual CommonJS and ESM support, with TypeScript declarations alongside each module:

```bash
npm run build
```

This will create two output directories:
- `dist/cjs/` - CommonJS modules with `.d.ts` files
- `dist/esm/` - ES modules with `.d.ts` files

Each directory contains the compiled JavaScript files (`.js`), source maps (`.js.map`), TypeScript declarations (`.d.ts`), and declaration maps (`.d.ts.map`) co-located together. This ensures proper type resolution for both CommonJS and ESM consumers.

### Build Scripts

- `npm run build` - Build all formats (CJS + ESM, each with types)
- `npm run build:cjs` - Build CommonJS with type declarations
- `npm run build:esm` - Build ESM with type declarations

### Build Configuration

The build uses:
- **SWC** (`.swcrc`, `.swcrc.esm`) - Fast JavaScript compilation
- **TypeScript** (`tsconfig.cjs.json`, `tsconfig.esm.json`) - Type declaration generation
- Type declarations are co-located with JavaScript files for proper module resolution

### Testing

```bash
npm test
```

## 📊 Saga Dashboard

This library now includes **Saga Board** - a lightweight, pluggable dashboard for monitoring and managing your distributed sagas in real-time!

### Quick Start

```typescript
import express from 'express';
import { createSagaBoard, SagaAdapter } from '@zrcni/distributed-saga-board-api';
import { ExpressAdapter } from '@zrcni/distributed-saga-board-express';

const app = express();
const coordinator = InMemorySagaLog.createInMemorySagaCoordinator();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/sagas');

createSagaBoard({
  adapters: [new SagaAdapter(coordinator, { name: 'Orders' })],
  serverAdapter,
});

app.use('/admin/sagas', serverAdapter.getRouter());
```

### Features

- 📊 Real-time saga monitoring
- 🎯 Task status visualization
- 🔄 Saga actions (abort, retry)
- 🔌 Framework agnostic (Express adapter included)
- 🔒 Built-in access control

See the [Saga Board README](./packages/SAGA_BOARD_README.md) for complete documentation and the [example](./examples/with-express-dashboard) for a working demo.

## License

ISC
