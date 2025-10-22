# Failed Saga Visualization - Implementation Summary

## Problem Statement

The dashboard was treating successfully completed sagas and failed (aborted) sagas the same way:
- Both were hidden when "Hide completed sagas" was checked
- No visual distinction between success and failure
- "ABORTED" status label was confusing (could mean manual abort or failure)
- No easy way to identify problematic sagas at a glance

## Solution

Implemented comprehensive failed saga visualization with:
1. Separate filtering for completed vs failed sagas
2. Clear visual distinction with red borders and background
3. User-friendly "FAILED" label instead of "ABORTED"
4. Detailed status counts in the header

## Changes Overview

### Files Modified

#### UI Components
1. **packages/ui/src/pages/SagasPage.tsx**
   - Added `hideAbortedSagas` state variable
   - Updated filter logic to handle completed and aborted separately
   - Added counts for active, completed, and aborted sagas
   - Changed status badge display: "ABORTED" → "FAILED"
   - Restructured header with status summary

2. **packages/ui/src/pages/SagasPage.css**
   - New `.view-controls` container for better layout
   - New `.saga-count-summary` with color-coded status counts
   - Special styling for failed saga cards (red left border + gradient)
   - Enhanced hover effects for failed sagas

3. **packages/ui/src/pages/SagaDetailPage.tsx**
   - Updated status display to show "FAILED" instead of "ABORTED"
   - Applied to main saga status and child saga statuses

### Before & After

#### Before
```tsx
// Single toggle controlled everything
const [hideCompletedSagas, setHideCompletedSagas] = useState(true);

// Both completed and aborted were hidden together
let displayedSagas = hideCompletedSagas 
  ? sagas.filter(saga => saga.status !== 'completed')
  : sagas;

// Simple count
const completedSagasCount = sagas.filter(saga => saga.status === 'completed').length;

// Confusing label
<div className={`saga-status-badge status-${saga.status}`}>
  {saga.status.toUpperCase()} {/* Shows "ABORTED" */}
</div>
```

#### After
```tsx
// Separate toggles for completed and failed
const [hideCompletedSagas, setHideCompletedSagas] = useState(true);
const [hideAbortedSagas, setHideAbortedSagas] = useState(false);

// Independent filtering
let displayedSagas = sagas;
if (hideCompletedSagas) {
  displayedSagas = displayedSagas.filter(saga => saga.status !== 'completed');
}
if (hideAbortedSagas) {
  displayedSagas = displayedSagas.filter(saga => saga.status !== 'aborted');
}

// Detailed counts
const completedSagasCount = sagas.filter(saga => saga.status === 'completed').length;
const abortedSagasCount = sagas.filter(saga => saga.status === 'aborted').length;
const activeSagasCount = sagas.filter(saga => saga.status === 'active').length;

// Clear label
<div className={`saga-status-badge status-${saga.status}`}>
  {saga.status === 'aborted' ? 'FAILED' : saga.status.toUpperCase()}
</div>
```

### Visual Changes

#### Header Layout
```
Before:
┌─────────────────────────────────────────────────┐
│ Root Sagas in source-name                       │
│ Click on a saga...                              │
│                                                 │
│ [✓] Hide completed sagas   5 root sagas • 2... │
└─────────────────────────────────────────────────┘

After:
┌─────────────────────────────────────────────────┐
│ Root Sagas in source-name                       │
│ Click on a saga...                              │
│                                                 │
│ ┌─────────────────────┐                        │
│ │ 5 root sagas        │                        │
│ │ • 2 active          │  [✓] Hide completed    │
│ │ • 2 completed       │  [ ] Hide failed       │
│ │ • 1 failed          │                        │
│ └─────────────────────┘                        │
└─────────────────────────────────────────────────┘
```

#### Saga Card Appearance
```
Before (aborted saga):
┌─────────────────────────────────┐
│ ID: saga-123     [ABORTED]      │ ← Generic gray border
│ ─────────────────────────────── │
│ • 3 tasks                        │
│ Created: 2025-10-22 10:00       │
│ [Abort] [Delete]                │
└─────────────────────────────────┘

After (failed saga):
┃┌────────────────────────────────┐
┃│ ID: saga-123     [FAILED]     │ ← Red left border + gradient
┃│ ──────────────────────────────│
┃│ • 3 tasks                      │
┃│ Created: 2025-10-22 10:00     │
┃│ [Abort] [Delete]              │
┃└────────────────────────────────┘
 └─ Red accent border (4px)
```

## Key Features

### 1. Independent Filtering
Users can now:
- Hide only completed sagas (default behavior)
- Hide only failed sagas
- Hide both completed and failed (show only active)
- Show everything

### 2. Status Counts
The header now displays:
- Total saga count
- Active saga count (blue)
- Completed saga count (green)
- Failed saga count (red)

### 3. Visual Emphasis
Failed sagas stand out with:
- 4px solid red left border
- Subtle red-to-white gradient background
- Red badge with "FAILED" text
- Red hover effect

### 4. Consistent Terminology
Changed from "ABORTED" to "FAILED" throughout:
- Main saga status badge
- Child saga status badges
- Status counts in header

## Testing

### Build Verification
```bash
cd packages/ui && npm run build
✓ 47 modules transformed
✓ built in 1.40s
```

### Test Scenarios

1. **Active Sagas Only**
   - Hide completed: ✓
   - Hide failed: ✓
   - Result: Shows only active sagas

2. **Show Failures Only**
   - Hide completed: ✓
   - Hide failed: ☐
   - Result: Shows active and failed sagas

3. **Show Everything**
   - Hide completed: ☐
   - Hide failed: ☐
   - Result: Shows all sagas

4. **Visual Distinction**
   - Failed sagas have red left border
   - Failed sagas have red gradient background
   - Status badge shows "FAILED" in red

## User Benefits

### For Operations Teams
- **Quick identification** of problematic sagas
- **Separate tracking** of failures vs completions
- **Visual scanning** - red borders catch the eye immediately
- **Flexible filtering** based on monitoring needs

### For Developers
- **Clear terminology** - "FAILED" is more intuitive than "ABORTED"
- **Better debugging** - failed sagas are easy to find
- **Metrics visibility** - status counts provide instant insight
- **Consistent UX** - same terminology across all pages

## No Breaking Changes

This is a **UI-only update**:
- ✅ API unchanged (still uses `'aborted'` status)
- ✅ Database schema unchanged
- ✅ Backend logic unchanged
- ✅ Existing sagas display correctly
- ✅ No migration required

## Future Enhancements

Potential improvements:
1. **Failure reasons** - Show why saga failed (error type, failed task)
2. **Retry capability** - Button to retry failed sagas
3. **Failure trends** - Graph showing failure rate over time
4. **Alert integration** - Webhook notifications for failures
5. **Bulk operations** - Delete/archive multiple failed sagas

## Documentation

Created comprehensive documentation:
- **FAILED_SAGA_VISUALIZATION.md** - Complete feature documentation
- **This file** - Implementation summary

## See Also

- [Dashboard Summary](./SAGA_BOARD_SUMMARY.md)
- [Hanging Sagas View](./HANGING_SAGAS_VIEW.md)
- [Saga Cleanup](./SAGA_CLEANUP_AND_ARCHIVAL.md)
