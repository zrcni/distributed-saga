import { ResultError, ResultOk } from "@/Result"
import { SagaMessage } from "./SagaMessage"

/**
 * Options for saga operations that support transactions
 */
export interface SagaLogTransactionOptions {
  /** Database transaction session (e.g., MongoDB ClientSession) */
  session?: any
}

export interface SagaLog {
  startSaga<D>(
    sagaId: string,
    job: D,
    parentSagaId?: string | null,
    parentTaskId?: string | null
  ): Promise<ResultOk | ResultError>
  logMessage(msg: SagaMessage): Promise<ResultOk | ResultError>
  getMessages(sagaId: string): Promise<ResultOk<SagaMessage[]> | ResultError>
  getActiveSagaIds(): Promise<ResultOk<string[]> | ResultError>
  getChildSagaIds(parentSagaId: string, options?: SagaLogTransactionOptions): Promise<ResultOk<string[]> | ResultError>
  deleteSaga(sagaId: string, options?: SagaLogTransactionOptions): Promise<ResultOk | ResultError> | ResultOk | ResultError
  
  /**
   * Optional: Begin a transaction. Returns a session object that can be passed to other methods.
   * Not all implementations support transactions.
   */
  beginTransaction?(): Promise<any>
  
  /**
   * Optional: Commit a transaction.
   * Not all implementations support transactions.
   */
  commitTransaction?(session: any): Promise<void>
  
  /**
   * Optional: Rollback/abort a transaction.
   * Not all implementations support transactions.
   */
  abortTransaction?(session: any): Promise<void>
}
