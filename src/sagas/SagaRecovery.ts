import { InvalidSagaStateError } from "@/errors"
import { SagaCoordinator } from "./SagaCoordinator"
import { SagaMessageType } from "./SagaMessage"
import { SagaState } from "./SagaState"
import { updateSagaState, validateSagaUpdate } from "./saga-state-update"

export enum SagaRecoveryType {
  ForwardRecovery = 0,
  RollbackRecovery = 1,
}

export class SagaRecovery {
  static async recoverState(sagaId: string, sagaCoordinator: SagaCoordinator): Promise<SagaState | null> {
    const messages = await sagaCoordinator.log.getMessages(sagaId)

    if (messages.length === 0) {
      return null
    }

    const startMsg = messages[0]
    if (startMsg.msgType !== SagaMessageType.StartSaga) {
      throw new InvalidSagaStateError("StartSaga must be the first message", {
        sagaId,
      })
    }

    const state = SagaState.create(sagaId, startMsg.data, startMsg.parentSagaId ?? null, startMsg.parentTaskId ?? null)

    for (const msg of messages) {
      if (msg.msgType === SagaMessageType.StartSaga) {
        continue
      }

      const error = validateSagaUpdate(state, msg)
      if (error) {
        throw error
      }

      updateSagaState(state, msg)
    }

    return state
  }

  static isSagaInSafeState(state: SagaState) {
    if (state.isSagaAborted()) {
      return true
    }

    for (const taskId in state.taskStatus) {
      if (state.isTaskStarted(taskId) && !state.isTaskCompleted(taskId)) {
        return false
      }
    }

    return true
  }
}
