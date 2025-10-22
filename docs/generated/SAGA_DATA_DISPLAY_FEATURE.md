# Saga Data Display Feature

## Overview

The dashboard now displays the initial data/payload that was used to start each saga. This helps users understand what input data triggered the saga execution and makes debugging and monitoring easier.

## What's New

### Saga Data Section

When viewing a saga's details, you'll now see a new **"Saga Data"** section that displays the job/payload that was passed when the saga was created.

**Location**: Between the saga info section and the tasks section on the saga detail page.

**Features**:
- Shows the complete initial data structure
- Pretty-printed JSON format for easy reading
- Scrollable container (max height: 400px) for large payloads
- Only displayed when data is available

## Implementation Details

### Backend

The backend already tracked the saga's initial data in the `job` field:

**Type Definition** (`packages/api/src/types.ts`):
```typescript
export interface SagaInfo {
  sagaId: string;
  status: 'active' | 'completed' | 'aborted';
  createdAt?: Date;
  updatedAt?: Date;
  job?: any;  // Initial saga data/payload
  tasks: TaskInfo[];
  parentSagaId?: string | null;
  parentTaskId?: string | null;
  childSagas?: SagaInfo[];
}
```

The `SagaAdapter` extracts this from the `StartSaga` message:
```typescript
case SagaMessageType.StartSaga:
  job = msg.data;
  break;
```

### Frontend

**Type Update** (`packages/ui/src/services/Api.ts`):
```typescript
export interface SagaInfo {
  sagaId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  job?: any;  // The initial data/payload that started the saga
  tasks?: Array<{...}>;
  parentSagaId?: string | null;
  parentTaskId?: string | null;
  childSagas?: SagaInfo[];
}
```

**UI Component** (`packages/ui/src/pages/SagaDetailPage.tsx`):
```tsx
{saga.job && (
  <div className="saga-data-section">
    <h3>Saga Data</h3>
    <div className="saga-data-content">
      <pre>{JSON.stringify(saga.job, null, 2)}</pre>
    </div>
  </div>
)}
```

**Styling** (`packages/ui/src/pages/SagaDetailPage.css`):
```css
.saga-data-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.saga-data-content {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 15px;
  max-height: 400px;
  overflow: auto;
}
```

## Example

### Before
The saga detail page showed:
- Saga ID
- Status
- Timestamps
- Tasks
- Child sagas

### After
The saga detail page now also shows:
- **Saga Data** (new section showing the initial payload)

Example saga data display:
```json
{
  "orderId": "ORD-123",
  "customerId": "CUST-456",
  "items": [
    {
      "productId": "PROD-789",
      "quantity": 2,
      "price": 49.99
    }
  ],
  "totalAmount": 99.98,
  "paymentMethod": "credit_card"
}
```

## Use Cases

### 1. Debugging Failed Sagas
When a saga fails, you can now see the exact input data that caused the failure, making it easier to reproduce and fix issues.

### 2. Monitoring Data Flow
Understand what data is flowing through your system by viewing the initial payload for each saga.

### 3. Auditing
Track what data was used to initiate specific business processes.

### 4. Development and Testing
Verify that sagas are being started with the correct data structure and values.

## Benefits

1. **Better Visibility**: See the complete context of what triggered each saga
2. **Easier Debugging**: Quickly identify if incorrect data was passed to a saga
3. **Improved Monitoring**: Track the types and patterns of data flowing through your system
4. **No Breaking Changes**: This is an additive feature that doesn't break existing functionality

## Notes

- The saga data section only appears when data is available (when `saga.job` is not null/undefined)
- Large payloads are displayed in a scrollable container to prevent page overflow
- The data is formatted as pretty-printed JSON for readability
- This data represents the state at saga creation time and doesn't change during saga execution

## Related Features

- [Saga Context](./SAGA_CONTEXT_PARAMETERS.md) - For accessing shared mutable state during saga execution
- [Task Data Display](./DASHBOARD_TASK_VISUALIZATION.md) - Tasks also display their input/output data
- [Dashboard Architecture](./SAGA_BOARD_ARCHITECTURE.md) - Overall dashboard structure

## Migration

No migration needed! This is a backward-compatible enhancement. The UI will automatically display the saga data section when viewing sagas, assuming the backend is providing the `job` field (which it already does).

## Future Enhancements

Possible future improvements:
- Add filtering/search within large payloads
- Add ability to copy the data to clipboard
- Add syntax highlighting for better readability
- Support for comparing data across multiple saga executions
- Data validation indicators showing if the payload matches expected schema
