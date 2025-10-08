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

## License

ISC
