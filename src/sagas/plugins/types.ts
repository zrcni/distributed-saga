import { SagaOrchestrator, SagaOrchestratorEvents } from "../SagaOrchestrator"
import { SagaCoordinator } from "../SagaCoordinator"

/**
 * Base interface for saga plugins.
 * Plugins can attach to the orchestrator or coordinator to extend functionality.
 */
export interface SagaPlugin {
  /**
   * Plugin name for identification and logging
   */
  readonly name: string

  /**
   * Initialize the plugin with the orchestrator
   * This is called when the plugin is attached
   */
  attach(orchestrator: SagaOrchestrator): void

  /**
   * Cleanup when plugin is detached
   */
  detach?(orchestrator: SagaOrchestrator): void
}

/**
 * Plugin that can be attached to SagaCoordinator
 */
export interface SagaCoordinatorPlugin {
  readonly name: string
  attachToCoordinator(coordinator: SagaCoordinator): void
  detachFromCoordinator?(coordinator: SagaCoordinator): void
}

/**
 * Options for hierarchical logging
 */
export interface HierarchicalLogEntry {
  timestamp: Date
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  level: number
  event: keyof SagaOrchestratorEvents
  data: unknown
  taskName?: string
  error?: unknown
}

/**
 * Options for distributed tracing
 */
export interface TraceSpan {
  spanId: string
  traceId: string
  parentSpanId: string | null
  sagaId: string
  taskName?: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'started' | 'succeeded' | 'failed'
  error?: unknown
  tags: Record<string, string | number | boolean>
}

/**
 * Saga execution tree node
 */
export interface SagaTreeNode {
  sagaId: string
  parentSagaId: string | null
  parentTaskId: string | null
  status: 'running' | 'completed' | 'failed' | 'compensating' | 'compensated'
  startTime: Date
  endTime?: Date
  children: SagaTreeNode[]
  metadata: Record<string, unknown>
}
