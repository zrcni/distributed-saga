export enum SagaMessageType {
  StartSaga = "StartSaga",
  EndSaga = "EndSaga",
  AbortSaga = "AbortSaga",
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
}

export class SagaMessage<Data = unknown> {
  sagaId: string
  msgType: SagaMessageType
  data: Data
  taskId?: string

  constructor({ sagaId, msgType, data, taskId }: Params<Data>) {
    this.sagaId = sagaId
    this.msgType = msgType
    this.data = data
    this.taskId = taskId
  }

  static createStartSagaMessage<D = unknown>(sagaId: string, job: D) {
    return new SagaMessage<D>({
      sagaId,
      msgType: SagaMessageType.StartSaga,
      data: job,
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

  static createStartTaskMessage<D = unknown>(
    sagaId: string,
    taskId: string,
    data: D
  ) {
    return new SagaMessage<D>({
      sagaId,
      msgType: SagaMessageType.StartTask,
      taskId,
      data,
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
