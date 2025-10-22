/**
 * Read-only context information about the saga execution.
 * This provides safe access to saga metadata without exposing the full saga instance.
 */
export interface SagaContext {
  readonly sagaId: string
  readonly parentSagaId: string | null
  readonly parentTaskId: string | null
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
}

export type StepInvokeCallback<
  Data = unknown,
  PrevResultData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  prevResult: PrevResultData,
  middlewareData: MiddlewareData,
  sagaContext: SagaContext,
  saga: ReadOnlySaga
) => Promise<ResultData> | ResultData

export type StepCompensateCallback<
  Data = unknown,
  TaskData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  taskData: TaskData,
  middlewareData: MiddlewareData,
  saga: ReadOnlySaga
) => Promise<ResultData> | ResultData

export type StepMiddlewareCallback<
  Data = unknown,
  PrevResultData = unknown,
  MiddlewareData = Record<string, unknown>,
  ResultData = Record<string, unknown>
> = (
  data: Data,
  prevResult: PrevResultData,
  middlewareData: MiddlewareData,
  sagaContext: SagaContext,
  saga: ReadOnlySaga
) => Promise<void | boolean | ResultData> | void | boolean | ResultData
