# Saga Context Feature

## Overview

The Saga Context feature provides a way to store and share data across all tasks within a saga. This is useful for:

- **Accumulating results** from multiple tasks
- **Tracking progress** or state across tasks
- **Passing data between tasks** without tight coupling
- **Storing metadata** that pertains to the entire saga lifecycle

## How It Works

Each saga has a `sagaContext` property that stores arbitrary key-value pairs. Tasks can read and update this context through a `WritableSagaContext` interface passed as the last parameter to task callbacks.

### Key Features

- **Persistent**: Context data is persisted with the saga state
- **Shared**: All tasks in a saga can read and write the context
- **Type-safe**: TypeScript generic support for typed context access
- **Async**: Read and write operations are async to support persistence
- **Merging**: Updates are merged with existing context (not replaced)

## API Reference

### WritableSagaContext Interface

```typescript
interface WritableSagaContext {
  /**
   * Get the current saga context
   */
  get<T = Record<string, any>>(): Promise<T>
  
  /**
   * Update saga context with new values (merges with existing context)
   */
  update(updates: Record<string, any>): Promise<void>
}
```

### Task Callback Signature

Task callbacks (invoke, compensate, middleware) now receive `ctx` as their last parameter:

```typescript
.invoke(async (
  data,                    // Saga payload data
  prevResult,              // Previous task result
  middlewareData,          // Accumulated middleware data
  sagaContext,             // Read-only saga metadata (sagaId, parentSagaId, etc.)
  saga,                    // Read-only saga instance
  ctx                      // Writable saga context
) => {
  // Use ctx to read and update shared context
  const context = await ctx.get()
  await ctx.update({ key: 'value' })
  
  return { result: 'data' }
})
```

## Usage Examples

### Example 1: Accumulating Data Across Tasks

```typescript
interface OrderContext {
  totalAmount?: number
  paymentId?: string
  shippingId?: string
}

const orderSaga = SagaBuilder.start()
  .invoke(async (data: OrderPayload, _, __, ___, ____, ctx) => {
    // First task calculates and stores total
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    
    await ctx.update({ totalAmount })
    return { validated: true }
  })
  .withName("validateOrder")
  .next()
  .invoke(async (data: OrderPayload, _, __, ___, ____, ctx) => {
    // Second task reads total from context
    const context = await ctx.get<OrderContext>()
    const paymentId = await processPayment(context.totalAmount!)
    
    // Store payment ID for later tasks
    await ctx.update({ paymentId })
    return { paymentId }
  })
  .withName("processPayment")
  .next()
  .invoke(async (data: OrderPayload, _, __, ___, ____, ctx) => {
    // Third task reads both total and payment ID
    const context = await ctx.get<OrderContext>()
    const shippingId = await arrangeShipping({
      orderId: data.orderId,
      amount: context.totalAmount!,
      paymentId: context.paymentId!,
    })
    
    await ctx.update({ shippingId })
    return { shippingId }
  })
  .withName("arrangeShipping")
  .end()
```

### Example 2: Progress Tracking

```typescript
interface OnboardingContext {
  completedSteps?: string[]
  progress?: number
  accountId?: string
}

const onboardingSaga = SagaBuilder.start()
  .invoke(async (data: UserPayload, _, __, ___, ____, ctx) => {
    const accountId = await createAccount(data)
    
    await ctx.update({
      completedSteps: ["createAccount"],
      progress: 33,
      accountId,
    })
    
    return { accountId }
  })
  .withName("createAccount")
  .next()
  .invoke(async (data: UserPayload, _, __, ___, ____, ctx) => {
    const context = await ctx.get<OnboardingContext>()
    await createProfile(context.accountId!)
    
    await ctx.update({
      completedSteps: [...(context.completedSteps || []), "createProfile"],
      progress: 66,
    })
    
    return { profileCreated: true }
  })
  .withName("createProfile")
  .next()
  .invoke(async (data: UserPayload, _, __, ___, ____, ctx) => {
    const context = await ctx.get<OnboardingContext>()
    await sendWelcomeEmail(data.email)
    
    await ctx.update({
      completedSteps: [...(context.completedSteps || []), "sendWelcomeEmail"],
      progress: 100,
    })
    
    console.log(`Onboarding complete! Steps: ${context.completedSteps?.join(", ")}`)
    return { completed: true }
  })
  .withName("sendWelcomeEmail")
  .end()
```

### Example 3: Using Context in Compensation

```typescript
const orderSaga = SagaBuilder.start()
  .invoke(async (data: OrderPayload, _, __, ___, ____, ctx) => {
    const paymentId = await processPayment(data)
    await ctx.update({ paymentId })
    return { paymentId }
  })
  .compensate(async (data: OrderPayload, taskData, __, ___, ctx) => {
    // Compensation can read context to get payment ID
    const context = await ctx.get<{ paymentId?: string }>()
    
    if (context.paymentId) {
      await refundPayment(context.paymentId)
      await ctx.update({ paymentId: undefined })
    }
  })
  .withName("processPayment")
  .end()
```

## Implementation Details

### State Storage

Context data is stored in `SagaState.sagaContext` as a `Record<string, any>`:

```typescript
class SagaState {
  sagaContext: Record<string, any>
  
  getSagaContext<T = Record<string, any>>(): T {
    return this.sagaContext as T
  }
  
  updateSagaContext(updates: Record<string, any>): void {
    this.sagaContext = { ...this.sagaContext, ...updates }
  }
}
```

### Message Handling

Context updates are sent as `UpdateSagaContext` messages:

```typescript
enum SagaMessageType {
  UpdateSagaContext = "UpdateSagaContext",
  // ... other message types
}

function createUpdateSagaContextMessage(
  sagaId: string,
  updates: Record<string, any>
): SagaMessage {
  return {
    type: SagaMessageType.UpdateSagaContext,
    sagaId,
    timestamp: Date.now(),
    payload: updates,
  }
}
```

### Validation

Context updates are validated to prevent modification after saga completion:

```typescript
// In saga-state-update.ts
if (message.type === SagaMessageType.UpdateSagaContext) {
  if (state.status === "completed" || state.status === "aborted") {
    return Result.err(
      new Error(`Cannot update saga context: saga is ${state.status}`)
    )
  }
  
  state.updateSagaContext(message.payload as Record<string, any>)
  return Result.ok(state)
}
```

### ReadOnlySaga Interface

The `ReadOnlySaga` interface provides read-only access to context:

```typescript
interface ReadOnlySaga {
  // ... other methods
  getSagaContext<T = Record<string, any>>(): Promise<T>
}
```

## Best Practices

### 1. Define Context Types

Always define TypeScript interfaces for your context to get type safety:

```typescript
interface MyContext {
  step1Result?: string
  step2Result?: number
  metadata?: { startTime: Date }
}

// Use typed access
const context = await ctx.get<MyContext>()
```

### 2. Initialize Context Early

Consider initializing context in the first task:

```typescript
.invoke(async (data, _, __, ___, ____, ctx) => {
  await ctx.update({
    startTime: new Date(),
    progress: 0,
    results: [],
  })
  // ... task logic
})
```

### 3. Handle Undefined Values

Context values are optional, so handle undefined cases:

```typescript
const context = await ctx.get<MyContext>()
const total = context.totalAmount || 0  // Provide default
```

### 4. Use Context for Cross-Cutting Concerns

Context is ideal for tracking cross-cutting concerns:

- Progress tracking
- Timing/performance metrics
- Accumulated results
- Shared IDs and references

### 5. Keep Context Focused

Don't use context as a dumping ground. Only store data that:
- Multiple tasks need to access
- Represents saga-level state (not task-specific)
- Needs to persist with the saga

## Migration Guide

Existing saga definitions need to update their callback signatures to include the `ctx` parameter:

### Before
```typescript
.invoke(async (data, prevResult, middleware, sagaContext, saga) => {
  // Old signature without ctx
})
```

### After
```typescript
.invoke(async (data, prevResult, middleware, sagaContext, saga, ctx) => {
  // New signature with ctx parameter
  const context = await ctx.get()
  await ctx.update({ key: 'value' })
})
```

If you don't need context in a particular task, you can ignore the parameter:

```typescript
.invoke(async (data, prevResult, middleware, sagaContext, saga, _ctx) => {
  // Underscore prefix indicates unused parameter
})
```

## See Also

- [Saga Context Example](../../examples/saga-context-example.ts) - Complete working example
- [API Documentation](../../README.md) - Main documentation
- [Testing Guide](./TESTING.md) - How to test sagas with context
