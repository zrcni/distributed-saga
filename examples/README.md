# Examples

This directory contains example usage of the distributed-saga library.

## Running the Examples

### Saga Plugins Example

The `saga-plugins-example.ts` demonstrates the saga plugins:

1. **HierarchicalLogger** - Structured logging with hierarchy visualization
2. **DistributedTracer** - OpenTelemetry-compatible distributed tracing
3. **ExecutionTreeTracker** - Execution tree building and visualization

#### Run with npm:

```bash
npm run example:plugins
```

#### Run directly with ts-node:

```bash
npx ts-node -r tsconfig-paths/register examples/saga-plugins-example.ts
```

The example includes four scenarios:

1. **Basic Setup** - Shows how to attach all plugins to an orchestrator
2. **E-commerce Order** - Real-world order processing saga with multiple steps
3. **External Integration** - How to integrate with external services (Elasticsearch, CloudWatch, etc.)
4. **Monitoring Dashboard** - Building a monitoring dashboard with plugin data

## Expected Output

When you run the plugins example, you'll see:

- 🚀 Emojis showing saga lifecycle events
- 📊 Tree visualizations in ASCII art
- 📈 Statistics about saga execution
- 📝 JSON exports of logs and relationships
- 🔍 DOT format for Graphviz visualization

Example output:
```
=== Example 1: Basic Plugin Setup ===

[TREE] Execution tree updated
└── ⏳ order-sa...

[TASK] Step 1 executing in saga order-saga-001
[TRACE] Span completed: ac7a01520bd04ea8

...

Tree stats:
{
  "totalSagas": 1,
  "rootSagas": 1,
  "running": 0,
  "completed": 1,
  "failed": 0
}
```

## Documentation

For more information about the plugins, see:
- [Plugins Guide](../docs/PLUGINS_GUIDE.md) - Comprehensive plugin documentation
- Main README.md - General library documentation
