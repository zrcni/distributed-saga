import express from "express"
import { createSagaBoard, SagaAdapter } from "@zrcni/distributed-saga-board-api"
import { ExpressAdapter } from "@zrcni/distributed-saga-board-express"
import { SagaBuilder, InMemorySagaLog, Saga } from "@zrcni/distributed-saga"

const app = express()
const port = 3000

// Create saga coordinator
const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()

// Create some example sagas for demonstration
async function createExampleSagas() {
  // Example saga definition
  const exampleSagaDefinition = SagaBuilder.start()
    .invoke(async () => {
      console.log("Step 1: Processing payment")
      return { paymentId: "pay_123" }
    })
    .compensate(async () => {
      console.log("Compensating: Refunding payment")
    })
    .withName("processPayment")
    .next()
    .invoke(async () => {
      console.log("Step 2: Reserving inventory")
      return { reservationId: "res_456" }
    })
    .compensate(async () => {
      console.log("Compensating: Releasing inventory")
    })
    .withName("reserveInventory")
    .next()
    .invoke(async () => {
      console.log("Step 3: Sending confirmation email")
      return { emailSent: true }
    })
    .compensate(async () => {
      console.log("Compensating: Sending cancellation email")
    })
    .withName("sendEmail")
    .end()

  // Create a few example sagas
  const saga1Result = await coordinator.createSaga("order-001", {
    orderId: "order-001",
    amount: 100,
    customerId: "cust-123",
  })

  if (saga1Result.isOk()) {
    const saga1 = saga1Result.data as Saga<{
      orderId: string
      amount: number
      customerId: string
    }>
    await saga1.startTask("processPayment")
    await saga1.endTask("processPayment", { paymentId: "pay_123" })
    await saga1.startTask("reserveInventory")
    // Leave this task incomplete to demonstrate recovery scenario
  }

  const saga2Result = await coordinator.createSaga("order-002", {
    orderId: "order-002",
    amount: 250,
    customerId: "cust-456",
  })

  if (saga2Result.isOk()) {
    const saga2 = saga2Result.data as Saga<{
      orderId: string
      amount: number
      customerId: string
    }>
    await saga2.startTask("processPayment")
    await saga2.endTask("processPayment", { paymentId: "pay_456" })
    await saga2.startTask("reserveInventory")
    await saga2.endTask("reserveInventory", { reservationId: "res_789" })
    await saga2.startTask("sendEmail")
    await saga2.endTask("sendEmail", { emailSent: true })
    await saga2.endSaga()
  }

  const saga3Result = await coordinator.createSaga("order-003", {
    orderId: "order-003",
    amount: 500,
    customerId: "cust-789",
  })

  if (saga3Result.isOk()) {
    const saga3 = saga3Result.data as Saga<{
      orderId: string
      amount: number
      customerId: string
    }>
    await saga3.startTask("processPayment")
    await saga3.endTask("processPayment", { paymentId: "pay_789" })
    await saga3.abortSaga()
    // Start compensation
    await saga3.startCompensatingTask("processPayment", {
      paymentId: "pay_789",
    })
    await saga3.endCompensatingTask("processPayment", { refunded: true })
  }

  console.log("Created example sagas")
}

// Setup Saga Board
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath("/admin/sagas")

const sagaAdapter = new SagaAdapter(coordinator, {
  name: "Orders",
  description: "Order processing sagas",
})

createSagaBoard({
  adapters: [sagaAdapter],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: "Order Saga Dashboard",
      miscLinks: [{ text: "Documentation", url: "/docs" }],
    },
  },
})

// Mount the saga board router
app.use("/admin/sagas", serverAdapter.getRouter())

// Basic routes
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Saga Board Example</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
          }
          h1 { color: #333; }
          a {
            display: inline-block;
            margin: 10px 0;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          a:hover { background: #2980b9; }
        </style>
      </head>
      <body>
        <h1>Saga Board Example</h1>
        <p>Welcome to the Saga Board example application!</p>
        <a href="/admin/sagas">Open Saga Dashboard →</a>
      </body>
    </html>
  `)
})

// Start server
async function start() {
  try {
    await createExampleSagas()

    app.listen(port, () => {
      console.log(`\n🚀 Server running on http://localhost:${port}`)
      console.log(`📊 Saga Dashboard: http://localhost:${port}/admin/sagas`)
      console.log("\nExample sagas have been created for demonstration.\n")
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

start()
