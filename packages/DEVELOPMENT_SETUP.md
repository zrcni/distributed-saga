# Development Setup - Saga Board

Complete guide for setting up and developing with Saga Board packages.

## 📁 Project Structure

```
distributed-saga/
├── src/                          # Main distributed-saga library
├── packages/                     # Saga Board packages
│   ├── api/                     # @saga-board/api
│   ├── express/                 # @saga-board/express
│   └── ui/                      # @saga-board/ui
└── examples/
    └── with-express-dashboard/  # Example application
```

## 🔧 Setting Up for Development

### 1. Initial Setup

```bash
# From the root of the repository
cd distributed-saga

# Install main library dependencies
npm install

# Install package dependencies
cd packages/api && npm install && cd ../..
cd packages/express && npm install && cd ../..
cd packages/ui && npm install && cd ../..

# Install example dependencies
cd examples/with-express-dashboard && npm install && cd ../..
```

### 2. TypeScript Configuration

Each package and the example have TypeScript path mappings configured:

#### packages/api/tsconfig.json
Maps `@zrcni/distributed-saga` to the main library source:
```json
{
  "paths": {
    "@zrcni/distributed-saga": ["../../src"]
  }
}
```

#### packages/express/tsconfig.json
Maps to sibling packages:
```json
{
  "paths": {
    "@saga-board/api": ["../api/src"],
    "@saga-board/ui": ["../ui/src"]
  }
}
```

#### examples/with-express-dashboard/tsconfig.json
Maps to package sources:
```json
{
  "paths": {
    "@saga-board/api": ["../../packages/api/src"],
    "@saga-board/express": ["../../packages/express/src"],
    "@saga-board/ui": ["../../packages/ui/src"]
  }
}
```

### 3. Running the Example

```bash
cd examples/with-express-dashboard
npm start
```

The example uses `ts-node` with `tsconfig-paths/register` to resolve module paths at runtime.

## 🏗️ Building Packages

### Build Individual Packages

```bash
# API package
cd packages/api
npm run build

# Express adapter
cd packages/express
npm run build
```

### Build All (Future)

When you add a root-level build script:

```bash
# From root
npm run build:packages
```

## 📝 Making Changes

### Editing the API Package

1. Edit files in `packages/api/src/`
2. TypeScript will pick up changes automatically in development
3. Build when ready: `cd packages/api && npm run build`

### Editing the Express Adapter

1. Edit files in `packages/express/src/`
2. The example will pick up changes when you restart it
3. Build when ready: `cd packages/express && npm run build`

### Editing the Example

1. Edit `examples/with-express-dashboard/index.ts`
2. Restart the server or use `npm run dev` for auto-reload

## 🧪 Testing

### Testing the Example

```bash
cd examples/with-express-dashboard
npm start

# In another terminal
curl http://localhost:3000/admin/sagas/api/sources
```

### Testing API Endpoints

```bash
# Get all sources
curl http://localhost:3000/admin/sagas/api/sources

# Get sagas for a source
curl http://localhost:3000/admin/sagas/api/sources/Orders/sagas

# Get specific saga
curl http://localhost:3000/admin/sagas/api/sources/Orders/sagas/order-001

# Abort a saga
curl -X POST http://localhost:3000/admin/sagas/api/sources/Orders/sagas/order-001/abort
```

## 🐛 Troubleshooting

### TypeScript Errors

**Problem**: `Cannot find module '@saga-board/api'`

**Solution**: 
1. Check that `tsconfig.json` has correct path mappings
2. Ensure `tsconfig-paths` is installed
3. Restart TypeScript server in VS Code

**Problem**: `File is not under 'rootDir'`

**Solution**: Remove `rootDir` from `tsconfig.json`

### Runtime Errors

**Problem**: Module not found at runtime

**Solution**: Ensure `tsconfig-paths/register` is loaded:
```bash
ts-node -r tsconfig-paths/register index.ts
```

**Problem**: Express router not working

**Solution**: Check that:
1. The adapter is properly created
2. `setBasePath()` is called before `createSagaBoard()`
3. The router is mounted correctly

### VS Code Issues

**Problem**: Imports show errors but code runs

**Solution**:
1. Cmd/Ctrl + Shift + P
2. "TypeScript: Restart TS Server"

## 📦 Publishing (Future)

When ready to publish:

1. **Build all packages**:
   ```bash
   cd packages/api && npm run build
   cd ../express && npm run build
   ```

2. **Update versions**:
   ```bash
   cd packages/api
   npm version patch
   cd ../express
   npm version patch
   ```

3. **Publish**:
   ```bash
   cd packages/api
   npm publish
   cd ../express
   npm publish
   ```

## 🔍 Code Organization

### API Package Responsibilities
- Define interfaces (`ISagaAdapter`, `IServerAdapter`)
- Implement `SagaAdapter` (wraps `SagaCoordinator`)
- Provide `createSagaBoard()` function
- Type definitions

### Express Package Responsibilities
- Implement `ExpressAdapter` (implements `IServerAdapter`)
- Set up Express routes
- Serve HTML UI
- Handle API requests

### UI Package Responsibilities
- Static assets (favicons, images)
- CSS/styles (future)
- JavaScript bundles (future)

## 💡 Best Practices

1. **Always use path mappings** for cross-package imports
2. **Don't specify `rootDir`** when using paths outside your package
3. **Enable `skipLibCheck`** to avoid type checking dependencies
4. **Use `tsconfig-paths/register`** for ts-node execution
5. **Build before publishing** to ensure valid output
6. **Test in the example** before making PRs

## 📚 Additional Resources

- [TypeScript Setup Guide](./TYPESCRIPT_SETUP.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Saga Board README](./SAGA_BOARD_README.md)

## 🤝 Contributing

When contributing:

1. Make changes in the appropriate package
2. Test using the example application
3. Update documentation if needed
4. Ensure TypeScript compiles without errors
5. Update version numbers appropriately

---

Happy developing! 🚀
