/**
 * Comprehensive Example: Using Saga Plugins
 * 
 * This example demonstrates how to use saga plugins together
 * to create a fully observable, traceable saga system.
 */

import { SagaBuilder } from "../src/sagas/saga-definition/SagaBuilder"
import { SagaOrchestrator } from "../src/sagas/SagaOrchestrator"
import { InMemorySagaLog } from "../src/sagas/InMemorySagaLog"
import { Saga } from "../src/sagas/Saga"
import {
  HierarchicalLogger,
  DistributedTracer,
  ExecutionTreeTracker
} from "../src/sagas/plugins"

// ============================================================================
// Example 1: Basic Setup with All Plugins
// ============================================================================

export async function basicPluginExample() {
  console.log("\n=== Example 1: Basic Plugin Setup ===\n")

  // 1. Create the orchestrator
  const orchestrator = new SagaOrchestrator()

  // 2. Attach hierarchical logger
  const logger = new HierarchicalLogger({
    prettyPrint: true,
    onLog: async (entry) => {
      // Could send to external logging service
      // await logstash.send(entry)
    }
  })
  logger.attach(orchestrator)

  // 3. Attach distributed tracer
  const tracer = new DistributedTracer({
    serviceName: "order-service",
    sampleRate: 1.0,
    onSpanComplete: async (span) => {
      // Export to Jaeger/Zipkin/OpenTelemetry
      console.log(`[TRACE] Span completed: ${span.spanId}`)
    }
  })
  tracer.attach(orchestrator)

  // 4. Attach execution tree tracker
  const treeTracker = new ExecutionTreeTracker({
    keepHistory: true,
    onTreeUpdate: async (tree) => {
      console.log("\n[TREE] Execution tree updated")
      console.log(treeTracker.exportAsASCII())
    }
  })
  treeTracker.attach(orchestrator)

  // 5. Create and run a saga
  const sagaDefinition = SagaBuilder.start()
    .invoke(async (data, context) => {
      console.log(`\n[TASK] Step 1 executing in saga ${context.sagaId}`)
      return { step: 1, result: "validated" }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Undoing step 1")
    })
    .withName("validateOrder")
    .next()
    .invoke(async (data, context) => {
      console.log(`\n[TASK] Step 2 executing in saga ${context.sagaId}`)
      return { step: 2, result: "charged" }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Refunding payment")
    })
    .withName("chargePayment")
    .next()
    .invoke(async (data, context) => {
      console.log(`\n[TASK] Step 3 executing in saga ${context.sagaId}`)
      return { step: 3, result: "shipped" }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Canceling shipment")
    })
    .withName("shipOrder")
    .end()

  // Create saga
  const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
  
  try {
    const saga = await coordinator.createSaga("order-saga-001", {
      orderId: "ORD-123",
      amount: 99.99
    }) as Saga<{ orderId: string; amount: number }>

    await orchestrator.run(saga, sagaDefinition)

    // Print statistics
    console.log("\n=== Final Statistics ===")
    console.log("\nLogger stats:")
    console.log(`- Total logs: ${logger.getLogs().length}`)
    
    console.log("\nTree stats:")
    console.log(JSON.stringify(treeTracker.getStats(), null, 2))
  } catch (error) {
    console.error("Failed to run saga:", error)
  }
}

// ============================================================================
// Example 2: Real-World Use Case - E-commerce Order Processing
// ============================================================================

export async function ecommerceExample() {
  console.log("\n=== Example 2: E-commerce Order Processing ===\n")

  const orchestrator = new SagaOrchestrator()

  // Setup plugins with production-ready configurations
  const logger = new HierarchicalLogger({
    prettyPrint: true,
    includeEventData: false, // Don't log sensitive data
    logLevels: ['sagaStarted', 'sagaSucceeded', 'sagaFailed', 'taskFailed']
  })
  logger.attach(orchestrator)

  const tracer = new DistributedTracer({
    serviceName: "order-processing",
    sampleRate: 0.1, // Sample 10% in production
    defaultTags: {
      environment: "production",
      version: "1.0.0"
    },
    onSpanComplete: async (span) => {
      // Export to OpenTelemetry
      const otlpSpan = tracer.exportToOpenTelemetry(span)
      // await opentelemetry.export(otlpSpan)
      console.log(`[OTLP] Exported span ${span.spanId}`)
    }
  })
  tracer.attach(orchestrator)

  const treeTracker = new ExecutionTreeTracker({
    keepHistory: false, // Don't keep history in production to save memory
    maxDepth: 5
  })
  treeTracker.attach(orchestrator)

  // Define the order processing saga
  const orderSaga = SagaBuilder.start()
    .invoke(async (order: any, context) => {
      console.log(`\n[ORDER] Validating order ${order.orderId} in saga ${context.sagaId}`)
      // Simulate validation
      await new Promise(resolve => setTimeout(resolve, 100))
      return { validated: true, inventoryReserved: false }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Order validation rollback")
    })
    .withName("validateOrder")
    .next()
    .invoke(async (order: any, context) => {
      console.log(`\n[INVENTORY] Reserving inventory for ${order.orderId}`)
      await new Promise(resolve => setTimeout(resolve, 150))
      return { ...(context.prev as any), inventoryReserved: true }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Releasing inventory")
    })
    .withName("reserveInventory")
    .next()
    .invoke(async (order: any, context) => {
      console.log(`\n[PAYMENT] Charging payment for ${order.orderId}`)
      await new Promise(resolve => setTimeout(resolve, 200))
      return { ...(context.prev as any), paymentCharged: true, paymentId: "PAY-" + Date.now() }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Refunding payment")
    })
    .withName("chargePayment")
    .next()
    .invoke(async (order: any, context) => {
      console.log(`\n[SHIPPING] Creating shipment for ${order.orderId}`)
      await new Promise(resolve => setTimeout(resolve, 100))
      return { ...(context.prev as any), shipmentCreated: true, trackingNumber: "TRACK-" + Date.now() }
    })
    .compensate(async () => {
      console.log("[COMPENSATION] Canceling shipment")
    })
    .withName("createShipment")
    .end()

  // Process an order
  const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
  const orderData = {
    orderId: "ORD-" + Date.now(),
    customerId: "CUST-123",
    items: [
      { sku: "WIDGET-1", quantity: 2, price: 29.99 },
      { sku: "GADGET-5", quantity: 1, price: 49.99 }
    ],
    totalAmount: 109.97
  }

  try {
    const saga = await coordinator.createSaga(
      `order-saga-${orderData.orderId}`,
      orderData
    ) as Saga<typeof orderData>

    await orchestrator.run(saga, orderSaga)

    // Export various formats
    console.log("\n=== Exports ===")
    
    console.log("\n1. Execution Tree (ASCII):")
    console.log(treeTracker.exportAsASCII())
    
    console.log("\n2. Execution Tree (DOT/Graphviz):")
    console.log(treeTracker.exportAsDOT())
    
    console.log("\n3. Recent Logs (JSON):")
    const recentLogs = logger.getLogs().slice(-5)
    console.log(JSON.stringify(recentLogs, null, 2))
  } catch (error) {
    console.error("Failed to run saga:", error)
  }
}

// ============================================================================
// Example 3: Custom Integration - Send to External Services
// ============================================================================

export async function externalIntegrationExample() {
  console.log("\n=== Example 3: External Service Integration ===\n")

  const orchestrator = new SagaOrchestrator()

  // Logger that sends to multiple destinations
  const logger = new HierarchicalLogger({
    onLog: async (entry) => {
      // Send to multiple logging services
      await Promise.all([
        // Send to Elasticsearch
        // elasticsearch.index({ index: 'saga-logs', body: entry }),
        
        // Send to CloudWatch
        // cloudwatch.putLogEvents({ logEvents: [{ message: JSON.stringify(entry) }] }),
        
        // Send to custom webhook
        // fetch('https://api.example.com/logs', { method: 'POST', body: JSON.stringify(entry) })
      ])
    }
  })
  logger.attach(orchestrator)

  // Tracer that integrates with multiple APM services
  const tracer = new DistributedTracer({
    serviceName: "payment-service",
    onSpanComplete: async (span) => {
      // Export to Jaeger
      const jaegerSpan = tracer.exportToJaeger(span)
      // await jaegerClient.report(jaegerSpan)

      // Export to New Relic
      // await newRelic.recordTrace(span)

      // Export to Datadog
      // await datadog.trace(span)
    }
  })
  tracer.attach(orchestrator)

  console.log("Plugins configured to send to external services")
}

// ============================================================================
// Example 4: Debugging and Monitoring Dashboard
// ============================================================================

export function monitoringDashboardExample() {
  console.log("\n=== Example 4: Monitoring Dashboard ===\n")

  const orchestrator = new SagaOrchestrator()
  const treeTracker = new ExecutionTreeTracker()
  const logger = new HierarchicalLogger()

  treeTracker.attach(orchestrator)
  logger.attach(orchestrator)

  // Simulate a monitoring dashboard that queries plugin data
  const dashboard = {
    getCurrentStats: () => ({
      tree: treeTracker.getStats(),
      logCount: logger.getLogs().length
    }),

    getSagaOverview: (sagaId: string) => ({
      node: treeTracker.getNode(sagaId),
      children: treeTracker.getChildren(sagaId),
      logs: logger.getLogsForSaga(sagaId),
      path: treeTracker.getPath(sagaId)
    }),

    exportAll: () => ({
      tree: treeTracker.exportAsJSON(),
      logs: logger.exportLogs()
    })
  }

  console.log("Monitoring dashboard functions:")
  console.log("- dashboard.getCurrentStats()")
  console.log("- dashboard.getSagaOverview(sagaId)")
  console.log("- dashboard.exportAll()")

  return dashboard
}

// ============================================================================
// Run all examples
// ============================================================================

if (require.main === module) {
  (async () => {
    await basicPluginExample()
    await ecommerceExample()
    await externalIntegrationExample()
    monitoringDashboardExample()
  })()
}
