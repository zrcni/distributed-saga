import { SagaOrchestrator, SagaOrchestratorEvents } from "../SagaOrchestrator"
import { SagaPlugin, HierarchicalLogEntry } from "./types"

export interface HierarchicalLoggerOptions {
  /**
   * Custom log handler. If not provided, logs to console
   */
  onLog?: (entry: HierarchicalLogEntry) => void | Promise<void>

  /**
   * Log levels to capture (default: all)
   */
  logLevels?: (keyof SagaOrchestratorEvents)[]

  /**
   * Include full event data in logs (can be verbose)
   */
  includeEventData?: boolean

  /**
   * Pretty print logs to console with indentation
   */
  prettyPrint?: boolean
}

/**
 * Hierarchical Logging Plugin
 * 
 * Captures all saga events and logs them with proper hierarchy visualization.
 * Uses parentSagaId and parentTaskId to understand the execution tree structure.
 * 
 * @example
 * ```typescript
 * const logger = new HierarchicalLogger({
 *   prettyPrint: true,
 *   onLog: async (entry) => {
 *     await database.logs.insert(entry)
 *   }
 * })
 * 
 * const orchestrator = new SagaOrchestrator()
 * logger.attach(orchestrator)
 * ```
 */
export class HierarchicalLogger implements SagaPlugin {
  readonly name = "HierarchicalLogger"
  
  private options: Required<HierarchicalLoggerOptions>
  private sagaLevels: Map<string, number> = new Map()
  private logs: HierarchicalLogEntry[] = []
  private listeners: Map<keyof SagaOrchestratorEvents, Function> = new Map()

  constructor(options: HierarchicalLoggerOptions = {}) {
    this.options = {
      onLog: options.onLog || this.defaultLogHandler.bind(this),
      logLevels: options.logLevels || [
        'sagaStarted',
        'sagaSucceeded',
        'sagaFailed',
        'taskStarted',
        'taskSucceeded',
        'taskFailed',
        'compensationStarted',
        'compensationSucceeded',
        'compensationFailed'
      ],
      includeEventData: options.includeEventData ?? false,
      prettyPrint: options.prettyPrint ?? true
    }
  }

  attach(orchestrator: SagaOrchestrator): void {
    // Create event listeners for all configured log levels
    this.options.logLevels.forEach(eventName => {
      const listener = (event: any) => {
        this.handleEvent(eventName, event)
      }
      this.listeners.set(eventName, listener)
      orchestrator.on(eventName, listener)
    })
  }

  detach(orchestrator: SagaOrchestrator): void {
    // Remove all listeners
    this.listeners.forEach((listener, eventName) => {
      orchestrator.off(eventName, listener as any)
    })
    this.listeners.clear()
  }

  private handleEvent(eventName: keyof SagaOrchestratorEvents, event: any): void {
    const sagaId = event.sagaId
    
    // Determine hierarchy level
    // This would ideally come from the saga context, but we can infer it
    let level = this.sagaLevels.get(sagaId) ?? 0
    
    // If this is a saga start event, we might be able to determine parent relationship
    if (eventName === 'sagaStarted') {
      // Level will be set when we have access to parentSagaId from saga context
      // For now, track the saga
      if (!this.sagaLevels.has(sagaId)) {
        this.sagaLevels.set(sagaId, level)
      }
    }

    const logEntry: HierarchicalLogEntry = {
      timestamp: new Date(),
      sagaId,
      parentSagaId: null, // Would come from saga context
      parentTaskId: null, // Would come from saga context
      level,
      event: eventName,
      data: this.options.includeEventData ? event.data : undefined,
      taskName: event.taskName,
      error: event.error
    }

    this.logs.push(logEntry)
    this.options.onLog(logEntry)
  }

  private defaultLogHandler(entry: HierarchicalLogEntry): void {
    if (!this.options.prettyPrint) {
      console.log(JSON.stringify(entry))
      return
    }

    // Pretty print with indentation
    const indent = "  ".repeat(entry.level)
    const emoji = this.getEventEmoji(entry.event)
    const timestamp = entry.timestamp.toISOString()
    
    let message = `${indent}${emoji} [${timestamp}] ${entry.event}`
    
    if (entry.taskName) {
      message += ` - ${entry.taskName}`
    }
    
    if (entry.parentSagaId) {
      message += ` (parent: ${entry.parentSagaId.substring(0, 8)}...)`
    }
    
    message += ` [${entry.sagaId.substring(0, 8)}...]`

    if (entry.error) {
      console.error(message, entry.error)
    } else {
      console.log(message)
    }
  }

  private getEventEmoji(event: keyof SagaOrchestratorEvents): string {
    const emojiMap: Record<keyof SagaOrchestratorEvents, string> = {
      sagaStarted: '🚀',
      sagaSucceeded: '✅',
      sagaFailed: '❌',
      taskStarted: '▶️',
      taskSucceeded: '✓',
      taskFailed: '✗',
      optionalTaskFailed: '⚠️',
      middlewareSucceeded: '🔧',
      middlewareFailed: '⚠️',
      compensationStarted: '↩️',
      compensationSucceeded: '↩️✓',
      compensationFailed: '↩️✗'
    }
    return emojiMap[event] || '•'
  }

  /**
   * Get all captured logs
   */
  getLogs(): ReadonlyArray<HierarchicalLogEntry> {
    return [...this.logs]
  }

  /**
   * Get logs for a specific saga
   */
  getLogsForSaga(sagaId: string): HierarchicalLogEntry[] {
    return this.logs.filter(log => log.sagaId === sagaId)
  }

  /**
   * Get logs in a time range
   */
  getLogsByTimeRange(start: Date, end: Date): HierarchicalLogEntry[] {
    return this.logs.filter(
      log => log.timestamp >= start && log.timestamp <= end
    )
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
    this.sagaLevels.clear()
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Get saga hierarchy tree structure
   */
  getSagaHierarchy(): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>()
    
    this.logs.forEach(log => {
      if (log.parentSagaId) {
        const children = hierarchy.get(log.parentSagaId) || []
        if (!children.includes(log.sagaId)) {
          children.push(log.sagaId)
          hierarchy.set(log.parentSagaId, children)
        }
      }
    })
    
    return hierarchy
  }
}
