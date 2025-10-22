/**
 * Saga Context Example
 * 
 * This example demonstrates how to use saga-level shared context to share data
 * across multiple tasks in a saga. The context is useful for:
 * - Accumulating results from multiple tasks
 * - Tracking progress or state across tasks
 * - Passing data between tasks without coupling them
 * - Storing metadata that pertains to the entire saga
 */

import { SagaBuilder, InMemorySagaLog, SagaOrchestrator, Saga } from "../src"

// Example: Order Processing Saga
// This saga processes an order by validating inventory, processing payment,
// and shipping. The context tracks order details and accumulates results.

interface OrderPayload {
  orderId: string
  items: Array<{ productId: string; quantity: number; price: number }>
  customerId: string
  paymentMethod: string
}

interface OrderContext {
  totalAmount?: number
  inventoryReserved?: boolean
  paymentId?: string
  shippingId?: string
  processedAt?: Date
}

export function createOrderProcessingSaga() {
  return SagaBuilder.start()
    .invoke(async (data: OrderPayload, _prevResult, _middleware, _sagaContext, _saga, ctx) => {
      console.log("Validating inventory for order:", data.orderId)
      
      // Calculate total amount
      const totalAmount = data.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      )
      
      // Store in saga context for later tasks
      await ctx.update({
        totalAmount,
        inventoryReserved: true,
        processedAt: new Date(),
      })
      
      console.log(`Total amount: $${totalAmount}`)
      return { validated: true, totalAmount }
    })
    .compensate(async (_data: OrderPayload, _taskData, _middleware, _saga, ctx) => {
      console.log("Releasing inventory reservation")
      await ctx.update({ inventoryReserved: false })
    })
    .withName("validateInventory")
    .next()
    .invoke(async (data: OrderPayload, _prevResult, _middleware, _sagaContext, _saga, ctx) => {
      // Read context to get total amount calculated by previous task
      const context = await ctx.get<OrderContext>()
      const totalAmount = context.totalAmount || 0
      
      console.log(`Processing payment of $${totalAmount} for order: ${data.orderId}`)
      
      // Simulate payment processing
      const paymentId = `PAY-${Date.now()}`
      
      // Update context with payment ID for later reference
      await ctx.update({ paymentId })
      
      return { paymentId, amount: totalAmount }
    })
    .compensate(async (_data: OrderPayload, _taskData, _middleware, _saga, ctx) => {
      const context = await ctx.get<OrderContext>()
      console.log(`Refunding payment: ${context.paymentId}`)
      await ctx.update({ paymentId: undefined })
    })
    .withName("processPayment")
    .next()
    .invoke(async (data: OrderPayload, _prevResult, _middleware, _sagaContext, _saga, ctx) => {
      // Read all accumulated context from previous tasks
      const context = await ctx.get<OrderContext>()
      
      console.log(`Arranging shipping for order: ${data.orderId}`)
      console.log(`  Payment ID: ${context.paymentId}`)
      console.log(`  Total Amount: $${context.totalAmount}`)
      
      // Simulate shipping arrangement
      const shippingId = `SHIP-${Date.now()}`
      
      // Update context with shipping ID
      await ctx.update({ shippingId })
      
      return { shippingId, estimatedDelivery: "3-5 business days" }
    })
    .compensate(async (_data: OrderPayload, _taskData, _middleware, _saga, ctx) => {
      const context = await ctx.get<OrderContext>()
      console.log(`Canceling shipping: ${context.shippingId}`)
      await ctx.update({ shippingId: undefined })
    })
    .withName("arrangeShipping")
    .next()
    .invoke(async (data: OrderPayload, _prevResult, _middleware, _sagaContext, _saga, ctx) => {
      // Read all accumulated context for final confirmation
      const context = await ctx.get<OrderContext>()
      
      console.log("Sending order confirmation:")
      console.log(`  Order ID: ${data.orderId}`)
      console.log(`  Customer ID: ${data.customerId}`)
      console.log(`  Total Amount: $${context.totalAmount}`)
      console.log(`  Payment ID: ${context.paymentId}`)
      console.log(`  Shipping ID: ${context.shippingId}`)
      console.log(`  Processed At: ${context.processedAt}`)
      
      return { confirmed: true }
    })
    .withName("sendConfirmation")
    .end()
}

// Run example
async function runExample() {
  // Create saga coordinator
  const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
  const orchestrator = new SagaOrchestrator()

  console.log("=".repeat(60))
  console.log("Order Processing Saga with Shared Context")
  console.log("=".repeat(60))
  console.log()

  // Create saga definition
  const orderSagaDefinition = createOrderProcessingSaga()

  // Create a saga instance
  const sagaId = "order-12345"
  const orderData: OrderPayload = {
    orderId: "ORD-12345",
    items: [
      { productId: "PROD-1", quantity: 2, price: 29.99 },
      { productId: "PROD-2", quantity: 1, price: 49.99 },
    ],
    customerId: "CUST-789",
    paymentMethod: "credit_card",
  }

  const createResult = await coordinator.createSaga(sagaId, orderData)

  if (createResult.isError()) {
    console.error("Failed to create saga:", createResult.data)
    return
  }

  const saga = createResult.data as Saga<OrderPayload>

  // Execute the saga
  try {
    await orchestrator.run(saga, orderSagaDefinition)
    console.log()
    console.log("=".repeat(60))
    console.log("✓ Saga completed successfully!")
    console.log("=".repeat(60))
    
    // Show final saga context
    const finalContext = await saga.getSagaContext<OrderContext>()
    console.log("\nFinal Saga Context:")
    console.log(JSON.stringify(finalContext, null, 2))
  } catch (error) {
    console.error("Saga execution failed:", error)
  }
}

// Run if executed directly
if (require.main === module) {
  runExample().catch(console.error)
}
