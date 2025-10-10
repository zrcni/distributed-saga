const baseConfig = require("./jest.config")

// Configuration for tests that don't need MongoDB
module.exports = {
  ...baseConfig,
  // Override global setup/teardown to skip MongoDB
  globalSetup: undefined,
  globalTeardown: undefined,
  // Explicitly exclude MongoDB tests
  testPathIgnorePatterns: [
    "/node_modules/",
    "MongoDBSagaLog.test.ts"
  ]
}
