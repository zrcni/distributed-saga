# Failed Saga Visualization

## Overview

The dashboard now clearly distinguishes between successfully completed sagas and failed (aborted) sagas, making it easy to identify and troubleshoot saga failures.

## Changes Made

### Status Display

The saga status is now displayed with more user-friendly terminology:
- `'active'` → **ACTIVE** (blue badge)
- `'completed'` → **COMPLETED** (green badge)
- `'aborted'` → **FAILED** (red badge)

The term "FAILED" is used instead of "ABORTED" to make it immediately clear to users that something went wrong with the saga execution.

### Visual Distinction

Failed sagas are visually distinct in the sagas list:
- **Red left border** (4px solid) on the saga card
- **Subtle red background gradient** for immediate recognition
- **Red hover effect** when hovering over the card
- **Red badge** with "FAILED" text

### Separate Filtering

The sagas list page now provides separate filters for different saga states:

#### Filter Controls
- **Hide completed** - Hides successfully completed sagas
- **Hide failed** - Hides failed/aborted sagas

Both filters can be toggled independently, allowing users to:
- View only active sagas (hide both completed and failed)
- View only problematic sagas (hide completed, show failed)
- View all sagas (show everything)

#### Status Summary

The header displays a comprehensive count breakdown:
```
5 root sagas
• 2 active
• 2 completed
• 1 failed
```

Each count is color-coded to match the corresponding status badge:
- **Active** - Blue
- **Completed** - Green
- **Failed** - Red

## How Saga Failures Occur

Sagas enter the "failed" (aborted) state when:

1. **Task execution throws an error** - Any unhandled exception in a task's `invoke` callback
2. **Manual abortion** - User clicks "Abort" button on an active saga
3. **Compensation failure** - Error during the compensation phase

When a saga fails, the system automatically:
- Sets `sagaAborted = true` in the saga state
- Triggers the compensation flow to rollback completed tasks
- Emits `sagaFailed` event for logging/monitoring

## UI Components Updated

### SagasPage
**File**: `packages/ui/src/pages/SagasPage.tsx`

Changes:
- Added `hideAbortedSagas` state for separate filtering
- Updated filter logic to handle completed and aborted separately
- Added counts for active, completed, and aborted sagas
- Changed status badge text from "ABORTED" to "FAILED"
- New header layout with status summary and separate toggle controls

### SagasPage CSS
**File**: `packages/ui/src/pages/SagasPage.css`

Changes:
- Added `.view-controls` flex container for better layout
- Added `.saga-count-summary` with status counts
- Added `.status-count` badges with color-coded backgrounds
- Added special styling for failed saga cards (left border and gradient)
- Added hover effect for failed sagas

### SagaDetailPage
**File**: `packages/ui/src/pages/SagaDetailPage.tsx`

Changes:
- Updated main saga status display to show "FAILED" instead of "ABORTED"
- Updated child saga status badges to show "FAILED" instead of "aborted"
- Applied consistent status labeling across all views

## Backend Status Flow

The status is determined in the API layer:

**File**: `packages/api/src/SagaAdapter.ts`

```typescript
const status: 'active' | 'completed' | 'aborted' = 
  sagaCompleted ? 'completed' : 
  sagaAborted ? 'aborted' : 
  'active';
```

The status values remain unchanged in the API:
- `'active'` - Saga is currently running
- `'completed'` - Saga finished successfully
- `'aborted'` - Saga was aborted (either due to error or manual intervention)

Only the UI presentation changes from "ABORTED" to "FAILED" for better user understanding.

## Usage Examples

### Scenario 1: Finding Failed Sagas
1. Navigate to a source's saga list
2. Check the status summary in the header
3. If there are failed sagas, they'll show with a red count badge
4. Failed saga cards have a red left border making them easy to spot
5. Click on a failed saga to view its details and error information

### Scenario 2: Hiding Noise
If you have many completed sagas but want to focus on active work and failures:
1. Check "Hide completed" ✓
2. Leave "Hide failed" unchecked ☐
3. The list now shows only active and failed sagas

### Scenario 3: Monitoring Production
For production monitoring where you only care about failures:
1. Check "Hide completed" ✓
2. Check "Hide failed" ☐ (or uncheck to see failures)
3. Use the status counts as a dashboard metric

## Best Practices

### 1. Regular Monitoring
Check the failed saga count regularly in production environments. A sudden increase in failures may indicate:
- Service dependency issues
- Bad deployment
- Data validation problems
- Infrastructure issues

### 2. Investigation Workflow
When you see a failed saga:
1. Click on the saga to view details
2. Check which task failed (marked with error indicator)
3. Review the error message in task details
4. Check if compensation completed successfully
5. Determine if manual intervention is needed

### 3. Cleanup Strategy
Failed sagas should be:
- Investigated to understand root cause
- Kept temporarily for debugging (use SagaCleanupService retention)
- Archived after investigation
- Used to improve error handling in saga definitions

## Migration Notes

This is a **UI-only change** - no backend modifications required:
- API continues to use `'aborted'` status value
- Database schema unchanged
- Existing sagas will display correctly
- No migration scripts needed

The change is purely presentational to improve user experience and make failures more obvious.

## See Also

- [Saga Cleanup and Archival](./SAGA_CLEANUP_AND_ARCHIVAL.md) - Automatic cleanup of old sagas
- [Hanging Sagas View](./HANGING_SAGAS_VIEW.md) - Monitoring long-running sagas
- [Dashboard Summary](./SAGA_BOARD_SUMMARY.md) - Overview of dashboard features
