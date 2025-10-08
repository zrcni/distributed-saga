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

The library is built with dual CommonJS and ESM support:

```bash
npm run build
```

This will create three output directories:
- `dist/cjs/` - CommonJS modules
- `dist/esm/` - ES modules
- `dist/types/` - TypeScript declaration files

### Build Scripts

- `npm run build` - Build all formats (CJS + ESM + Types)
- `npm run build:cjs` - Build CommonJS only
- `npm run build:esm` - Build ESM only
- `npm run build:types` - Generate TypeScript declarations only

### Testing

```bash
npm test
```

## License

ISC
