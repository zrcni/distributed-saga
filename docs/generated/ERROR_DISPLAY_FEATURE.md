# Error Display Feature

## Overview

Added comprehensive error display functionality to the Saga Dashboard to help users identify and debug issues with saga tasks. Errors are now prominently displayed both in the list view and detail view.

## Changes Made

### 1. Task Error Display in Detail View

**File:** `packages/ui/src/pages/SagaDetailPage.tsx`

#### Error Indicator in Task Header
- Added a warning emoji (⚠️) next to task names that have errors
- Shows on hover with tooltip: "This task has an error"
- Makes it immediately visible which tasks have issues

```tsx
<span className="task-name">
  {task.taskName}
  {task.error && <span className="error-indicator" title="This task has an error">⚠️</span>}
</span>
```

#### Error Details in Expanded Task
- When a task is expanded, errors are shown at the top (before data)
- Displayed in a highlighted yellow box with warning styling
- Error content shown in formatted JSON with proper syntax highlighting

```tsx
{task.error && (
  <div className="task-error">
    <strong>Error:</strong>
    <pre className="error-content">{JSON.stringify(task.error, null, 2)}</pre>
  </div>
)}
```

### 2. Error Badge in List View

**File:** `packages/ui/src/pages/SagasPage.tsx`

#### Error Badge in Saga Stats
- Added an error badge to saga cards when any task has an error
- Badge shows "⚠️ Has Errors" with yellow warning styling
- Tooltip on hover explains what it means
- Helps users quickly identify problematic sagas without drilling down

```tsx
{saga.tasks && saga.tasks.some(task => task.error) && (
  <span className="stat-badge error-badge" title="This saga has tasks with errors">
    ⚠️ Has Errors
  </span>
)}
```

### 3. Error Styling

**File:** `packages/ui/src/pages/SagaDetailPage.css`

#### Error Indicator
```css
.error-indicator {
  margin-left: 8px;
  font-size: 1rem;
  cursor: help;
}
```

#### Task Error Box
```css
.task-error {
  margin-bottom: 15px;
  padding: 12px;
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 6px;
}

.task-error strong {
  display: block;
  margin-bottom: 8px;
  color: #856404;
  font-weight: 600;
}

.task-error .error-content {
  background: #fff;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0;
  font-size: 0.9rem;
  border: 1px solid #ffc107;
  color: #721c24;
  white-space: pre-wrap;
  word-break: break-word;
}
```

**File:** `packages/ui/src/pages/SagasPage.css`

#### Error Badge Styling
```css
.stat-badge.error-badge {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffc107;
  cursor: help;
}
```

## Visual Design

### Color Scheme
- **Yellow/Amber Warning Colors**: Used for error indicators to match standard warning conventions
- **Background**: `#fff3cd` (light yellow)
- **Border**: `#ffc107` (amber)
- **Text**: `#856404` (dark amber) for labels, `#721c24` (dark red) for error content

### Typography
- Error content displayed in monospace font
- Proper JSON formatting with indentation
- Word wrapping to prevent horizontal scrolling
- Adequate padding for readability

### Layout
- Errors appear at the top of expanded task details (before data)
- Clear visual hierarchy with bold labels
- Consistent spacing with other task detail elements

## User Experience

### Discovery Flow

1. **List View (Root Sagas)**
   - User sees saga cards with status badges
   - If any task has an error, an "⚠️ Has Errors" badge appears
   - User can hover to see tooltip explaining the badge
   - Click the saga card to view details

2. **Detail View (Individual Saga)**
   - Tasks with errors show a warning icon (⚠️) next to their name
   - User can hover over the icon for a tooltip
   - Click/expand the task to see full error details
   - Error appears in a prominent yellow box with formatted JSON

3. **Error Details**
   - Error shown in readable, formatted JSON
   - Scrollable if the error message is long
   - Easy to copy for debugging or reporting

## Error Data Structure

The error field can contain any JavaScript value:

### String Error
```json
{
  "error": "Connection timeout after 30 seconds"
}
```

### Error Object
```json
{
  "error": {
    "name": "ValidationError",
    "message": "Invalid email format",
    "code": "INVALID_EMAIL"
  }
}
```

### Stack Trace
```json
{
  "error": {
    "message": "Failed to process payment",
    "stack": "Error: Failed to process payment\n    at processPayment (payment.js:42:15)\n    at async Task.execute (saga.js:128:20)"
  }
}
```

### Complex Error Data
```json
{
  "error": {
    "type": "DatabaseError",
    "message": "Query failed",
    "details": {
      "query": "SELECT * FROM users WHERE id = ?",
      "params": [123],
      "sqlState": "42S02",
      "errno": 1146
    }
  }
}
```

## Benefits

### For Developers
1. **Quick Error Identification**: See at a glance which sagas have issues
2. **Detailed Debugging Info**: Full error details available without digging through logs
3. **Context Preservation**: Errors shown alongside task data and status
4. **Easy Navigation**: Jump directly from list to problematic saga

### For Operations
1. **Monitoring**: Quickly scan for sagas with errors
2. **Triage**: Prioritize which sagas need attention
3. **Investigation**: Access error details directly in the UI
4. **Reporting**: Easy to copy error information for tickets

### For System Reliability
1. **Visibility**: Errors no longer hidden in logs
2. **Accountability**: Clear indication when tasks fail
3. **Transparency**: All error information accessible in one place

## Implementation Notes

### Type Safety
The error field is already properly typed in the `SagaInfo` interface:

```typescript
tasks?: Array<{
  taskName: string;
  status: string;
  data?: any;
  error?: any;  // ✓ Already present
  childSagas?: SagaInfo[];
}>;
```

### Backward Compatibility
- No breaking changes to API or data structures
- Errors are optional; tasks without errors display normally
- Works with all existing saga implementations

### Performance
- Error checking is done in-memory on already-loaded data
- No additional API calls required
- Minimal performance impact (simple `.some()` check)

## Future Enhancements

Potential improvements for future versions:

1. **Error Filtering**: Add filter to show only sagas with errors
2. **Error Statistics**: Count and display total errors in header
3. **Error History**: Show error timeline for recurring issues
4. **Error Severity Levels**: Different colors for warnings vs critical errors
5. **Error Actions**: Quick actions like "Retry" or "Report Bug"
6. **Error Export**: Export error details to file or clipboard
7. **Error Notifications**: Alert when new errors occur (with WebSocket)
8. **Error Correlation**: Link related errors across multiple sagas

## Testing Recommendations

To test the error display feature:

1. **Create a saga with a task that throws an error**
2. **Verify error badge appears in list view**
3. **Click saga to view details**
4. **Verify error indicator (⚠️) appears next to task name**
5. **Expand the task**
6. **Verify error details are displayed in yellow box**
7. **Test with different error types** (string, object, complex)
8. **Verify word wrapping** with long error messages
9. **Test with multiple tasks** having errors
10. **Verify tooltips** on hover

## Example Saga with Error

Here's how a saga with an error would look in the system:

```javascript
// Saga with failed task
const saga = {
  sagaId: 'order-123',
  status: 'active',
  tasks: [
    {
      taskName: 'ValidateOrder',
      status: 'completed',
      data: { orderId: '123', valid: true }
    },
    {
      taskName: 'ProcessPayment',
      status: 'compensating',
      data: { amount: 99.99, currency: 'USD' },
      error: {
        type: 'PaymentError',
        message: 'Card declined',
        code: 'INSUFFICIENT_FUNDS',
        details: {
          cardLast4: '1234',
          attemptedAmount: 99.99,
          availableBalance: 50.00
        }
      }
    },
    {
      taskName: 'ShipOrder',
      status: 'not_started'
    }
  ]
};
```

### In the UI:
- List view shows: "⚠️ Has Errors" badge on the saga card
- Detail view shows: "⚠️" icon next to "ProcessPayment" task
- Expanded task shows: Yellow error box with formatted JSON of the payment error

## Summary

This feature significantly improves the debugging experience by making errors visible and accessible throughout the dashboard UI. Users can now quickly identify problematic sagas, view detailed error information, and take appropriate action without needing to dig through application logs or database queries.

The implementation is clean, performant, and follows established UI patterns for error display. The visual design uses standard warning colors and clear typography to ensure errors are noticed without being alarming.
