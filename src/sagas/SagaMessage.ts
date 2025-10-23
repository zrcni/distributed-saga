export enum SagaMessageType {
  StartSaga = "StartSaga",
  EndSaga = "EndSaga",
  AbortSaga = "AbortSaga",
  UpdateSagaContext = "UpdateSagaContext",
  StartTask = "StartTask",
  EndTask = "EndTask",
  StartCompensatingTask = "StartCompensatingTask",
  EndCompensatingTask = "EndCompensatingTask",
}

type Params<D> = {
  sagaId: string
  msgType: SagaMessageType
  data?: D
  taskId?: string
  parentSagaId?: string | null
  parentTaskId?: string | null
  timestamp?: Date
  metadata?: Record<string, any>
}

export class SagaMessage<Data = unknown> {
  sagaId: string
  msgType: SagaMessageType
  data: Data
  taskId?: string
  parentSagaId?: string | null
  parentTaskId?: string | null
  timestamp: Date
  metadata?: Record<string, any>

  constructor({ sagaId, msgType, data, taskId, parentSagaId, parentTaskId, timestamp, metadata }: Params<Data>) {
    this.sagaId = sagaId
    this.msgType = msgType
    this.data = data
    this.taskId = taskId
    this.parentSagaId = parentSagaId
    this.parentTaskId = parentTaskId
    this.timestamp = timestamp || new Date()
    this.metadata = metadata
  }

  static createStartSagaMessage<D = unknown>(
    sagaId: string,
    job: D,
    parentSagaId: string | null = null,
    parentTaskId: string | null = null
  ) {
    return new SagaMessage<D>({
      sagaId,
      msgType: SagaMessageType.StartSaga,
      data: job,
      parentSagaId,
      parentTaskId,
    })
  }

  static createEndSagaMessage(sagaId: string) {
    return new SagaMessage({
      sagaId,
      msgType: SagaMessageType.EndSaga,
    })
  }

  static createAbortSagaMessage(sagaId: string) {
    return new SagaMessage({
      sagaId,
      msgType: SagaMessageType.AbortSaga,
    })
  }

  static createUpdateSagaContextMessage(
    sagaId: string,
    contextUpdates: Record<string, any>
  ) {
    return new SagaMessage({
      sagaId,
      msgType: SagaMessageType.UpdateSagaContext,
      data: contextUpdates,
    })
  }

  static createStartTaskMessage<D = unknown>(
    sagaId: string,
    taskId: string,
    data: D,
    metadata?: Record<string, any>
  ) {
    return new SagaMessage<D>({
      sagaId,
      msgType: SagaMessageType.StartTask,
      taskId,
      data,
      metadata,
    })
  }

  static createEndTaskMessage<R = unknown>(
    sagaId: string,
    taskId: string,
    result: R
  ) {
    return new SagaMessage<R>({
      sagaId,
      msgType: SagaMessageType.EndTask,
      taskId,
      data: result,
    })
  }

  static createStartCompensatingTaskMessage<D = unknown>(
    sagaId: string,
    taskId: string,
    data: D
  ) {
    return new SagaMessage<D>({
      sagaId,
      msgType: SagaMessageType.StartCompensatingTask,
      taskId,
      data,
    })
  }

  static createEndCompensatingTaskMessage<R = unknown>(
    sagaId: string,
    taskId: string,
    result: R
  ) {
    return new SagaMessage<R>({
      sagaId,
      msgType: SagaMessageType.EndCompensatingTask,
      taskId,
      data: result,
    })
  }
}
