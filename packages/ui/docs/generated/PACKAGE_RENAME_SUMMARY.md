# Package Rename Summary

All packages have been renamed from `@saga-board/*` to `@zrcni/distributed-saga-board-*`.

## Package Name Changes

| Old Name | New Name |
|----------|----------|
| `@saga-board/api` | `@zrcni/distributed-saga-board-api` |
| `@saga-board/express` | `@zrcni/distributed-saga-board-express` |
| `@saga-board/ui` | `@zrcni/distributed-saga-board-ui` |

## Files Updated

### Package Manifests
- ✅ `packages/api/package.json`
- ✅ `packages/express/package.json`
- ✅ `packages/ui/package.json`
- ✅ `examples/with-express-dashboard/package.json`

### Source Code
- ✅ `packages/express/src/ExpressAdapter.ts` - Updated imports and error messages
- ✅ `examples/with-express-dashboard/index.ts` - Updated imports

### TypeScript Configuration
- ✅ `packages/express/tsconfig.json` - Updated path mappings
- ✅ `packages/ui/tsconfig.json` - Updated path mappings
- ✅ `examples/with-express-dashboard/tsconfig.json` - Updated path mappings

### Documentation
- ✅ `packages/SAGA_BOARD_README.md` - Updated all package references
- ✅ `packages/DEVELOPMENT_SETUP.md` - Updated architecture diagram and examples

## Verification

All packages have been:
1. ✅ Renamed in package.json files
2. ✅ Dependencies updated to use new names
3. ✅ NPM install completed successfully
4. ✅ Built successfully:
   - API package builds
   - Express package builds
   - UI package builds

## Next Steps

When publishing these packages to npm, they will be available as:
- `npm install @zrcni/distributed-saga-board-api`
- `npm install @zrcni/distributed-saga-board-express`
- `npm install @zrcni/distributed-saga-board-ui`

## Migration Guide for Users

If you have existing code using the old package names, update your imports:

```typescript
// Old
import { createSagaBoard } from '@saga-board/api';
import { ExpressAdapter } from '@saga-board/express';

// New
import { createSagaBoard } from '@zrcni/distributed-saga-board-api';
import { ExpressAdapter } from '@zrcni/distributed-saga-board-express';
```

And update your package.json:

```json
{
  "dependencies": {
    "@zrcni/distributed-saga-board-api": "^0.0.1",
    "@zrcni/distributed-saga-board-express": "^0.0.1"
  }
}
```
