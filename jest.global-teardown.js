module.exports = async function globalTeardown() {
  // Stop the in-memory MongoDB instance
  const mongoServer = global.__MONGOINSTANCE__

  if (mongoServer) {
    await mongoServer.stop()
    console.log("MongoDB Memory Server stopped")
  }
}
