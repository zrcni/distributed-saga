/**
 * Read-only context information about the saga execution.
 * This provides safe access to saga metadata without exposing the full saga instance.
 * @deprecated Use TaskContext instead
 */
export interface SagaContext {
  readonly sagaId: string
  readonly parentSagaId: string | null
  readonly parentTaskId: string | null
}

/**
 * Writable saga context interface for updating shared saga state.
 * Tasks can use this to read and update saga-level context that persists across tasks.
 */
export interface WritableSagaContext {
  /**
   * Get the current saga context
   */
  get<T = Record<string, any>>(): Promise<T>
  
  /**
   * Update saga context with new values (merges with existing context)
   */
  update(updates: Record<string, any>): Promise<void>
}

/**
 * Read-only interface for accessing saga state and task data within callbacks.
 * This provides safe read access to the saga without allowing state modifications.
 */
export interface ReadOnlySaga {
  readonly sagaId: string
  getJob(): Promise<unknown>
  getTaskIds(): Promise<string[]>
  isTaskStarted(taskId: string): Promise<boolean>
  getStartTaskData(taskId: string): Promise<unknown>
  isTaskCompleted(taskId: string): Promise<boolean>
  getEndTaskData<D = unknown>(taskId: string): Promise<D | undefined>
  isCompensatingTaskStarted(taskId: string): Promise<boolean>
  getStartCompensatingTaskData(taskId: string): Promise<unknown>
  isCompensatingTaskCompleted(taskId: string): Promise<boolean>
  getEndCompensatingTaskData(taskId: string): Promise<unknown>
  isSagaAborted(): Promise<boolean>
  isSagaCompleted(): Promise<boolean>
  getSagaContext<T = Record<string, any>>(): Promise<T>
}

/**
 * Context object passed to task invoke and middleware callbacks.
 * Consolidates all contextual information into a single parameter.
 */
export interface TaskContext<PrevResultData = unknown, MiddlewareData = Record<string, unknown>> {
  /** Previous task's result data */
  prev: PrevResultData
  
  /** Accumulated middleware data */
  middleware: MiddlewareData
  
  /** Read-only saga API for accessing saga state */
  api: ReadOnlySaga
  
  /** Current saga ID */
  sagaId: string
  
  /** Parent saga ID if this is a nested saga */
  parentSagaId: string | null
  
  /** Parent task ID if this is a nested saga */
  parentTaskId: string | null
  
  /** Writable saga context for shared state */
  ctx: WritableSagaContext
}

/**
 * Context object passed to compensation callbacks.
 * Similar to TaskContext but with taskData instead of prev.
 */
export interface CompensationContext<TaskData = unknown, MiddlewareData = Record<string, unknown>> {
  /** Original task data from when the task was executed */
  taskData: TaskData
  
  /** Accumulated middleware data */
  middleware: MiddlewareData
  
  /** Read-only saga API for accessing saga state */
  api: ReadOnlySaga
  
  /** Current saga ID */
  sagaId: string
  
  /** Parent saga ID if this is a nested saga */
  parentSagaId: string | null
  
  /** Parent task ID if this is a nested saga */
  parentTaskId: string | null
  
  /** Writable saga context for shared state */
  ctx: WritableSagaContext
}

export type StepInvokeCallback<
  Data = unknown,
  PrevResultData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  context: TaskContext<PrevResultData, MiddlewareData>
) => Promise<ResultData> | ResultData

export type StepCompensateCallback<
  Data = unknown,
  TaskData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  context: CompensationContext<TaskData, MiddlewareData>
) => Promise<ResultData> | ResultData

export type StepMiddlewareCallback<
  Data = unknown,
  PrevResultData = unknown,
  MiddlewareData = Record<string, unknown>,
  ResultData = Record<string, unknown>
> = (
  data: Data,
  context: TaskContext<PrevResultData, MiddlewareData>
) => Promise<void | boolean | ResultData> | void | boolean | ResultData
