import { InvalidSagaStateError } from "@/errors"
import { Result } from "@/Result"
import { SagaCoordinator } from "./SagaCoordinator"
import { SagaMessageType } from "./SagaMessage"
import { SagaState } from "./SagaState"
import { updateSagaState, validateSagaUpdate } from "./saga-state-update"

export enum SagaRecoveryType {
  ForwardRecovery = 0,
  RollbackRecovery = 1,
}

export class SagaRecovery {
  static async recoverState(sagaId: string, sagaCoordinator: SagaCoordinator) {
    const result = await sagaCoordinator.log.getMessages(sagaId)
    if (result.isError()) {
      return result
    }

    const messages = result.data

    if (messages.length === 0) {
      return Result.ok(null)
    }

    const startMsg = messages[0]
    if (startMsg.msgType !== SagaMessageType.StartSaga) {
      return Result.error(
        new InvalidSagaStateError("StartSaga must be the first message", {
          sagaId,
        })
      )
    }

    const state = SagaState.create(sagaId, startMsg.data)

    for (const msg of messages) {
      if (msg.msgType === SagaMessageType.StartSaga) {
        continue
      }

      const error = validateSagaUpdate(state, msg)
      if (error) {
        return Result.error(error)
      }

      const result = updateSagaState(state, msg)
      if (result.isError()) {
        return result
      }
    }

    return Result.ok(state)
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
