import { SagaAlreadyRunningError, SagaNotRunningError } from "@/errors"
import { logger } from "@/logger"
import { Result, ResultError, ResultOk } from "@/Result"
import { SagaLog } from "./types"
import { SagaCoordinator } from "./SagaCoordinator"
import { SagaMessage } from "./SagaMessage"

export class InMemorySagaLog implements SagaLog {
  private sagas: Record<string, SagaMessage[]>

  constructor() {
    this.sagas = {}
  }

  async getMessages(
    sagaId: string
  ): Promise<ResultOk<SagaMessage[]> | ResultError<SagaNotRunningError>> {
    const messages = this.sagas[sagaId]

    if (!messages) {
      return Result.error(
        new SagaNotRunningError("saga has not started yet", {
          sagaId,
        })
      )
    }

    return Result.ok(messages)
  }

  async getActiveSagaIds(): Promise<ResultOk<string[]>> {
    const sagaIds = Object.keys(this.sagas)
    return Result.ok(sagaIds)
  }

  async startSaga<D>(
    sagaId: string,
    job: D
  ): Promise<ResultOk | ResultError<SagaAlreadyRunningError>> {
    logger.info(`Start saga ${sagaId}`)

    const messages = this.sagas[sagaId]
    if (messages) {
      return Result.error(
        new SagaAlreadyRunningError("saga has already been started", { sagaId })
      )
    }

    const msg = SagaMessage.createStartSagaMessage(sagaId, job)

    this.sagas[sagaId] = [msg]

    return Result.ok()
  }

  async logMessage(
    msg: SagaMessage
  ): Promise<ResultOk | ResultError<SagaNotRunningError>> {
    logger.info(
      `Saga ${msg.sagaId}: ${msg.msgType}${msg.taskId ? ` ${msg.taskId}` : ""}`
    )

    const messages = this.sagas[msg.sagaId]

    if (!messages) {
      return Result.error(
        new SagaNotRunningError("saga has not started yet", {
          sagaId: msg.sagaId,
          taskId: msg.taskId,
        })
      )
    }

    this.sagas[msg.sagaId].push(msg)

    return Result.ok()
  }

  static createInMemorySagaCoordinator() {
    const log = new InMemorySagaLog()
    return SagaCoordinator.create(log)
  }
}
