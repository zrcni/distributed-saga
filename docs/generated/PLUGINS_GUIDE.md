# Saga Plugins Guide

## Overview

The distributed-saga library provides a powerful plugin system that enables advanced observability, tracing, and monitoring capabilities. Three core plugins are available out of the box:

1. **HierarchicalLogger** - Track saga execution with proper hierarchy visualization
2. **DistributedTracer** - Integrate with OpenTelemetry, Jaeger, Zipkin for distributed tracing  
3. **ExecutionTreeTracker** - Build and visualize saga execution trees

## Installation & Setup

```typescript
import {
  SagaOrchestrator,
  HierarchicalLogger,
  DistributedTracer,
  ExecutionTreeTracker
} from '@zrcni/distributed-saga'

const orchestrator = new SagaOrchestrator()

// Attach plugins
const logger = new HierarchicalLogger({ prettyPrint: true })
logger.attach(orchestrator)

const tracer = new DistributedTracer({ serviceName: 'my-service' })
tracer.attach(orchestrator)
```

## Plugin 1: HierarchicalLogger

### Purpose
Captures all saga events and logs them with proper hierarchy visualization, making it easy to understand nested saga execution.

### Features
- Pretty-printed console output with indentation
- Custom log handlers for external services
- Configurable log levels
- JSON export
- Saga hierarchy mapping
- Time-range queries

### Basic Usage

```typescript
const logger = new HierarchicalLogger({
  prettyPrint: true,
  includeEventData: false,
  onLog: async (entry) => {
    // Send to your logging service
    await elasticsearch.index({
      index: 'saga-logs',
      body: entry
    })
  }
})

logger.attach(orchestrator)
```

### Options

```typescript
interface HierarchicalLoggerOptions {
  onLog?: (entry: HierarchicalLogEntry) => void | Promise<void>
  logLevels?: (keyof SagaOrchestratorEvents)[]
  includeEventData?: boolean  // Default: false
  prettyPrint?: boolean       // Default: true
}
```

### API Methods

```typescript
// Get all logs
logger.getLogs(): ReadonlyArray<HierarchicalLogEntry>

// Get logs for specific saga
logger.getLogsForSaga(sagaId: string): HierarchicalLogEntry[]

// Get logs in time range
logger.getLogsByTimeRange(start: Date, end: Date): HierarchicalLogEntry[]

// Export logs
logger.exportLogs(): string  // Returns JSON

// Get saga hierarchy
logger.getSagaHierarchy(): Map<string, string[]>

// Clear logs
logger.clearLogs(): void
```

### Example Output

```
🚀 [2025-10-21T10:30:00.000Z] sagaStarted [order-sag...]
  ▶️ [2025-10-21T10:30:00.100Z] taskStarted - validateOrder [order-sag...]
  ✓ [2025-10-21T10:30:00.250Z] taskSucceeded - validateOrder [order-sag...]
  ▶️ [2025-10-21T10:30:00.300Z] taskStarted - chargePayment [order-sag...]
  ✓ [2025-10-21T10:30:00.500Z] taskSucceeded - chargePayment [order-sag...]
✅ [2025-10-21T10:30:00.600Z] sagaSucceeded [order-sag...]
```

## Plugin 2: DistributedTracer

### Purpose
Implements distributed tracing using OpenTelemetry-compatible spans, enabling integration with APM tools like Jaeger, Zipkin, New Relic, and Datadog.

### Features
- OpenTelemetry-compatible span format
- Jaeger export format
- Configurable sampling
- Custom tags
- Span relationships (parent-child)
- Duration tracking

### Basic Usage

```typescript
const tracer = new DistributedTracer({
  serviceName: 'order-service',
  sampleRate: 1.0,  // 100% sampling
  defaultTags: {
    environment: 'production',
    version: '1.0.0'
  },
  onSpanComplete: async (span) => {
    // Export to Jaeger
    const jaegerSpan = tracer.exportToJaeger(span)
    await jaegerClient.report(jaegerSpan)
    
    // Or export to OpenTelemetry
    const otlpSpan = tracer.exportToOpenTelemetry(span)
    await opentelemetry.export(otlpSpan)
  }
})

tracer.attach(orchestrator)
```

### Options

```typescript
interface TracerOptions {
  serviceName: string
  onSpanComplete?: (span: TraceSpan) => void | Promise<void>
  sampleRate?: number          // 0-1, default: 1.0
  defaultTags?: Record<string, string | number | boolean>
}
```

### Span Format

```typescript
interface TraceSpan {
  spanId: string              // 64-bit span ID
  traceId: string             // 128-bit trace ID
  parentSpanId: string | null
  sagaId: string
  taskName?: string
  startTime: number           // Unix timestamp (ms)
  endTime?: number
  duration?: number           // Milliseconds
  status: 'started' | 'succeeded' | 'failed'
  error?: unknown
  tags: Record<string, string | number | boolean>
}
```

### API Methods

```typescript
// Get active spans
tracer.getActiveSpans(): Map<string, TraceSpan>

// Get trace ID for saga
tracer.getTraceId(sagaId: string): string | undefined

// Export formats
tracer.exportToOpenTelemetry(span: TraceSpan): any
tracer.exportToJaeger(span: TraceSpan): any

// Clear tracking data
tracer.clear(): void
```

### Integration Examples

#### Jaeger Integration

```typescript
import { initTracer } from 'jaeger-client'

const jaeger = initTracer(config, options)

const tracer = new DistributedTracer({
  serviceName: 'order-service',
  onSpanComplete: async (span) => {
    const jaegerSpan = tracer.exportToJaeger(span)
    jaeger.report(jaegerSpan)
  }
})
```

#### OpenTelemetry Integration

```typescript
import { trace } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

const provider = new NodeTracerProvider()
const tracer = provider.getTracer('saga-tracer')

const sagaTracer = new DistributedTracer({
  serviceName: 'order-service',
  onSpanComplete: async (span) => {
    const otlpSpan = sagaTracer.exportToOpenTelemetry(span)
    // Send to OTLP collector
  }
})
```

## Plugin 3: ExecutionTreeTracker

### Purpose
Builds and maintains a tree structure showing saga execution hierarchy, perfect for visualization and debugging complex saga flows.

### Features
- Real-time tree updates
- Multiple export formats (JSON, ASCII, DOT/Graphviz)
- Tree statistics
- Path finding
- Historical snapshots
- Depth limiting

### Basic Usage

```typescript
const treeTracker = new ExecutionTreeTracker({
  keepHistory: true,
  maxDepth: 10,
  onTreeUpdate: async (tree) => {
    // Render visualization
    await dashboard.renderTree(tree)
  }
})

treeTracker.attach(orchestrator)
```

### Options

```typescript
interface ExecutionTreeOptions {
  onTreeUpdate?: (tree: SagaTreeNode[]) => void | Promise<void>
  keepHistory?: boolean      // Default: false
  maxDepth?: number          // Default: 10
}
```

### Tree Node Structure

```typescript
interface SagaTreeNode {
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  status: 'running' | 'completed' | 'failed' | 'compensating' | 'compensated'
  startTime: Date
  endTime?: Date
  children: SagaTreeNode[]
  metadata: Record<string, unknown>
}
```

### API Methods

```typescript
// Get current tree
treeTracker.getTree(): SagaTreeNode[]

// Get specific node
treeTracker.getNode(sagaId: string): SagaTreeNode | undefined

// Get children
treeTracker.getChildren(sagaId: string): SagaTreeNode[]

// Get path from root
treeTracker.getPath(sagaId: string): SagaTreeNode[]

// Get leaf nodes
treeTracker.getLeafNodes(): SagaTreeNode[]

// Get tree depth
treeTracker.getDepth(sagaId?: string): number

// Get statistics
treeTracker.getStats(): TreeStats

// Export formats
treeTracker.exportAsJSON(): string
treeTracker.exportAsASCII(): string
treeTracker.exportAsDOT(): string  // For Graphviz

// Historical data
treeTracker.getHistory(): SagaTreeNode[][]

// Clear tree
treeTracker.clear(): void
```

### Export Examples

#### ASCII Export

```typescript
console.log(treeTracker.exportAsASCII())
```

Output:
```
└── ⏳ order-sag...
    ├── ✅ payment-...
    │   └── ✅ authorize...
    └── ⏳ shipping...
        ├── ✅ warehouse...
        └── ⏳ carrier-...
```

#### DOT/Graphviz Export

```typescript
const dot = treeTracker.exportAsDOT()
// Save to file and render with Graphviz:
// dot -Tpng tree.dot -o tree.png
```

#### JSON Export

```typescript
const json = treeTracker.exportAsJSON()
await fs.writeFile('tree.json', json)
```

### Statistics

```typescript
const stats = treeTracker.getStats()
console.log(stats)
// {
//   totalSagas: 10,
//   rootSagas: 2,
//   running: 3,
//   completed: 5,
//   failed: 1,
//   compensating: 0,
//   compensated: 1,
//   averageDepth: 2.5,
//   maxDepth: 4
// }
```

## Complete Example: All Plugins Together

```typescript
import {
  SagaOrchestrator,
  SagaBuilder,
  InMemorySagaLog,
  HierarchicalLogger,
  DistributedTracer,
  ExecutionTreeTracker
} from '@zrcni/distributed-saga'

async function setupFullObservability() {
  const orchestrator = new SagaOrchestrator()
  
  // 1. Hierarchical Logging
  const logger = new HierarchicalLogger({
    prettyPrint: true,
    onLog: async (entry) => {
      await logstash.send(entry)
    }
  })
  logger.attach(orchestrator)
  
  // 2. Distributed Tracing
  const tracer = new DistributedTracer({
    serviceName: 'order-service',
    sampleRate: 0.1,
    onSpanComplete: async (span) => {
      await jaeger.report(tracer.exportToJaeger(span))
    }
  })
  tracer.attach(orchestrator)
  
  // 3. Execution Trees
  const treeTracker = new ExecutionTreeTracker({
    keepHistory: true,
    onTreeUpdate: async (tree) => {
      await dashboard.updateTree(tree)
    }
  })
  treeTracker.attach(orchestrator)
  
  return {
    orchestrator,
    logger,
    tracer,
    treeTracker
  }
}

// Create monitoring dashboard
const monitoring = await setupFullObservability()

// Run sagas with full observability
const saga = await coordinator.createSaga('order-123', orderData)
await monitoring.orchestrator.run(saga, orderSagaDefinition)

// Query plugin data
console.log('Logs:', monitoring.logger.getLogs())
console.log('Tree:', monitoring.treeTracker.exportAsASCII())
console.log('Stats:', monitoring.treeTracker.getStats())
```

## Best Practices

### 1. Production Configuration

```typescript
// Use sampling in production
const tracer = new DistributedTracer({
  serviceName: 'my-service',
  sampleRate: 0.1  // Only trace 10% of requests
})

// Don't keep full history in production
const treeTracker = new ExecutionTreeTracker({
  keepHistory: false,
  maxDepth: 5
})

// Don't include sensitive data in logs
const logger = new HierarchicalLogger({
  includeEventData: false
})
```

### 2. Performance Considerations

- Plugins add minimal overhead (~1-2ms per event)
- Use sampling for high-throughput systems
- Implement async handlers to avoid blocking saga execution
- Consider batching exports to external systems

### 3. Memory Management

- Clear logs periodically: `logger.clearLogs()`
- Disable history tracking for long-running systems
- Implement log rotation for long-running processes

### 4. Error Handling

```typescript
const logger = new HierarchicalLogger({
  onLog: async (entry) => {
    try {
      await externalService.send(entry)
    } catch (error) {
      console.error('Failed to send log:', error)
      // Don't let plugin errors break saga execution
    }
  }
})
```

## Troubleshooting

**Q: Plugins not receiving events**
A: Ensure plugins are attached before running sagas:
```typescript
plugin.attach(orchestrator)  // Must be before orchestrator.run()
```

**Q: High memory usage**
A: Disable history tracking and clear logs regularly:
```typescript
treeTracker.clear()
logger.clearLogs()
```

## Contributing

Want to create a custom plugin? Implement the `SagaPlugin` interface:

```typescript
interface SagaPlugin {
  readonly name: string
  attach(orchestrator: SagaOrchestrator): void
  detach?(orchestrator: SagaOrchestrator): void
}

class MyCustomPlugin implements SagaPlugin {
  readonly name = "MyCustomPlugin"
  
  attach(orchestrator: SagaOrchestrator): void {
    orchestrator.on('sagaStarted', (event) => {
      // Your custom logic
    })
  }
  
  detach(orchestrator: SagaOrchestrator): void {
    // Cleanup
  }
}
```

## License

See main package LICENSE file.
