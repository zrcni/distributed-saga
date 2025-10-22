# Adding Hanging Sagas to Express Dashboard Example

## Summary

Added comprehensive hanging sagas demonstration to the Express dashboard example, showcasing how to identify and handle sagas that have been running for more than 24 hours.

## Changes Made

### 1. New Function: `createHangingSagasExample()`

Location: `examples/with-express-dashboard/index.ts`

Created a new function that generates 5 hanging sagas with different scenarios:

```typescript
async function createHangingSagasExample()
```

**Hanging Sagas Created**:
1. `order-hanging-001` - 3 days old, stuck at payment
2. `order-hanging-002` - 2 days old, waiting for inventory
3. `batch-export-001` - 5 days old, long-running export
4. `migration-parent-001` - 4 days old with 3 child sagas (2 stuck)
5. `order-hanging-003` - 26 hours old, just crossed threshold

Total: **5 root hanging sagas + 2 hanging child sagas**

### 2. Timestamp Manipulation Helper

Added helper function to simulate old sagas for demonstration:

```typescript
const setOldTimestamp = (sagaId: string, daysAgo: number) => {
  const log = coordinator.log as any
  if (log.sagas && log.sagas[sagaId]) {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - daysAgo)
    log.sagas[sagaId].createdAt = oldDate
    log.sagas[sagaId].messages[0].timestamp = oldDate
  }
}
```

This manipulates the InMemorySagaLog to set creation dates in the past, allowing us to demonstrate the hanging detection feature without actually waiting 24+ hours.

### 3. Updated Server Start Function

Modified the `start()` function to call the new hanging sagas creation:

```typescript
async function start() {
  try {
    await createExampleSagas()
    await createNestedSagasExample()
    await createHangingSagasExample() // NEW
    // ...
  }
}
```

### 4. Updated Homepage HTML

Enhanced the homepage to include information about hanging sagas:

- Added new section: **"Hanging Sagas (Long-Running) 🆕⚠️"**
- Listed all 5 hanging sagas with descriptions
- Added explanation of the feature and how to access it

### 5. Documentation Updates

#### Updated README.md

Added comprehensive section about hanging sagas:
- Description of each hanging saga
- Use cases for the feature
- Updated "Try These Features" section

#### New Documentation: HANGING_SAGAS.md

Created detailed documentation covering:
- What hanging sagas are
- Description of each example saga
- Technical implementation details
- Use cases and best practices
- How to view and handle hanging sagas
- Dashboard features

## Example Scenarios Demonstrated

### 1. Payment Processing Failure
**Saga**: `order-hanging-001` (3 days old)
- Simulates payment gateway timeout
- Shows saga stuck at first task

### 2. External Service Wait
**Saga**: `order-hanging-002` (2 days old)
- Payment succeeded but inventory service not responding
- Demonstrates partial completion

### 3. Long-Running Batch Job
**Saga**: `batch-export-001` (5 days old)
- Large data export taking longer than expected
- Shows legitimate long-running operations

### 4. Parent-Child Complexity
**Saga**: `migration-parent-001` (4 days old)
- Parent saga with 3 child sagas
- 1 child completed, 2 children stuck
- Parent waiting indefinitely for children
- Demonstrates complex hierarchies

### 5. Recent Threshold Cross
**Saga**: `order-hanging-003` (26 hours old)
- Just crossed the 24-hour threshold
- Shows early detection

## Benefits

### For Users
1. **Real Examples**: See actual hanging sagas in the dashboard
2. **Multiple Scenarios**: Different types of hanging situations
3. **Parent-Child**: Complex workflows with stuck children
4. **Actionable**: Can abort/delete hanging sagas

### For Testing
1. **Immediate Feedback**: No need to wait 24 hours
2. **Various Ages**: From 26 hours to 5 days
3. **Different States**: Stuck at different tasks
4. **Nested Structures**: Parent with hanging children

### For Documentation
1. **Live Demo**: Running examples in the dashboard
2. **Best Practices**: Shows what to look for
3. **Use Cases**: Demonstrates real-world scenarios
4. **Feature Showcase**: Highlights the hanging sagas view

## How to Test

1. **Start the example**:
   ```bash
   cd examples/with-express-dashboard
   npm install
   npm start
   ```

2. **Open dashboard**:
   ```
   http://localhost:3000/admin/sagas
   ```

3. **View hanging sagas**:
   - Click **"Hanging Sagas"** tab in header
   - Should see 7 hanging sagas (5 root + 2 children)

4. **Test features**:
   - View running times
   - Click cards to see details
   - Abort hanging sagas
   - Delete hanging sagas

## Console Output

When the example starts, you'll see:

```
Creating nested sagas example...
✓ Created nested sagas example:
  - 1 parent saga (crawl-example-com)
  - 5 child sagas (page crawlers)
  - 5 nested child sagas (content processors)
  Total: 11 sagas with 3 levels of nesting

Creating hanging sagas example...
✓ Created hanging sagas example:
  - order-hanging-001: 3 days old (stuck at payment)
  - order-hanging-002: 2 days old (stuck waiting for inventory)
  - batch-export-001: 5 days old (long-running export)
  - migration-parent-001: 4 days old (parent with stuck children)
  - order-hanging-003: 26 hours old (just crossed threshold)
  Total: 5 hanging sagas + 3 child migration sagas (2 hanging)

🚀 Server running on http://localhost:3000
📊 Saga Dashboard: http://localhost:3000/admin/sagas

Example sagas have been created for demonstration.
- Regular sagas: order-001, order-002, order-003
- Nested sagas: crawl-example-com (parent) with 5 child sagas + 5 nested children
  Total: 11 sagas demonstrating 3 levels of nesting
- Hanging sagas: 5 root sagas + 2 child sagas (running > 24 hours)
  Check the 'Hanging Sagas' tab in the dashboard!
```

## Files Modified

1. **examples/with-express-dashboard/index.ts**
   - Added `createHangingSagasExample()` function
   - Added `setOldTimestamp()` helper
   - Updated `start()` function
   - Updated homepage HTML

2. **examples/with-express-dashboard/README.md**
   - Added hanging sagas section
   - Updated features list
   - Added use cases

3. **examples/with-express-dashboard/HANGING_SAGAS.md** (NEW)
   - Comprehensive documentation
   - Scenario descriptions
   - Best practices
   - Technical details

## Integration with Dashboard Feature

This example demonstrates the hanging sagas view feature that was added to the dashboard:

- **Dashboard Feature**: Shows all hanging sagas across sources
- **Example Sagas**: Provides test data for the feature
- **Documentation**: Explains how to use and understand the feature

The example makes the dashboard feature immediately usable and testable without needing to set up production scenarios or wait 24 hours.

## Future Enhancements

Potential additions:
1. Configurable hanging threshold (not just 24 hours)
2. More complex nested hanging scenarios
3. Hanging sagas with errors
4. Different source adapters with hanging sagas
5. Recovery scenarios for hanging sagas

## Related Documentation

- [Hanging Sagas View Feature](../../docs/generated/HANGING_SAGAS_VIEW.md)
- [Express Dashboard Example README](./README.md)
- [Hanging Sagas in Example](./HANGING_SAGAS.md)
