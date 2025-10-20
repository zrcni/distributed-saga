import { ResultError, ResultOk } from "@/Result"
import { SagaMessage } from "./SagaMessage"

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
  getChildSagaIds(parentSagaId: string): Promise<ResultOk<string[]> | ResultError>
}
