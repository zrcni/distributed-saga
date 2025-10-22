# Testing Guide

This document explains the different testing configurations available in this project.

## Test Scripts

### `npm test`
Runs all tests including MongoDB-dependent tests. This will start an in-memory MongoDB instance.

```bash
npm test
```

### `npm run test:no-mongo`
Runs all tests **except** MongoDB-dependent tests. This is faster and doesn't require MongoDB setup.

```bash
npm run test:no-mongo
```

### `npm run test:mongo`
Runs only MongoDB-dependent tests.

```bash
npm run test:mongo
```

## Running Specific Tests

### Run a specific test file
```bash
npm test -- SagaOrchestrator.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="should start"
```

### Skip MongoDB setup for specific test runs
Use the `SKIP_MONGODB_SETUP` environment variable:

```bash
SKIP_MONGODB_SETUP=true npm test -- InMemorySagaLog.test.ts
```

## MongoDB Memory Server

The project uses `mongodb-memory-server` for testing MongoDB functionality. The server is:

- Started once in `jest.global-setup.js` before all tests
- Shared across all test files that need it
- Stopped in `jest.global-teardown.js` after all tests complete

### When is MongoDB started?

- ✅ When running `npm test` (all tests)
- ✅ When running `npm run test:mongo`
- ✅ When running `npm test -- MongoDBSagaLog.test.ts`
- ❌ When running `npm run test:no-mongo`
- ❌ When setting `SKIP_MONGODB_SETUP=true`

## Configuration Files

- `jest.config.js` - Main Jest configuration (includes MongoDB setup)
- `jest.config.no-mongo.js` - Configuration without MongoDB (excludes MongoDB tests)
- `jest.global-setup.js` - Global setup that starts MongoDB
- `jest.global-teardown.js` - Global teardown that stops MongoDB

## Best Practices

1. **During development**: Use `npm run test:no-mongo` for faster feedback when working on non-MongoDB features
2. **Before committing**: Run `npm test` to ensure all tests pass
3. **CI/CD**: Run `npm test` to verify all functionality
4. **Debugging specific tests**: Use `SKIP_MONGODB_SETUP=true` when debugging non-MongoDB tests to reduce overhead
