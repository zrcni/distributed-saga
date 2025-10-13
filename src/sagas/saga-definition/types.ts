export type StepInvokeCallback<
  Data = unknown,
  PrevResultData = unknown,
  ResultData = unknown,
  MiddlewareData = Record<string, unknown>
> = (
  data: Data,
  prevResult: PrevResultData,
  middlewareData: MiddlewareData
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
  middlewareData: MiddlewareData
) => Promise<void | boolean | ResultData> | void | boolean | ResultData
