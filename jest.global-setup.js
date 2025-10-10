const { MongoMemoryServer } = require("mongodb-memory-server")

module.exports = async function globalSetup() {
  // Skip MongoDB setup if explicitly disabled via environment variable
  if (process.env.SKIP_MONGODB_SETUP === "true") {
    console.log("Skipping MongoDB Memory Server setup (SKIP_MONGODB_SETUP=true)")
    return
  }

  // Create in-memory MongoDB instance
  const mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()

  // Store the URI and server instance for use in tests and teardown
  global.__MONGOINSTANCE__ = mongoServer
  process.env.MONGO_URI = uri

  console.log("MongoDB Memory Server started at:", uri)
}
