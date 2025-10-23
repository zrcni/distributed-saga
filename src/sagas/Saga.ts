import ms from "ms"
import { CancelablePromise } from "cancelable-promise"
import EventEmitter from "events"
import { SagaMessage, SagaMessageType } from "./SagaMessage"
import { SagaState } from "./SagaState"
import { updateSagaState, validateSagaUpdate } from "./saga-state-update"
import { timeout } from "@/utils"
import { SagaLog } from "./types"
import { ReadOnlySaga } from "./saga-definition/types"

export class Saga<StartPayload = unknown> {
  sagaId: string
  state: SagaState<StartPayload>
  log: SagaLog
  loopPromise?: CancelablePromise
  emitter: EventEmitter

  constructor(sagaId: string, state: SagaState<StartPayload>, log: SagaLog) {
    this.sagaId = sagaId
    this.state = state
    this.log = log
    this.emitter = new EventEmitter()
  }

  /**
   * Returns a read-only view of this saga instance.
   * This is safe to pass to step callbacks to allow them to read task data
   * without being able to modify the saga state.
   */
  asReadOnly(): ReadOnlySaga {
    return {
      sagaId: this.sagaId,
      getJob: () => this.getJob(),
      getTaskIds: () => this.getTaskIds(),
      isTaskStarted: (taskId: string) => this.isTaskStarted(taskId),
      getStartTaskData: (taskId: string) => this.getStartTaskData(taskId),
      isTaskCompleted: (taskId: string) => this.isTaskCompleted(taskId),
      getEndTaskData: <D = unknown>(taskId: string) => this.getEndTaskData<D>(taskId),
      isCompensatingTaskStarted: (taskId: string) => this.isCompensatingTaskStarted(taskId),
      getStartCompensatingTaskData: (taskId: string) => this.getStartCompensatingTaskData(taskId),
      isCompensatingTaskCompleted: (taskId: string) => this.isCompensatingTaskCompleted(taskId),
      getEndCompensatingTaskData: (taskId: string) => this.getEndCompensatingTaskData(taskId),
      isSagaAborted: () => this.isSagaAborted(),
      isSagaCompleted: () => this.isSagaCompleted(),
      getSagaContext: <T = Record<string, any>>() => this.getSagaContext<T>(),
    }
  }

  async getJob() {
    return this.state.job
  }

  async getTaskIds() {
    return this.state.getTaskIds()
  }

  async isTaskStarted(taskId: string) {
    return this.state.isTaskStarted(taskId)
  }

  async getStartTaskData(taskId: string) {
    return this.state.getStartTaskData(taskId)
  }

  async isTaskCompleted(taskId: string) {
    return this.state.isTaskCompleted(taskId)
  }

  async getEndTaskData<D = unknown>(taskId: string) {
    return this.state.getEndTaskData<D>(taskId)
  }

  async isCompensatingTaskStarted(taskId: string) {
    return this.state.isCompensatingTaskStarted(taskId)
  }

  async getStartCompensatingTaskData(taskId: string) {
    return this.state.getStartCompensatingTaskData(taskId)
  }

  async isCompensatingTaskCompleted(taskId: string) {
    return this.state.isCompensatingTaskCompleted(taskId)
  }

  async getEndCompensatingTaskData(taskId: string) {
    return this.state.getEndCompensatingTaskData(taskId)
  }

  async isSagaAborted() {
    return this.state.isSagaAborted()
  }

  async isSagaCompleted() {
    return this.state.isSagaCompleted()
  }

  async getSagaContext<T = Record<string, any>>(): Promise<T> {
    return this.state.getSagaContext<T>()
  }

  async updateSagaContext(updates: Record<string, any>) {
    return this.updateSagaState(
      SagaMessage.createUpdateSagaContextMessage(this.sagaId, updates)
    )
  }

  async endSaga() {
    return this.updateSagaState(SagaMessage.createEndSagaMessage(this.sagaId))
  }

  async abortSaga() {
    return this.updateSagaState(SagaMessage.createAbortSagaMessage(this.sagaId))
  }

  async startTask<D = unknown>(taskId: string, data?: D) {
    return this.updateSagaState(
      SagaMessage.createStartTaskMessage(this.sagaId, taskId, data)
    )
  }

  async endTask<R = unknown>(taskId: string, result: R) {
    return this.updateSagaState(
      SagaMessage.createEndTaskMessage(this.sagaId, taskId, result)
    )
  }

  async startCompensatingTask<D = unknown>(taskId: string, data: D) {
    return this.updateSagaState(
      SagaMessage.createStartCompensatingTaskMessage(this.sagaId, taskId, data)
    )
  }

  async endCompensatingTask<R = unknown>(taskId: string, result: R) {
    return this.updateSagaState(
      SagaMessage.createEndCompensatingTaskMessage(this.sagaId, taskId, result)
    )
  }

  async logMessage(msg: SagaMessage): Promise<void> {
    const error = validateSagaUpdate(this.state, msg)
    if (error) {
      throw error
    }

    await this.log.logMessage(msg)

    updateSagaState(this.state, msg)
  }

  async updateSagaState(msg: SagaMessage): Promise<void> {
    await addMessage(this.emitter, msg)

    if (msg.msgType === SagaMessageType.EndSaga) {
      this.loopPromise?.cancel()
    }
  }

  updateSagaStateLoop() {
    const handleUpdate = this.handleUpdate.bind(this)
    this.loopPromise = new CancelablePromise(
      async (_resolve, _reject, onCancel) => {
        this.emitter.on("message", handleUpdate)

        onCancel(() => {
          this.emitter.off("message", handleUpdate)
        })
      }
    )
  }

  async handleUpdate(msg: SagaMessage) {
    try {
      await this.logMessage(msg)
      this.emitter.emit(`message:${msg.taskId}`, null)
    } catch (error) {
      this.emitter.emit(`message:${msg.taskId}`, error)
    }
  }

  static async rehydrateSaga<D = unknown>(
    sagaId: string,
    state: SagaState<D>,
    log: SagaLog
  ): Promise<Saga<D>> {
    const saga = new Saga<D>(sagaId, state, log)

    if (!state.isSagaCompleted()) {
      saga.updateSagaStateLoop()
    }

    return saga
  }

  static async create<D>(
    sagaId: string,
    job: D,
    log: SagaLog,
    parentSagaId: string | null = null,
    parentTaskId: string | null = null
  ): Promise<Saga<D>> {
    const sagaState = SagaState.create<D>(sagaId, job, parentSagaId, parentTaskId)

    await log.startSaga<D>(sagaId, job, parentSagaId, parentTaskId)

    const saga = new Saga<D>(sagaId, sagaState, log)

    saga.updateSagaStateLoop()

    return saga
  }
}

function addMessage(emitter: EventEmitter, msg: SagaMessage) {
  const promise = timeout(
    new Promise<void>((resolve, reject) => {
      emitter.once(`message:${msg.taskId}`, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    }),
    ms("5s")
  )

  emitter.emit("message", msg)

  return promise
}
