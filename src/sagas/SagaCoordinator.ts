import { Result } from "@/Result"
import { SagaLog } from "./types"
import { Saga } from "./Saga"
import { SagaRecovery, SagaRecoveryType } from "./SagaRecovery"

export class SagaCoordinator {
  log: SagaLog

  constructor(log: SagaLog) {
    this.log = log
  }

  async createSaga<D = unknown>(sagaId: string, job: D) {
    return Saga.create<D>(sagaId, job, this.log)
  }

  getActiveSagaIds() {
    return this.log.getActiveSagaIds()
  }

  async recoverSagaState<D = unknown>(
    sagaId: string,
    recoveryType: SagaRecoveryType
  ): Promise<Result<Saga<D>> | Result<Error>> {
    const result = await SagaRecovery.recoverState(sagaId, this)
    if (result.isError()) {
      return result
    }

    const state = result.data

    const saga = await Saga.rehydrateSaga<D>(sagaId, state, this.log)

    switch (recoveryType) {
      case SagaRecoveryType.RollbackRecovery: {
        if (!SagaRecovery.isSagaInSafeState(state)) {
          const result = await saga.abortSaga()
          if (result.isError()) {
            return result
          }
        }
      }

      case SagaRecoveryType.ForwardRecovery: {
        // Nothing to do here (TODO: why? xd)
      }
    }

    return Result.ok(saga)
  }

  static create(log: SagaLog) {
    return new SagaCoordinator(log)
  }
}
