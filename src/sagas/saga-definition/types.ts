export type StepInvokeCallback<
  Data = unknown,
  PrevResultData = unknown,
  ResultData = unknown
> = (
  data: Data,
  prevResult: PrevResultData
) => Promise<ResultData> | ResultData

export type StepCompensateCallback<
  Data = unknown,
  TaskData = unknown,
  ResultData = unknown
> = (data: Data, taskData: TaskData) => Promise<ResultData> | ResultData
