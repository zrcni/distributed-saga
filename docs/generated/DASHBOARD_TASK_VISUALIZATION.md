# Dashboard Task Visualization

## Overview

The Saga Dashboard now provides detailed visualization of saga tasks and their execution status, making it easy to monitor and debug saga workflows in real-time.

## Features

### 1. **Enhanced Task Display**

Each saga now displays a comprehensive task list showing:
- Task number (sequential order)
- Task name
- Current status with visual indicators
- Execution progress with animated spinners

### 2. **Task Status Types**

The dashboard recognizes and displays the following task statuses:

| Status | Description | Visual Indicator |
|--------|-------------|------------------|
| `not_started` | Task hasn't begun execution yet | Grey badge |
| `started` | Task is currently executing | Yellow badge with spinner |
| `completed` | Task finished successfully | Green badge |
| `compensating` | Task is being rolled back | Orange badge with spinner |
| `compensated` | Task rollback completed | Grey badge |

### 3. **Real-Time Execution Indicators**

#### Active Task Execution
When a task is actively executing (`started` status):
- Yellow highlight on the task row
- Animated spinner icon
- "Executing..." label
- Enhanced visual prominence with border and shadow

#### Compensation In Progress
When a task is being compensated (`compensating` status):
- Orange highlight on the task row
- Animated spinner icon (orange)
- "Compensating..." label
- Visual distinction from normal execution

### 4. **Task Numbering**

Each task shows its position in the saga sequence with a circular badge:
- Normal tasks: Grey badge with number
- Executing tasks: Yellow badge with number
- Compensating tasks: Orange badge with number

### 5. **Auto-Refresh**

The dashboard automatically refreshes every 5 seconds to show the latest task status, ensuring you always see current execution state.

## UI Components

### Saga Card Structure

```
┌─────────────────────────────────────────────────────┐
│ Saga ID: order-1234                    [STATUS]     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                      │
│ Tasks (5)                                           │
│ ─────────────────────────────────────────────────   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ① Reserve Inventory            [COMPLETED]   │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ② Charge Payment               [EXECUTING]   │   │
│ │   🔄 Executing...                            │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ③ Ship Order                   [NOT STARTED] │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ [Abort Saga]                                        │
└─────────────────────────────────────────────────────┘
```

## CSS Classes

### Task State Classes

- `.task` - Base task container
- `.task-executing` - Applied to tasks with `started` status
- `.task-compensating` - Applied to tasks with `compensating` status

### Status Badge Classes

- `.task-status-not_started` - Grey badge
- `.task-status-started` - Yellow badge
- `.task-status-completed` - Green badge
- `.task-status-compensating` - Orange badge
- `.task-status-compensated` - Grey badge

### Visual Elements

- `.spinner` - Animated rotation indicator
- `.task-indicator` - Container for status text and spinner
- `.task-number` - Circular task sequence badge

## How It Works

### Backend (SagaAdapter)

The `SagaAdapter` reconstructs saga state from log messages:

```typescript
// Messages are processed to build task status
case SagaMessageType.StartTask:
  tasks.set(msg.taskId, {
    taskName: msg.taskId,
    status: 'started',
    data: msg.data,
  });
  break;

case SagaMessageType.EndTask:
  task.status = 'completed';
  break;

case SagaMessageType.StartCompensatingTask:
  task.status = 'compensating';
  break;

case SagaMessageType.EndCompensatingTask:
  task.status = 'compensated';
  break;
```

### Frontend (SagasPage)

The UI renders tasks with appropriate visual indicators:

```tsx
{saga.tasks.map((task, idx) => {
  const isExecuting = task.status === 'started';
  const isCompensating = task.status === 'compensating';
  
  return (
    <div className={`task ${isExecuting ? 'task-executing' : ''}`}>
      <div className="task-number">#{idx + 1}</div>
      <div className="task-name">{task.taskName}</div>
      {isExecuting && (
        <div className="task-indicator">
          <span className="spinner"></span>
          <span>Executing...</span>
        </div>
      )}
      <span className={`task-status-${task.status}`}>
        {task.status}
      </span>
    </div>
  );
})}
```

## Use Cases

### 1. **Monitoring Long-Running Sagas**

Watch as each task progresses through the workflow:
- See which task is currently executing
- Identify bottlenecks or slow operations
- Monitor progress of multi-step processes

### 2. **Debugging Failed Sagas**

When a saga fails or is aborted:
- See exactly which task failed
- View which tasks completed successfully
- Track compensation progress during rollback

### 3. **Development & Testing**

During development:
- Verify task execution order
- Confirm compensation logic
- Test error scenarios and recovery

### 4. **Production Monitoring**

In production environments:
- Real-time visibility into saga execution
- Quick identification of stuck or failing tasks
- Audit trail of task completion

## Example Scenarios

### Successful Saga Execution

```
Tasks (3)
─────────────────────────────────
① Reserve Inventory     [COMPLETED] ✓
② Process Payment       [COMPLETED] ✓
③ Send Confirmation     [COMPLETED] ✓

Status: COMPLETED
```

### Saga In Progress

```
Tasks (4)
─────────────────────────────────
① Validate Order        [COMPLETED] ✓
② Check Inventory       [COMPLETED] ✓
③ Charge Payment        [EXECUTING] 🔄
   🔄 Executing...
④ Ship Order            [NOT STARTED]

Status: ACTIVE
```

### Saga Compensation

```
Tasks (3)
─────────────────────────────────
① Reserve Inventory     [COMPENSATED] ⟲
② Process Payment       [COMPENSATING] 🔄
   🔄 Compensating...
③ Send Email            [COMPLETED] ✓

Status: ABORTED
```

## Future Enhancements

Potential improvements for future versions:

1. **Task Timing Information**
   - Show how long each task took to execute
   - Display start/end timestamps
   - Highlight slow tasks

2. **Task Data Visualization**
   - Show input/output data for each task
   - Display error messages for failed tasks
   - View compensation data

3. **Task Retry Information**
   - Track retry attempts
   - Show retry timing
   - Display retry success/failure

4. **Progress Bar**
   - Visual progress indicator for saga completion
   - Percentage of tasks completed
   - Estimated time to completion

5. **Task Logs**
   - Link to detailed logs for each task
   - View task execution history
   - Export task data

## API Reference

### SagaInfo Interface

```typescript
interface SagaInfo {
  sagaId: string;
  status: 'active' | 'completed' | 'aborted';
  createdAt?: Date;
  updatedAt?: Date;
  job?: any;
  tasks: TaskInfo[];
}
```

### TaskInfo Interface

```typescript
interface TaskInfo {
  taskName: string;
  status: 'not_started' | 'started' | 'completed' | 'compensating' | 'compensated';
  startedAt?: Date;
  completedAt?: Date;
  data?: any;
  error?: any;
}
```

## Styling Customization

The dashboard uses CSS variables for easy theming:

```css
:root {
  --primary-color: #007bff;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --card-bg: white;
}
```

To customize colors, override these variables in your CSS:

```css
:root {
  --warning-color: #ff9800;  /* Change executing task color */
  --success-color: #4caf50;  /* Change completed task color */
}
```

## Browser Compatibility

The dashboard uses modern CSS features including:
- CSS Grid and Flexbox
- CSS Variables
- CSS Animations
- Border Radius

Tested and supported in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance Considerations

- Auto-refresh interval: 5 seconds (configurable)
- Task list virtualization: Not implemented (suitable for <100 tasks)
- Animation performance: Hardware-accelerated CSS transforms

For sagas with hundreds of tasks, consider:
1. Implementing virtual scrolling
2. Pagination of task lists
3. Lazy loading of task details

---

**Note**: The dashboard is designed for monitoring and debugging purposes. For production environments, consider implementing appropriate access controls and rate limiting.
