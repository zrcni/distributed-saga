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
  // Example saga definition - note: optional tasks feature is available
  // but we're creating sagas manually for dashboard demonstration
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
  const saga1 = await coordinator.createSaga("order-001", {
    orderId: "order-001",
    amount: 100,
    customerId: "cust-123",
  })

  await saga1.startTask("processPayment")
  await saga1.endTask("processPayment", { paymentId: "pay_123" })
  await saga1.startTask("reserveInventory")
  // Leave this task incomplete to demonstrate recovery scenario

  const saga2 = await coordinator.createSaga("order-002", {
    orderId: "order-002",
    amount: 250,
    customerId: "cust-456",
  })

  await saga2.startTask("processPayment")
  await saga2.endTask("processPayment", { paymentId: "pay_456" })
  await saga2.startTask("reserveInventory")
  await saga2.endTask("reserveInventory", { reservationId: "res_789" })
  await saga2.startTask("sendEmail")
  await saga2.endTask("sendEmail", { emailSent: true })
  await saga2.endSaga()

  const saga3 = await coordinator.createSaga("order-003", {
    orderId: "order-003",
    amount: 500,
    customerId: "cust-789",
  })

  await saga3.startTask("processPayment")
  await saga3.endTask("processPayment", { paymentId: "pay_789" })
  await saga3.abortSaga()
  // Start compensation
  await saga3.startCompensatingTask("processPayment", {
    paymentId: "pay_789",
  })
  await saga3.endCompensatingTask("processPayment", { refunded: true })

  // Create saga 4 - Demonstrating optional tasks feature
  const saga4 = await coordinator.createSaga("order-004", {
    orderId: "order-004",
    amount: 175,
    customerId: "cust-321",
  })

  await saga4.startTask("processPayment")
  await saga4.endTask("processPayment", { paymentId: "pay_321" })
  await saga4.startTask("reserveInventory")
  await saga4.endTask("reserveInventory", { reservationId: "res_321" })
  
  // Optional task: Send SMS notification (marked as optional via metadata)
  await saga4.startTask("sendSMSNotification", {}, { isOptional: true })
  await saga4.endTask("sendSMSNotification", null) // null indicates optional task failed gracefully
  
  // Another optional task: Update loyalty points
  await saga4.startTask("updateLoyaltyPoints", {}, { isOptional: true })
  await saga4.endTask("updateLoyaltyPoints", { pointsAdded: 10 })
  
  await saga4.startTask("sendEmail")
  await saga4.endTask("sendEmail", { emailSent: true })
  await saga4.endSaga()

  console.log("Created example sagas")
}

// Create nested sagas example - Web Crawler
async function createNestedSagasExample() {
  console.log("\nCreating nested sagas example (Web Crawler)...")

  const parentSagaId = "crawl-example-com"
  const domain = "example.com"
  const pageCount = 5

  // Create parent saga
  const parent = await coordinator.createSaga(parentSagaId, {
    domain,
    pageCount,
  })

  // Parent saga: Plan the crawl
  await parent.startTask("planCrawl")
  await parent.endTask("planCrawl", {
    webpages: Array.from({ length: pageCount }, (_, i) => ({
      url: `https://${domain}/page${i + 1}`,
      pageNumber: i + 1,
    })),
  })

  // Parent saga: Start crawling all pages
  await parent.startTask("crawlAllPages")

  // Create child sagas for each page
  const childResults = []
  for (let i = 1; i <= pageCount; i++) {
    const childSagaId = `${parentSagaId}-page${i}`
    const child = await coordinator.createSaga(
      childSagaId,
      {
        url: `https://${domain}/page${i}`,
        pageNumber: i,
      },
      {
        parentSagaId: parentSagaId,
        parentTaskId: "crawlAllPages", // the parent task that creates child sagas
      }
    )

    // Simulate different states for different child sagas
    if (i === 1 || i === 2 || i === 5) {
      // Completed child sagas with deep nesting
      await child.startTask("fetchContent")
      await child.endTask("fetchContent", {
        html: `<html><title>Page ${i}</title></html>`,
        fetchedAt: new Date(),
      })

      await child.startTask("parseContent")
      await child.endTask("parseContent", {
        title: `Page ${i}`,
        wordCount: 100 + i * 10,
      })

      // NEW: Add processContent task with nested child saga
      await child.startTask("processContent")

      // Create nested child saga for content processing
      const processSagaId = `${childSagaId}-process-content`
      const processSaga = await coordinator.createSaga(processSagaId, {
        pageNumber: i,
        pageId: childSagaId,
        contentType: "webpage",
      }, {
        parentSagaId: childSagaId,
        parentTaskId: "processContent",
      })

      // Generate summary
      await processSaga.startTask("generateSummary")
      await processSaga.endTask("generateSummary", {
        summary: `Summary of page ${i}`,
        length: 50,
      })

      // Generate embeddings
      await processSaga.startTask("generateEmbeddings")
      await processSaga.endTask("generateEmbeddings", {
        embeddings: [0.1, 0.2, 0.3],
        model: "text-embedding-v1",
      })
      
      // Optional: Generate image alt text (AI feature, may fail)
      await processSaga.startTask("generateImageAltText", {}, { isOptional: true })
      await processSaga.endTask("generateImageAltText", { altTextsGenerated: 3 })

      await processSaga.endSaga()

      await child.endTask("processContent", { processed: true })

      await child.startTask("saveToDatabase")
      await child.endTask("saveToDatabase", {
        saved: true,
        savedAt: new Date(),
      })
      
      // Optional: Update search index (nice-to-have, can be done async)
      await child.startTask("updateSearchIndex", {}, { isOptional: true })
      await child.endTask("updateSearchIndex", null) // Simulating failure
      
      await child.endSaga()
      childResults.push({ pageNumber: i, status: "completed" })
    } else if (i === 3) {
      // Active child saga (in progress) - stopped at processContent
      await child.startTask("fetchContent")
      await child.endTask("fetchContent", {
        html: `<html><title>Page ${i}</title></html>`,
        fetchedAt: new Date(),
      })

      await child.startTask("parseContent")
      await child.endTask("parseContent", {
        title: `Page ${i}`,
        wordCount: 130,
      })

      // Start processContent but don't complete it (shows nested saga in progress)
      await child.startTask("processContent")

      const processSagaId = `${childSagaId}-process-content`
      const processSaga = await coordinator.createSaga(
        processSagaId,
        {
          pageId: childSagaId,
          contentType: "webpage",
        },
        {
          parentSagaId: childSagaId,
          parentTaskId: "processContent",
        }
      )

      // Complete generateSummary
      await processSaga.startTask("generateSummary")
      await processSaga.endTask("generateSummary", {
        summary: `Summary of page ${i}`,
        length: 50,
      })

      // Start but don't complete generateEmbeddings (shows active state)
      await processSaga.startTask("generateEmbeddings")

      // Leave processContent task incomplete to show "in progress" state
      childResults.push({ pageNumber: i, status: "active" })
    } else if (i === 4) {
      // Failed and compensating child saga
      await child.startTask("fetchContent")
      await child.endTask("fetchContent", {
        html: `<html><title>Page ${i}</title></html>`,
        fetchedAt: new Date(),
      })

      await child.startTask("parseContent")
      await child.endTask("parseContent", {
        title: `Page ${i}`,
        wordCount: 140,
      })

      await child.startTask("processContent")
      await child.endTask("processContent", { processed: true })

      await child.startTask("saveToDatabase")
      await child.endTask("saveToDatabase", {
        saved: true,
        savedAt: new Date(),
      })

      // Abort and compensate
      await child.abortSaga()
      await child.startCompensatingTask("saveToDatabase", {})
      await child.endCompensatingTask("saveToDatabase", { deleted: true })
      await child.startCompensatingTask("processContent", {})
      await child.endCompensatingTask("processContent", { cleared: true })
      await child.startCompensatingTask("parseContent", {})
      await child.endCompensatingTask("parseContent", { cleared: true })
      await child.startCompensatingTask("fetchContent", {})
      await child.endCompensatingTask("fetchContent", { cleared: true })
      await child.endSaga()
      childResults.push({ pageNumber: i, status: "aborted" })
    }
  }

  // Complete parent saga tasks
  await parent.endTask("crawlAllPages", { childResults })
  await parent.startTask("aggregateResults")

  const successCount = childResults.filter(
    (r) => r.status === "completed"
  ).length
  const failureCount = childResults.filter((r) => r.status === "aborted").length
  const activeCount = childResults.filter((r) => r.status === "active").length

  await parent.endTask("aggregateResults", {
    total: childResults.length,
    success: successCount,
    failed: failureCount,
    active: activeCount,
    successRate: (successCount / childResults.length) * 100,
  })

  console.log("✓ Created nested sagas example:")
  console.log("  - 1 parent saga (crawl-example-com)")
  console.log("  - 5 child sagas (page crawlers)")
  console.log("  - 5 nested child sagas (content processors)")
  console.log("  - Optional tasks: image alt text + search indexing")
  console.log("  Total: 11 sagas with 3 levels of nesting")
}

// Create hanging sagas (running for more than 24 hours)
async function createHangingSagasExample() {
  console.log("\nCreating hanging sagas example...")

  // Helper function to manipulate saga timestamp (for demonstration purposes)
  const setOldTimestamp = (sagaId: string, daysAgo: number) => {
    const log = coordinator.log as any // Access internal log
    if (log.sagas && log.sagas[sagaId]) {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - daysAgo)
      log.sagas[sagaId].createdAt = oldDate

      // Also update the first message timestamp (StartSaga message)
      if (log.sagas[sagaId].messages && log.sagas[sagaId].messages.length > 0) {
        log.sagas[sagaId].messages[0].timestamp = oldDate
      }
    }
  }

  // Create hanging saga 1: Stuck in payment processing (3 days old)
  const saga1 = await coordinator.createSaga("order-hanging-001", {
    orderId: "order-hanging-001",
    amount: 350,
    customerId: "cust-999",
  })

  await saga1.startTask("processPayment")
  // Leave stuck at payment processing
  setOldTimestamp("order-hanging-001", 3) // 3 days ago

  // Create hanging saga 2: Stuck waiting for external service (2 days old)
  const saga2 = await coordinator.createSaga("order-hanging-002", {
    orderId: "order-hanging-002",
    amount: 750,
    customerId: "cust-888",
  })

  await saga2.startTask("processPayment")
  await saga2.endTask("processPayment", { paymentId: "pay_delayed_001" })
  await saga2.startTask("reserveInventory")
  // Stuck waiting for inventory service
  setOldTimestamp("order-hanging-002", 2) // 2 days ago

  // Create hanging saga 3: Long-running batch job (5 days old)
  const saga3 = await coordinator.createSaga("batch-export-001", {
    jobId: "batch-export-001",
    recordCount: 1000000,
    exportType: "full",
  })

  await saga3.startTask("prepareExport")
  await saga3.endTask("prepareExport", { prepared: true })
  await saga3.startTask("exportData")
  // Stuck in long-running export
  setOldTimestamp("batch-export-001", 5) // 5 days ago

  // Create hanging saga 4: With child sagas - Parent stuck (4 days old)
  const hangingParentId = "migration-parent-001"
  const parent = await coordinator.createSaga(hangingParentId, {
    migrationType: "database",
    tables: 50,
  })

  await parent.startTask("planMigration")
  await parent.endTask("planMigration", { planned: true })
  await parent.startTask("executeMigration")

  // Create a few child sagas (some completed, some stuck)
  for (let i = 1; i <= 3; i++) {
    const childId = `${hangingParentId}-table-${i}`
    const child = await coordinator.createSaga(
      childId,
      { tableName: `users_${i}`, rowCount: 10000 },
      { parentSagaId: hangingParentId, parentTaskId: "executeMigration" }
    )

    await child.startTask("backupTable")
    await child.endTask("backupTable", { backedUp: true })

    if (i === 1) {
      // First child completed
      await child.startTask("migrateData")
      await child.endTask("migrateData", { migrated: true })
      await child.endSaga()
    } else {
      // Other children stuck at migration
      await child.startTask("migrateData")
      setOldTimestamp(childId, 4) // Same age as parent
    }
  }

  // Parent still waiting for children
  setOldTimestamp(hangingParentId, 4) // 4 days ago

  // Create hanging saga 5: Recently crossed 24h threshold (1.1 days old)
  const saga5 = await coordinator.createSaga("order-hanging-003", {
    orderId: "order-hanging-003",
    amount: 150,
    customerId: "cust-777",
  })

  await saga5.startTask("processPayment")
  await saga5.endTask("processPayment", { paymentId: "pay_recent_001" })
  await saga5.startTask("reserveInventory")
  await saga5.endTask("reserveInventory", { reservationId: "res_recent_001" })
  await saga5.startTask("sendEmail")
  // Stuck sending email just over 24 hours
  setOldTimestamp("order-hanging-003", 1.1) // 1.1 days ago (26.4 hours)

  console.log("✓ Created hanging sagas example:")
  console.log("  - order-hanging-001: 3 days old (stuck at payment)")
  console.log("  - order-hanging-002: 2 days old (stuck waiting for inventory)")
  console.log("  - batch-export-001: 5 days old (long-running export)")
  console.log(
    "  - migration-parent-001: 4 days old (parent with stuck children)"
  )
  console.log("  - order-hanging-003: 26 hours old (just crossed threshold)")
  console.log("  Total: 5 hanging sagas + 3 child migration sagas (2 hanging)")
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
          h2 { color: #555; font-size: 1.2em; margin-top: 30px; }
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
          ul { line-height: 1.8; }
          .feature {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <h1>Saga Board Example</h1>
        <p>Welcome to the Saga Board example application!</p>
        
        <a href="/admin/sagas">Open Saga Dashboard →</a>
        
        <h2>Example Sagas</h2>
        
        <div class="feature">
          <strong>Regular Sagas (Order Processing)</strong>
          <ul>
            <li><strong>order-001</strong> - In Progress (recovery scenario)</li>
            <li><strong>order-002</strong> - Completed Successfully</li>
            <li><strong>order-003</strong> - Aborted with Compensation</li>
            <li><strong>order-004</strong> - Completed with Optional Tasks 🆕⭕
              <ul>
                <li>Demonstrates optional tasks feature</li>
                <li>SMS notification (optional, failed gracefully)</li>
                <li>Loyalty points (optional, completed successfully)</li>
              </ul>
            </li>
          </ul>
        </div>
        
        <div class="feature">
          <strong>Nested Sagas (Web Crawler) 🆕</strong>
          <ul>
            <li><strong>crawl-example-com</strong> - Parent saga coordinating webpage crawling</li>
            <li>5 child sagas (page crawlers) showing different states:
              <ul>
                <li>Pages 1, 2, 5 - Completed ✓ (with optional tasks)</li>
                <li>Page 3 - Active (processing content) →</li>
                <li>Page 4 - Aborted with compensation ✗</li>
              </ul>
            </li>
            <li>5 nested child sagas (content processors):
              <ul>
                <li>Each page has a <code>process-webpage-content</code> saga</li>
                <li>Tasks: generateSummary → generateEmbeddings → generateImageAltText ⭕</li>
                <li>Optional: Image alt text generation (AI feature)</li>
                <li>Demonstrates 3 levels of nesting!</li>
              </ul>
            </li>
            <li>Optional tasks ⭕ in completed pages:
              <ul>
                <li>Generate image alt text (optional, nice-to-have AI feature)</li>
                <li>Update search index (optional, can be done asynchronously)</li>
              </ul>
            </li>
          </ul>
          <p style="margin-top: 10px; color: #666; font-style: italic;">
            This demonstrates deep parent-child saga hierarchies where sagas create 
            child sagas that create their own child sagas. Great for complex workflows 
            like batch processing, multi-step pipelines, or distributed crawling with 
            content processing.
          </p>
        </div>
        
        <div class="feature">
          <strong>Hanging Sagas (Long-Running) 🆕⚠️</strong>
          <ul>
            <li><strong>order-hanging-001</strong> - 3 days old, stuck at payment</li>
            <li><strong>order-hanging-002</strong> - 2 days old, waiting for inventory</li>
            <li><strong>batch-export-001</strong> - 5 days old, long-running export</li>
            <li><strong>migration-parent-001</strong> - 4 days old with stuck child sagas</li>
            <li><strong>order-hanging-003</strong> - 26 hours old, just crossed threshold</li>
          </ul>
          <p style="margin-top: 10px; color: #666; font-style: italic;">
            Navigate to the <strong>Hanging Sagas</strong> tab in the dashboard to see 
            sagas that have been running for more than 24 hours. This view helps identify 
            stuck workflows, infinite loops, or sagas waiting for external services that 
            may have failed.
          </p>
        </div>
      </body>
    </html>
  `)
})

// Start server
async function start() {
  try {
    await createExampleSagas()
    await createNestedSagasExample()
    await createHangingSagasExample()

    app.listen(port, () => {
      console.log(`\n🚀 Server running on http://localhost:${port}`)
      console.log(`📊 Saga Dashboard: http://localhost:${port}/admin/sagas`)
      console.log("\nExample sagas have been created for demonstration.")
      console.log("- Regular sagas: order-001, order-002, order-003")
      console.log(
        "- Nested sagas: crawl-example-com (parent) with 5 child sagas + 5 nested children"
      )
      console.log("  Total: 11 sagas demonstrating 3 levels of nesting")
      console.log(
        "- Hanging sagas: 5 root sagas + 2 child sagas (running > 24 hours)"
      )
      console.log("  Check the 'Hanging Sagas' tab in the dashboard!\n")
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

start()
