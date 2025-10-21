/**
 * Read-only context information about the saga execution.
 * This provides safe access to saga metadata without exposing the full saga instance.
 */
export interface SagaContext {
  readonly sagaId: string
  readonly parentSagaId: string | null
  readonly parentTaskId: string | null
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
  sagaContext: SagaContext
) => Promise<ResultData> | ResultData

export type StepCompensateCallback<
  Data = unknown,
  TaskData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  taskData: TaskData,
  middlewareData: MiddlewareData
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
  sagaContext: SagaContext
) => Promise<void | boolean | ResultData> | void | boolean | ResultData
