import { SagaAlreadyRunningError, SagaNotRunningError } from "@/errors"
import { Result, ResultError, ResultOk } from "@/Result"
import { SagaLog } from "./types"
import { SagaCoordinator } from "./SagaCoordinator"
import { SagaMessage } from "./SagaMessage"

interface InMemorySagaData {
  messages: SagaMessage[]
  createdAt: Date
  updatedAt: Date
}

export class InMemorySagaLog implements SagaLog {
  private sagas: Record<string, InMemorySagaData>

  constructor() {
    this.sagas = {}
  }

  async getMessages(
    sagaId: string
  ): Promise<ResultOk<SagaMessage[]> | ResultError<SagaNotRunningError>> {
    const sagaData = this.sagas[sagaId]

    if (!sagaData) {
      return Result.error(
        new SagaNotRunningError("saga has not started yet", {
          sagaId,
        })
      )
    }

    return Result.ok(sagaData.messages)
  }

  async getActiveSagaIds(): Promise<ResultOk<string[]>> {
    const sagaIds = Object.keys(this.sagas)
    return Result.ok(sagaIds)
  }

  async startSaga<D>(
    sagaId: string,
    job: D
  ): Promise<ResultOk | ResultError<SagaAlreadyRunningError>> {
    const sagaData = this.sagas[sagaId]
    if (sagaData) {
      return Result.error(
        new SagaAlreadyRunningError("saga has already been started", { sagaId })
      )
    }

    const msg = SagaMessage.createStartSagaMessage(sagaId, job)

    const now = new Date()
    this.sagas[sagaId] = {
      messages: [msg],
      createdAt: now,
      updatedAt: now,
    }

    return Result.ok()
  }

  async logMessage(
    msg: SagaMessage
  ): Promise<ResultOk | ResultError<SagaNotRunningError>> {
    const sagaData = this.sagas[msg.sagaId]

    if (!sagaData) {
      return Result.error(
        new SagaNotRunningError("saga has not started yet", {
          sagaId: msg.sagaId,
          taskId: msg.taskId,
        })
      )
    }

    sagaData.messages.push(msg)
    sagaData.updatedAt = new Date()

    return Result.ok()
  }

  /**
   * Delete a saga from memory
   */
  deleteSaga(sagaId: string): ResultOk | ResultError {
    if (this.sagas[sagaId]) {
      delete this.sagas[sagaId]
      return Result.ok()
    }
    return Result.error(new SagaNotRunningError("saga not found", { sagaId }))
  }

  /**
   * Delete sagas older than a specific date
   * Useful for cleaning up old completed or abandoned sagas
   */
  deleteOldSagas(olderThan: Date): ResultOk<number> {
    let deletedCount = 0
    for (const sagaId in this.sagas) {
      if (this.sagas[sagaId].updatedAt < olderThan) {
        delete this.sagas[sagaId]
        deletedCount++
      }
    }
    return Result.ok(deletedCount)
  }

  /**
   * Get sagas that haven't been updated since a specific date
   * Useful for finding stale or abandoned sagas
   */
  getStaleSagaIds(olderThan: Date): ResultOk<string[]> {
    const staleIds: string[] = []
    for (const sagaId in this.sagas) {
      if (this.sagas[sagaId].updatedAt < olderThan) {
        staleIds.push(sagaId)
      }
    }
    return Result.ok(staleIds)
  }

  static createInMemorySagaCoordinator() {
    const log = new InMemorySagaLog()
    return SagaCoordinator.create(log)
  }
}
