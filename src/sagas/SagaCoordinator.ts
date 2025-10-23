import { SagaLog } from "./types"
import { Saga } from "./Saga"
import { SagaRecovery, SagaRecoveryType } from "./SagaRecovery"
import { SagaState } from "./SagaState"

export class SagaCoordinator {
  log: SagaLog

  constructor(log: SagaLog) {
    this.log = log
  }

  async createSaga<D = unknown>(
    sagaId: string, 
    job: D, 
    parent?: { parentSagaId: string; parentTaskId: string } | null
  ) {
    const parentSagaId = parent?.parentSagaId ?? null
    const parentTaskId = parent?.parentTaskId ?? null
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
   */
  async abortSagaWithChildren(sagaId: string, useTransaction = false): Promise<void> {
    // If transactions are requested and supported, use them
    if (useTransaction && this.log.beginTransaction) {
      await this.abortSagaWithChildrenInTransaction(sagaId)
    } else {
      // Otherwise, use the non-transactional approach
      await this.abortSagaWithChildrenNonTransactional(sagaId)
    }
  }

  /**
   * Internal: Abort saga and children with transaction support
   */
  private async abortSagaWithChildrenInTransaction(sagaId: string): Promise<void> {
    if (!this.log.beginTransaction || !this.log.commitTransaction || !this.log.abortTransaction) {
      throw new Error("Transaction methods not available on this SagaLog implementation")
    }

    const session = await this.log.beginTransaction()
    
    try {
      // Perform the abort within the transaction
      await this.abortSagaWithChildrenRecursive(sagaId, session)
      await this.log.commitTransaction(session)
    } catch (error) {
      await this.log.abortTransaction(session)
      throw error
    }
  }

  /**
   * Internal: Abort saga and children without transaction support
   */
  private async abortSagaWithChildrenNonTransactional(sagaId: string): Promise<void> {
    await this.abortSagaWithChildrenRecursive(sagaId)
  }

  /**
   * Internal: Recursively abort saga and all children
   */
  private async abortSagaWithChildrenRecursive(sagaId: string, session?: any): Promise<void> {
    // First, recursively abort all child sagas
    const childSagaIds = await this.log.getChildSagaIds(sagaId, session ? { session } : undefined)
    for (const childId of childSagaIds) {
      // Recursively abort each child (which will abort their children too)
      await this.abortSagaWithChildrenRecursive(childId, session)
    }

    // Then abort the saga itself
    const saga = await this.recoverSagaState(sagaId, SagaRecoveryType.RollbackRecovery)
    await saga.abortSaga()
  }

  /**
   * Delete a saga and all its child sagas recursively.
   * This is useful for cleaning up an entire saga hierarchy.
   * 
   * @param sagaId - The saga ID to delete
   * @param useTransaction - Whether to use a database transaction (if supported)
   */
  async deleteSagaWithChildren(sagaId: string, useTransaction = false): Promise<void> {
    // If transactions are requested and supported, use them
    if (useTransaction && this.log.beginTransaction) {
      await this.deleteSagaWithChildrenInTransaction(sagaId)
    } else {
      // Otherwise, use the non-transactional approach
      await this.deleteSagaWithChildrenNonTransactional(sagaId)
    }
  }

  /**
   * Internal: Delete saga and children with transaction support
   */
  private async deleteSagaWithChildrenInTransaction(sagaId: string): Promise<void> {
    if (!this.log.beginTransaction || !this.log.commitTransaction || !this.log.abortTransaction) {
      throw new Error("Transaction methods not available on this SagaLog implementation")
    }

    const session = await this.log.beginTransaction()
    
    try {
      // Perform the delete within the transaction
      await this.deleteSagaWithChildrenRecursive(sagaId, session)
      await this.log.commitTransaction(session)
    } catch (error) {
      await this.log.abortTransaction(session)
      throw error
    }
  }

  /**
   * Internal: Delete saga and children without transaction support
   */
  private async deleteSagaWithChildrenNonTransactional(sagaId: string): Promise<void> {
    await this.deleteSagaWithChildrenRecursive(sagaId)
  }

  /**
   * Internal: Recursively delete saga and all children
   */
  private async deleteSagaWithChildrenRecursive(sagaId: string, session?: any): Promise<void> {
    // First, recursively delete all child sagas
    const childSagaIds = await this.log.getChildSagaIds(sagaId, session ? { session } : undefined)
    for (const childId of childSagaIds) {
      // Recursively delete each child (which will delete their children too)
      await this.deleteSagaWithChildrenRecursive(childId, session)
    }

    // Then delete the saga itself
    await this.log.deleteSaga(sagaId, session ? { session } : undefined)
  }

  async recoverSagaState<D = unknown>(
    sagaId: string,
    recoveryType: SagaRecoveryType
  ): Promise<Saga<D>> {
    const state = await SagaRecovery.recoverState(sagaId, this)
    
    if (!state) {
      throw new Error(`Failed to recover saga state for ${sagaId}`)
    }
    
    const saga = await Saga.rehydrateSaga<D>(sagaId, state as SagaState<D>, this.log)

    switch (recoveryType) {
      case SagaRecoveryType.RollbackRecovery: {
        if (!SagaRecovery.isSagaInSafeState(state)) {
          await saga.abortSaga()
        }
        break
      }

      case SagaRecoveryType.ForwardRecovery: {
        // Nothing to do here (TODO: why? xd)
        break
      }
    }

    return saga
  }

  /**
   * Attempts to recover an existing saga by sagaId, or creates a new one if it doesn't exist.
   * This is useful for idempotent saga execution where you want to resume an existing saga
   * if it was interrupted, or start a new one if this is the first attempt.
   * 
   * @param sagaId - Unique identifier for the saga
   * @param job - Initial job data for the saga (used only if creating new)
   * @param recoveryType - Type of recovery to perform if saga exists (default: ForwardRecovery)
   * @param parent - Optional parent saga information for nested sagas
   * @returns The recovered or newly created saga
   */
  async recoverOrCreate<D = unknown>(
    sagaId: string,
    job: D,
    recoveryType: SagaRecoveryType = SagaRecoveryType.ForwardRecovery,
    parent?: { parentSagaId: string; parentTaskId: string } | null
  ): Promise<Saga<D>> {
    try {
      // First, try to recover existing saga
      return await this.recoverSagaState<D>(sagaId, recoveryType)
    } catch (error) {
      // If saga doesn't exist or recovery failed, create a new one
      return this.createSaga<D>(sagaId, job, parent)
    }
  }

  static create(log: SagaLog) {
    return new SagaCoordinator(log)
  }
}