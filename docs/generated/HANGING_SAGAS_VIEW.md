# Hanging Sagas View Feature

## Overview

The dashboard now includes a dedicated view for monitoring "hanging sagas" - sagas that have been running for an extended period of time (more than 24 hours). This feature helps identify potentially stuck or problematic sagas that may require intervention.

## What is a Hanging Saga?

A saga is considered "hanging" when:
- Its status is **active** (still running)
- It has been running for more than **24 hours** since creation

## Features

### Navigation

The dashboard header now includes two navigation links:
- **All Sources**: The default view showing all saga sources
- **Hanging Sagas**: A dedicated view showing only hanging sagas across all sources

### Hanging Sagas View

The hanging sagas view provides:

1. **Aggregated View**: Shows hanging sagas from all sources in a single list
2. **Running Time**: Displays how long each saga has been running (e.g., "2d 5h 30m")
3. **Source Identification**: Each saga card shows which source it belongs to
4. **Status Badge**: Visual indicator showing the saga's current status
5. **Quick Actions**: Abort or delete buttons for immediate action
6. **Auto-refresh**: The view automatically refreshes every 10 seconds
7. **Empty State**: When no hanging sagas exist, displays a success message

### Visual Indicators

- **Red border**: Hanging saga cards have a distinctive red left border
- **Warning badge**: Shows the running time with a warning icon (⚠️)
- **Source badge**: Displays the source name in a blue badge
- **Count badge**: Header shows the total count of hanging sagas

### Card Information

Each hanging saga card displays:
- Source name
- Saga ID
- Current status
- Running time (formatted as days/hours/minutes)
- Number of tasks
- Number of child sagas (if any)
- Error indicators (if tasks have errors)
- Creation timestamp
- Action buttons (Abort/Delete)

### Actions

- **Click on card**: Navigate to the detailed saga view
- **Abort button**: Abort the running saga
- **Delete button**: Permanently delete the saga

## Technical Implementation

### Frontend Components

- **HangingSagasPage.tsx**: Main component for the hanging sagas view
- **HangingSagasPage.css**: Styling for the hanging sagas view
- **Header.tsx**: Updated to include navigation links

### Hanging Detection Logic

```typescript
const HANGING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// A saga is hanging if:
// 1. Status is 'active'
// 2. Created more than 24 hours ago
const runningTime = now - createdAt;
const isHanging = saga.status === 'active' && runningTime > HANGING_THRESHOLD_MS;
```

### Data Flow

1. Component loads all sources from the API
2. For each source, fetches all sagas (not just root sagas)
3. Filters sagas based on:
   - Status must be 'active'
   - Creation time must be > 24 hours ago
4. Sorts results by oldest first (longest running first)
5. Refreshes data every 10 seconds

### Routing

- Route path: `/hanging`
- Server-side route added to ExpressAdapter to serve the UI
- Client-side route added to App.tsx

## Use Cases

### Monitoring Long-Running Operations

Use the hanging sagas view to:
- Identify sagas that may be stuck waiting for external services
- Detect infinite loops or deadlocks
- Find sagas affected by timeout issues
- Monitor batch processing operations

### Debugging

When investigating issues:
1. Check the hanging sagas view for problematic sagas
2. Click on a hanging saga to see detailed task information
3. Review task errors and status
4. Abort or delete hanging sagas as needed

### Operations

For production environments:
- Set up regular monitoring of the hanging sagas count
- Create alerts when hanging sagas exceed a threshold
- Use the view for incident response and troubleshooting

## Configuration

The hanging threshold is currently hardcoded to 24 hours. To customize this threshold, modify the constant in `HangingSagasPage.tsx`:

```typescript
const HANGING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // Adjust as needed
```

## Future Enhancements

Potential improvements for this feature:
- Configurable hanging threshold (via UI or config)
- Filter by source in the hanging sagas view
- Export hanging sagas list
- Historical tracking of hanging sagas
- Notifications/alerts for new hanging sagas
- Batch operations (abort/delete multiple sagas)
- Additional time-based filters (12h, 48h, 1 week, etc.)

## Related Documentation

- [Dashboard Performance Optimization](./DASHBOARD_PERFORMANCE_OPTIMIZATION.md)
- [Dashboard Task Visualization](./DASHBOARD_TASK_VISUALIZATION.md)
- [Saga Board Summary](./SAGA_BOARD_SUMMARY.md)
