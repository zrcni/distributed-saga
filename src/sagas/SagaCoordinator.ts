import { Result } from "@/Result"
import { SagaLog } from "./types"
import { Saga } from "./Saga"
import { SagaRecovery, SagaRecoveryType } from "./SagaRecovery"

export class SagaCoordinator {
  log: SagaLog

  constructor(log: SagaLog) {
    this.log = log
  }

  async createSaga<D = unknown>(sagaId: string, job: D, parentSagaId?: string | null) {
    return Saga.create<D>(sagaId, job, this.log, parentSagaId ?? null)
  }

  async createChildSaga<D = unknown>(parentSagaId: string, parentTaskId: string, sagaId: string, job: D) {
    return Saga.create<D>(sagaId, job, this.log, parentSagaId, parentTaskId)
  }

  getActiveSagaIds() {
    return this.log.getActiveSagaIds()
  }

  getChildSagaIds(parentSagaId: string) {
    return this.log.getChildSagaIds(parentSagaId)
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

  /**
   * Attempts to recover an existing saga by sagaId, or creates a new one if it doesn't exist.
   * This is useful for idempotent saga execution where you want to resume an existing saga
   * if it was interrupted, or start a new one if this is the first attempt.
   * 
   * @param sagaId - Unique identifier for the saga
   * @param job - Initial job data for the saga (used only if creating new)
   * @param recoveryType - Type of recovery to perform if saga exists (default: ForwardRecovery)
   * @param parentSagaId - Optional parent saga ID for nested sagas
   * @returns Result containing the recovered or newly created saga
   */
  async recoverOrCreate<D = unknown>(
    sagaId: string,
    job: D,
    recoveryType: SagaRecoveryType = SagaRecoveryType.ForwardRecovery,
    parentSagaId?: string | null
  ): Promise<Result<Saga<D>> | Result<Error>> {
    // First, try to recover existing saga
    const recoveryResult = await this.recoverSagaState<D>(sagaId, recoveryType)
    
    // If recovery succeeded, return the recovered saga
    if (recoveryResult.isOk()) {
      return recoveryResult
    }

    // If saga doesn't exist or recovery failed, create a new one
    return this.createSaga<D>(sagaId, job, parentSagaId)
  }

  static create(log: SagaLog) {
    return new SagaCoordinator(log)
  }
}
