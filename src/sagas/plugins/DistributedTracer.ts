import { SagaOrchestrator } from "../SagaOrchestrator"
import { SagaPlugin, TraceSpan } from "./types"
import { randomUUID } from "crypto"

export interface TracerOptions {
  /**
   * Service name for this saga service
   */
  serviceName: string

  /**
   * Custom span exporter (e.g., to OpenTelemetry, Jaeger, Zipkin)
   */
  onSpanComplete?: (span: TraceSpan) => void | Promise<void>

  /**
   * Sample rate (0-1). 1 = trace everything, 0 = trace nothing
   */
  sampleRate?: number

  /**
   * Add custom tags to all spans
   */
  defaultTags?: Record<string, string | number | boolean>
}

/**
 * Distributed Tracing Plugin
 * 
 * Implements distributed tracing for sagas using OpenTelemetry-compatible spans.
 * Each saga and task creates a span that can be exported to tracing backends
 * like Jaeger, Zipkin, or OpenTelemetry collectors.
 * 
 * @example
 * ```typescript
 * const tracer = new DistributedTracer({
 *   serviceName: 'order-service',
 *   onSpanComplete: async (span) => {
 *     await opentelemetry.trace.export(span)
 *   },
 *   sampleRate: 1.0
 * })
 * 
 * const orchestrator = new SagaOrchestrator()
 * tracer.attach(orchestrator)
 * ```
 */
export class DistributedTracer implements SagaPlugin {
  readonly name = "DistributedTracer"
  
  private options: Required<TracerOptions>
  private activeSpans: Map<string, TraceSpan> = new Map()
  private sagaTraces: Map<string, string> = new Map() // sagaId -> traceId
  private taskSpans: Map<string, string> = new Map() // sagaId:taskName -> spanId
  private listeners: Map<string, Function> = new Map()

  constructor(options: TracerOptions) {
    this.options = {
      serviceName: options.serviceName,
      onSpanComplete: options.onSpanComplete || this.defaultExporter.bind(this),
      sampleRate: options.sampleRate ?? 1.0,
      defaultTags: options.defaultTags || {}
    }
  }

  attach(orchestrator: SagaOrchestrator): void {
    // Saga lifecycle
    const onSagaStarted = (event: any) => this.handleSagaStarted(event)
    const onSagaSucceeded = (event: any) => this.handleSagaEnded(event, 'succeeded')
    const onSagaFailed = (event: any) => this.handleSagaEnded(event, 'failed')
    
    // Task lifecycle
    const onTaskStarted = (event: any) => this.handleTaskStarted(event)
    const onTaskSucceeded = (event: any) => this.handleTaskEnded(event, 'succeeded')
    const onTaskFailed = (event: any) => this.handleTaskEnded(event, 'failed')

    orchestrator.on('sagaStarted', onSagaStarted)
    orchestrator.on('sagaSucceeded', onSagaSucceeded)
    orchestrator.on('sagaFailed', onSagaFailed)
    orchestrator.on('taskStarted', onTaskStarted)
    orchestrator.on('taskSucceeded', onTaskSucceeded)
    orchestrator.on('taskFailed', onTaskFailed)

    this.listeners.set('sagaStarted', onSagaStarted)
    this.listeners.set('sagaSucceeded', onSagaSucceeded)
    this.listeners.set('sagaFailed', onSagaFailed)
    this.listeners.set('taskStarted', onTaskStarted)
    this.listeners.set('taskSucceeded', onTaskSucceeded)
    this.listeners.set('taskFailed', onTaskFailed)
  }

  detach(orchestrator: SagaOrchestrator): void {
    this.listeners.forEach((listener, eventName) => {
      orchestrator.off(eventName as any, listener as any)
    })
    this.listeners.clear()
  }

  private shouldSample(): boolean {
    return Math.random() < this.options.sampleRate
  }

  private handleSagaStarted(event: { sagaId: string; data: unknown }): void {
    if (!this.shouldSample()) return

    const traceId = this.generateTraceId()
    const spanId = this.generateSpanId()
    
    this.sagaTraces.set(event.sagaId, traceId)

    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId: null, // Would be set if this is a child saga
      sagaId: event.sagaId,
      startTime: Date.now(),
      status: 'started',
      tags: {
        'saga.id': event.sagaId,
        'service.name': this.options.serviceName,
        'span.kind': 'saga',
        ...this.options.defaultTags
      }
    }

    this.activeSpans.set(event.sagaId, span)
  }

  private handleSagaEnded(
    event: { sagaId: string; data: unknown; error?: unknown },
    status: 'succeeded' | 'failed'
  ): void {
    const span = this.activeSpans.get(event.sagaId)
    if (!span) return

    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    span.status = status

    if (event.error) {
      span.error = event.error
      span.tags['error'] = true
    }

    this.activeSpans.delete(event.sagaId)
    this.options.onSpanComplete(span)
  }

  private handleTaskStarted(event: { sagaId: string; taskName: string; data: unknown }): void {
    const traceId = this.sagaTraces.get(event.sagaId)
    if (!traceId) return

    const spanId = this.generateSpanId()
    const parentSpan = this.activeSpans.get(event.sagaId)
    const taskKey = `${event.sagaId}:${event.taskName}`
    
    this.taskSpans.set(taskKey, spanId)

    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId: parentSpan?.spanId || null,
      sagaId: event.sagaId,
      taskName: event.taskName,
      startTime: Date.now(),
      status: 'started',
      tags: {
        'saga.id': event.sagaId,
        'task.name': event.taskName,
        'service.name': this.options.serviceName,
        'span.kind': 'task',
        ...this.options.defaultTags
      }
    }

    this.activeSpans.set(taskKey, span)
  }

  private handleTaskEnded(
    event: { sagaId: string; taskName: string; data: unknown; error?: unknown },
    status: 'succeeded' | 'failed'
  ): void {
    const taskKey = `${event.sagaId}:${event.taskName}`
    const span = this.activeSpans.get(taskKey)
    if (!span) return

    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    span.status = status

    if (event.error) {
      span.error = event.error
      span.tags['error'] = true
    }

    this.activeSpans.delete(taskKey)
    this.taskSpans.delete(taskKey)
    this.options.onSpanComplete(span)
  }

  private generateTraceId(): string {
    // Generate 128-bit trace ID (32 hex chars)
    return randomUUID().replace(/-/g, '')
  }

  private generateSpanId(): string {
    // Generate 64-bit span ID (16 hex chars)
    return randomUUID().replace(/-/g, '').substring(0, 16)
  }

  private defaultExporter(span: TraceSpan): void {
    console.log('[TRACE]', {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      sagaId: span.sagaId,
      taskName: span.taskName,
      duration: span.duration,
      status: span.status
    })
  }

  /**
   * Get active spans (for debugging)
   */
  getActiveSpans(): Map<string, TraceSpan> {
    return new Map(this.activeSpans)
  }

  /**
   * Get trace ID for a saga
   */
  getTraceId(sagaId: string): string | undefined {
    return this.sagaTraces.get(sagaId)
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.activeSpans.clear()
    this.sagaTraces.clear()
    this.taskSpans.clear()
  }

  /**
   * Export to OpenTelemetry format
   */
  exportToOpenTelemetry(span: TraceSpan): any {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.taskName || `saga:${span.sagaId}`,
      kind: span.taskName ? 'INTERNAL' : 'SERVER',
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: span.endTime ? span.endTime * 1000000 : undefined,
      attributes: Object.entries(span.tags).map(([key, value]) => ({
        key,
        value: { stringValue: String(value) }
      })),
      status: {
        code: span.status === 'succeeded' ? 'OK' : 'ERROR',
        message: span.error ? String(span.error) : undefined
      }
    }
  }

  /**
   * Export to Jaeger format
   */
  exportToJaeger(span: TraceSpan): any {
    return {
      traceIdLow: span.traceId.substring(16),
      traceIdHigh: span.traceId.substring(0, 16),
      spanId: span.spanId,
      parentSpanId: span.parentSpanId || '0',
      operationName: span.taskName || 'saga',
      startTime: span.startTime * 1000, // microseconds
      duration: span.duration ? span.duration * 1000 : 0,
      tags: Object.entries(span.tags).map(([key, value]) => ({
        key,
        type: typeof value === 'number' ? 'int64' : 'string',
        value
      }))
    }
  }
}
