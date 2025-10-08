import { SagaMessageType } from "./SagaMessage"

export enum TaskStatus {
  NotExists = 0,
  TaskStarted = 1,
  TaskCompleted = 2,
  CompensatingTaskStarted = 3,
  CompensatingTaskCompleted = 4,
}

type TaskData = {
  taskStart: any
  taskEnd: any
  compensatingTaskStart: any
  compensatingTaskEnd: any
}

export class SagaState<D = unknown> {
  sagaId: string
  job: D
  taskData: Record<string, TaskData>
  taskStatus: Record<string, TaskStatus>
  sagaAborted: boolean
  sagaCompleted: boolean

  constructor(sagaId: string, job: D) {
    this.sagaId = sagaId
    this.job = job
    this.taskData = {}
    this.taskStatus = {}
    this.sagaAborted = false
    this.sagaCompleted = false
  }

  getTaskIds() {
    return Object.keys(this.taskStatus)
  }

  addTaskData<D = unknown>(taskId: string, msgType: SagaMessageType, data: D) {
    if (!this.taskData[taskId]) {
      this.taskData[taskId] = {
        taskStart: null,
        taskEnd: null,
        compensatingTaskStart: null,
        compensatingTaskEnd: null,
      }
    }

    switch (msgType) {
      case SagaMessageType.StartTask: {
        this.taskData[taskId].taskStart = data
      }

      case SagaMessageType.EndTask: {
        this.taskData[taskId].taskEnd = data
      }

      case SagaMessageType.StartCompensatingTask: {
        this.taskData[taskId].compensatingTaskStart = data
      }

      case SagaMessageType.EndCompensatingTask: {
        this.taskData[taskId].compensatingTaskEnd = data
      }
    }
  }

  isTaskStarted(taskId: string) {
    return this.taskStatus[taskId] >= TaskStatus.TaskStarted
  }

  getStartTaskData(taskId: string) {
    const data = this.taskData[taskId]
    if (!data) {
      return null
    }
    return data.taskStart
  }

  isTaskCompleted(taskId: string) {
    return this.taskStatus[taskId] >= TaskStatus.TaskCompleted
  }

  getEndTaskData<D = unknown>(taskId: string): D | null {
    const data = this.taskData[taskId]
    if (!data) {
      return null
    }
    return data.taskEnd
  }

  isCompensatingTaskStarted(taskId: string) {
    return this.taskStatus[taskId] >= TaskStatus.CompensatingTaskStarted
  }

  getStartCompensatingTaskData(taskId: string) {
    const data = this.taskData[taskId]
    if (!data) {
      return null
    }
    return data.compensatingTaskStart
  }

  isCompensatingTaskCompleted(taskId: string) {
    return this.taskStatus[taskId] === TaskStatus.CompensatingTaskCompleted
  }

  getEndCompensatingTaskData(taskId: string) {
    const data = this.taskData[taskId]
    if (!data) {
      return null
    }
    return data.compensatingTaskEnd
  }

  isSagaAborted() {
    return this.sagaAborted
  }

  isSagaCompleted() {
    return this.sagaCompleted
  }

  static create<D>(sagaId: string, job: D): SagaState<D> {
    return new SagaState(sagaId, job)
  }
}
