# TypeScript Configuration Guide for Saga Board

This guide explains how to properly configure TypeScript to resolve the `@saga-board/*` packages.

## 🎯 Problem

When using the saga-board packages in development (before they're published to npm), TypeScript cannot resolve module imports like:

```typescript
import { createSagaBoard, SagaAdapter } from '@saga-board/api';
import { ExpressAdapter } from '@saga-board/express';
```

## ✅ Solution

Use TypeScript path mapping to resolve these packages to their source directories.

### For Applications Using Saga Board

In your `tsconfig.json`:

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

If using `file:` dependencies during development:

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

### For ts-node (Development)

Install `tsconfig-paths`:

```bash
npm install --save-dev tsconfig-paths
```

Then use the `-r` flag:

```json
{
  "scripts": {
    "start": "ts-node -r tsconfig-paths/register index.ts",
    "dev": "ts-node-dev -r tsconfig-paths/register index.ts"
  }
}
```

### For Saga Board Package Development

#### packages/api/tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@zrcni/distributed-saga": ["../../src"]
    }
  }
}
```

#### packages/express/tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@saga-board/api": ["../api/src"],
      "@saga-board/ui": ["../ui/src"]
    }
  }
}
```

## 📝 Important Notes

### rootDir Consideration

When using path mapping that references files outside your project directory, you should **NOT** specify a `rootDir` in `tsconfig.json`, or TypeScript will complain:

```
File 'xxx' is not under 'rootDir'. 'rootDir' is expected to contain all source files.
```

**Solution**: Remove `rootDir` from your tsconfig:

```json
{
  "compilerOptions": {
    // ❌ "rootDir": "./src",  // Remove this
    "outDir": "./dist"
  }
}
```

### skipLibCheck

Always enable `skipLibCheck` to avoid type checking issues in dependencies:

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

## 🔧 Building for Production

When building the packages for production, the path mappings are resolved at build time:

```bash
cd packages/api
npm run build

cd ../express
npm run build
```

The built packages in `dist/` will have proper module resolution.

## 🚀 Example Configuration

See the complete working example in:
- `examples/with-express-dashboard/tsconfig.json`
- `examples/with-express-dashboard/package.json`

## 🐛 Troubleshooting

### Error: Cannot find module '@saga-board/api'

**Solution**: Add path mapping to your `tsconfig.json` and ensure `tsconfig-paths` is registered for ts-node.

### Error: File is not under 'rootDir'

**Solution**: Remove `rootDir` from your `tsconfig.json`.

### Error: Module resolution issues at runtime

**Solution**: Make sure `tsconfig-paths/register` is loaded before your application:

```bash
ts-node -r tsconfig-paths/register your-app.ts
```

### VS Code doesn't recognize the imports

**Solution**: Reload the TypeScript server:
1. Open Command Palette (Cmd/Ctrl + Shift + P)
2. Run "TypeScript: Restart TS Server"

## 📚 Further Reading

- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)
- [tsconfig-paths](https://github.com/dividab/tsconfig-paths)
- [ts-node](https://typestrong.org/ts-node/)
