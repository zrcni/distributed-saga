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

  /**
   * Abort a saga and all its child sagas recursively.
   * This is useful for aborting an entire saga hierarchy from the root.
   * 
   * @param sagaId - The saga ID to abort
   * @param useTransaction - Whether to use a database transaction (if supported)
   * @returns Result indicating success or failure
   */
  async abortSagaWithChildren(sagaId: string, useTransaction = false): Promise<Result | Result<Error>> {
    // If transactions are requested and supported, use them
    if (useTransaction && this.log.beginTransaction) {
      return this.abortSagaWithChildrenInTransaction(sagaId)
    }

    // Otherwise, use the non-transactional approach
    return this.abortSagaWithChildrenNonTransactional(sagaId)
  }

  /**
   * Internal: Abort saga and children with transaction support
   */
  private async abortSagaWithChildrenInTransaction(sagaId: string): Promise<Result | Result<Error>> {
    if (!this.log.beginTransaction || !this.log.commitTransaction || !this.log.abortTransaction) {
      return Result.error(new Error("Transaction methods not available on this SagaLog implementation"))
    }

    const session = await this.log.beginTransaction()
    
    try {
      // Perform the abort within the transaction
      const result = await this.abortSagaWithChildrenRecursive(sagaId, session)
      
      if (result.isError()) {
        await this.log.abortTransaction(session)
        return result
      }

      await this.log.commitTransaction(session)
      return result
    } catch (error) {
      await this.log.abortTransaction(session)
      return Result.error(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Internal: Abort saga and children without transaction support
   */
  private async abortSagaWithChildrenNonTransactional(sagaId: string): Promise<Result | Result<Error>> {
    return this.abortSagaWithChildrenRecursive(sagaId)
  }

  /**
   * Internal: Recursively abort saga and all children
   */
  private async abortSagaWithChildrenRecursive(sagaId: string, session?: any): Promise<Result | Result<Error>> {
    // First, recursively abort all child sagas
    const childSagaIdsResult = await this.log.getChildSagaIds(sagaId, session ? { session } : undefined)
    if (childSagaIdsResult.isOk() && !childSagaIdsResult.isError()) {
      const childSagaIds = childSagaIdsResult.data as string[]
      for (const childId of childSagaIds) {
        // Recursively abort each child (which will abort their children too)
        await this.abortSagaWithChildrenRecursive(childId, session)
      }
    }

    // Then abort the saga itself
    const recoverResult = await this.recoverSagaState(
      sagaId,
      SagaRecoveryType.RollbackRecovery
    )

    if (recoverResult.isError()) {
      return recoverResult
    }

    const saga = recoverResult.data
    const abortResult = await saga.abortSaga()
    
    return abortResult
  }

  /**
   * Delete a saga and all its child sagas recursively.
   * This is useful for cleaning up an entire saga hierarchy.
   * 
   * @param sagaId - The saga ID to delete
   * @param useTransaction - Whether to use a database transaction (if supported)
   * @returns Result indicating success or failure
   */
  async deleteSagaWithChildren(sagaId: string, useTransaction = false): Promise<Result | Result<Error>> {
    // If transactions are requested and supported, use them
    if (useTransaction && this.log.beginTransaction) {
      return this.deleteSagaWithChildrenInTransaction(sagaId)
    }

    // Otherwise, use the non-transactional approach
    return this.deleteSagaWithChildrenNonTransactional(sagaId)
  }

  /**
   * Internal: Delete saga and children with transaction support
   */
  private async deleteSagaWithChildrenInTransaction(sagaId: string): Promise<Result | Result<Error>> {
    if (!this.log.beginTransaction || !this.log.commitTransaction || !this.log.abortTransaction) {
      return Result.error(new Error("Transaction methods not available on this SagaLog implementation"))
    }

    const session = await this.log.beginTransaction()
    
    try {
      // Perform the delete within the transaction
      const result = await this.deleteSagaWithChildrenRecursive(sagaId, session)
      
      if (result.isError()) {
        await this.log.abortTransaction(session)
        return result
      }

      await this.log.commitTransaction(session)
      return result
    } catch (error) {
      await this.log.abortTransaction(session)
      return Result.error(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Internal: Delete saga and children without transaction support
   */
  private async deleteSagaWithChildrenNonTransactional(sagaId: string): Promise<Result | Result<Error>> {
    return this.deleteSagaWithChildrenRecursive(sagaId)
  }

  /**
   * Internal: Recursively delete saga and all children
   */
  private async deleteSagaWithChildrenRecursive(sagaId: string, session?: any): Promise<Result | Result<Error>> {
    // First, recursively delete all child sagas
    const childSagaIdsResult = await this.log.getChildSagaIds(sagaId, session ? { session } : undefined)
    if (childSagaIdsResult.isOk() && !childSagaIdsResult.isError()) {
      const childSagaIds = childSagaIdsResult.data as string[]
      for (const childId of childSagaIds) {
        // Recursively delete each child (which will delete their children too)
        await this.deleteSagaWithChildrenRecursive(childId, session)
      }
    }

    // Then delete the saga itself
    const deleteResult = await this.log.deleteSaga(sagaId, session ? { session } : undefined)
    
    return deleteResult
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
