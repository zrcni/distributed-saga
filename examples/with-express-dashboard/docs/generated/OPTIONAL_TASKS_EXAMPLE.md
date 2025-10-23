# Optional Tasks in Express Dashboard Example

This document describes the optional tasks feature as demonstrated in the with-express-dashboard example.

## Overview

The with-express-dashboard example now includes demonstrations of optional tasks in two scenarios:

1. **Regular order processing saga** (order-004)
2. **Nested web crawler saga** (pages 1, 2, 5 with content processors)

## Features Demonstrated

### 1. Order Processing with Optional Tasks

**Saga ID**: `order-004`

This saga demonstrates optional tasks in a typical e-commerce order flow:

```typescript
// Required tasks
await saga4.startTask("processPayment")
await saga4.endTask("processPayment", { paymentId: "pay_321" })

await saga4.startTask("reserveInventory")
await saga4.endTask("reserveInventory", { reservationId: "res_321" })

// Optional task: SMS notification
await saga4.startTask("sendSMSNotification", {}, { isOptional: true })
await saga4.endTask("sendSMSNotification", null) // null = failed gracefully

// Optional task: Loyalty points
await saga4.startTask("updateLoyaltyPoints", {}, { isOptional: true })
await saga4.endTask("updateLoyaltyPoints", { pointsAdded: 10 })

// Required task
await saga4.startTask("sendEmail")
await saga4.endTask("sendEmail", { emailSent: true })
```

**Tasks**:
- ✅ **processPayment** (required) - Critical for order completion
- ✅ **reserveInventory** (required) - Must succeed for order
- ⭕ **sendSMSNotification** (optional) - Nice-to-have notification, failed but saga continued
- ⭕ **updateLoyaltyPoints** (optional) - Supplementary feature, succeeded
- ✅ **sendEmail** (required) - Final confirmation

**Key Points**:
- Optional tasks are marked with `{ isOptional: true }` metadata
- Failed optional tasks return `null` as end task data
- The saga completes successfully even if optional tasks fail
- Optional tasks are shown with ⭕ indicator in the dashboard

### 2. Web Crawler with Optional Tasks

**Saga ID**: `crawl-example-com` (parent) with child sagas

The nested web crawler example demonstrates optional tasks at multiple levels:

#### Page Crawling (Child Sagas)

Each page crawler includes:
- ✅ **fetchContent** (required)
- ✅ **parseContent** (required)
- ✅ **processContent** (required) - triggers nested saga
- ✅ **saveToDatabase** (required)
- ⭕ **updateSearchIndex** (optional) - Can be done asynchronously later

#### Content Processing (Nested Child Sagas)

Each content processor includes:
- ✅ **generateSummary** (required)
- ✅ **generateEmbeddings** (required)
- ⭕ **generateImageAltText** (optional) - AI feature that may not always be available

**Example**:
```typescript
// In nested content processing saga
await processSaga.startTask("generateImageAltText", {}, { isOptional: true })
await processSaga.endTask("generateImageAltText", { altTextsGenerated: 3 })

// In page crawler saga
await child.startTask("updateSearchIndex", {}, { isOptional: true })
await child.endTask("updateSearchIndex", null) // Simulating failure
```

## Use Cases

### When to Use Optional Tasks

1. **Non-Critical Notifications**
   - SMS alerts that shouldn't block order processing
   - Push notifications that can be retried later
   - Email confirmations when order is already processed

2. **Supplementary Features**
   - Loyalty point updates
   - Analytics tracking
   - Recommendation system updates

3. **AI/ML Features**
   - Image alt text generation
   - Content recommendations
   - Sentiment analysis

4. **Async Operations**
   - Search index updates (can be done in background)
   - Cache warming
   - Metrics collection

### Benefits

- **Resilience**: Sagas don't fail due to temporary service outages
- **Flexibility**: Add nice-to-have features without increasing risk
- **Monitoring**: Track optional task failures separately
- **User Experience**: Core functionality works even when supplementary features fail

## Dashboard Visualization

In the Saga Board dashboard, optional tasks are displayed with:
- ⭕ indicator next to the task name
- Tooltip explaining "This task is optional"
- Different visual treatment to distinguish from required tasks
- Null result displayed for failed optional tasks

## Running the Example

```bash
cd examples/with-express-dashboard
npm install
npm run dev
```

Visit `http://localhost:3000/admin/sagas` and look for:
- **order-004** saga in the regular sagas list
- **crawl-example-com** saga and its children in the nested sagas section

Click on individual sagas to see:
- Optional tasks marked with ⭕
- Task execution timeline
- Success/failure status of optional vs required tasks

## Summary

The with-express-dashboard example demonstrates:
- ✅ Creating sagas with optional tasks using metadata
- ✅ Optional tasks in simple order flows
- ✅ Optional tasks in nested saga hierarchies
- ✅ Dashboard visualization of optional tasks
- ✅ Graceful handling of optional task failures

Optional tasks make sagas more resilient by allowing non-critical operations to fail without affecting the core business workflow.
