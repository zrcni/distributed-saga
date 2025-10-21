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

// Create nested sagas example - Web Crawler
async function createNestedSagasExample() {
  console.log("\nCreating nested sagas example (Web Crawler)...")

  const parentSagaId = "crawl-example-com"
  const domain = "example.com"
  const pageCount = 5

  // Create parent saga
  const parentResult = await coordinator.createSaga(parentSagaId, {
    domain,
    pageCount,
  })

  if (parentResult.isOk()) {
    const parent = parentResult.data as Saga<{ domain: string; pageCount: number }>

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
      const childResult = await coordinator.createSaga(
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

      if (childResult.isOk()) {
        const child = childResult.data as Saga<{ url: string; pageNumber: number }>

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
          const processResult = await coordinator.createSaga(
            processSagaId,
            {
              pageId: childSagaId,
              contentType: "webpage",
            }
          )
          
          if (processResult.isOk()) {
            const processSaga = processResult.data as Saga<{ pageId: string; contentType: string }>
            
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
            
            await processSaga.endSaga()
          }
          
          await child.endTask("processContent", { processed: true })
          
          await child.startTask("saveToDatabase")
          await child.endTask("saveToDatabase", { saved: true, savedAt: new Date() })
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
          const processResult = await coordinator.createSaga(
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
          
          if (processResult.isOk()) {
            const processSaga = processResult.data as Saga<{ pageId: string; contentType: string }>
            
            // Complete generateSummary
            await processSaga.startTask("generateSummary")
            await processSaga.endTask("generateSummary", {
              summary: `Summary of page ${i}`,
              length: 50,
            })
            
            // Start but don't complete generateEmbeddings (shows active state)
            await processSaga.startTask("generateEmbeddings")
            // Leave incomplete to show active state in nested saga
          }
          
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
          await child.endTask("saveToDatabase", { saved: true, savedAt: new Date() })
          
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
    }

    // Complete parent saga tasks
    await parent.endTask("crawlAllPages", { childResults })
    await parent.startTask("aggregateResults")
    
    const successCount = childResults.filter(r => r.status === "completed").length
    const failureCount = childResults.filter(r => r.status === "aborted").length
    const activeCount = childResults.filter(r => r.status === "active").length
    
    await parent.endTask("aggregateResults", {
      total: childResults.length,
      success: successCount,
      failed: failureCount,
      active: activeCount,
      successRate: (successCount / childResults.length) * 100,
    })
    
    // Leave parent saga incomplete to show it's still active
    // This demonstrates parent saga monitoring child sagas
  }

  console.log("✓ Created nested sagas example:")
  console.log("  - 1 parent saga (crawl-example-com)")
  console.log("  - 5 child sagas (page crawlers)")
  console.log("  - 5 nested child sagas (content processors)")
  console.log("  Total: 11 sagas with 3 levels of nesting")
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
          </ul>
        </div>
        
        <div class="feature">
          <strong>Nested Sagas (Web Crawler) 🆕</strong>
          <ul>
            <li><strong>crawl-example-com</strong> - Parent saga coordinating webpage crawling</li>
            <li>5 child sagas (page crawlers) showing different states:
              <ul>
                <li>Pages 1, 2, 5 - Completed ✓</li>
                <li>Page 3 - Active (processing content) →</li>
                <li>Page 4 - Aborted with compensation ✗</li>
              </ul>
            </li>
            <li>5 nested child sagas (content processors):
              <ul>
                <li>Each page has a <code>process-webpage-content</code> saga</li>
                <li>Tasks: generateSummary → generateEmbeddings</li>
                <li>Demonstrates 3 levels of nesting!</li>
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
      </body>
    </html>
  `)
})

// Start server
async function start() {
  try {
    await createExampleSagas()
    await createNestedSagasExample()

    app.listen(port, () => {
      console.log(`\n🚀 Server running on http://localhost:${port}`)
      console.log(`📊 Saga Dashboard: http://localhost:${port}/admin/sagas`)
      console.log("\nExample sagas have been created for demonstration.")
      console.log("- Regular sagas: order-001, order-002, order-003")
      console.log("- Nested sagas: crawl-example-com (parent) with 5 child sagas + 5 nested children")
      console.log("  Total: 11 sagas demonstrating 3 levels of nesting\n")
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

start()
