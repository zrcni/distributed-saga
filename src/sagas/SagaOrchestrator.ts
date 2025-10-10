import { EventEmitter } from "events"
import { SagaDefinition } from "@/sagas/saga-definition/SagaDefinition"
import { Saga } from "./Saga"
import { SagaStep } from "./saga-definition/SagaStep"

export class SagaOrchestrator extends EventEmitter {
  private async findCurrentStepIndex<StartPayload>(
    saga: Saga<StartPayload>,
    sagaDefinition: SagaDefinition
  ): Promise<number> {
    let currentStepIndex = -1

    for (const step of sagaDefinition.steps) {
      currentStepIndex += 1

      if (step.isStart) {
        continue
      }
      if (step.isEnd) {
        break
      }

      if (!(await saga.isTaskStarted(step.taskName))) {
        break
      }
    }

    return currentStepIndex
  }

  async run<StartPayload = unknown>(
    saga: Saga<StartPayload>,
    sagaDefinition: SagaDefinition
  ): Promise<Saga<StartPayload>> {
    if (await saga.isSagaCompleted()) {
      return saga
    }
    if (await saga.isSagaAborted()) {
      return this.compensate(saga, sagaDefinition)
    }

    const currentStepIndex = await this.findCurrentStepIndex(
      saga,
      sagaDefinition
    )

    const data = await saga.getJob()
    try {
      this.emit("sagaStarted", {
        sagaId: saga.sagaId,
        data,
      })
      return await this.executeSteps(
        saga,
        sagaDefinition,
        currentStepIndex,
        data
      )
    } catch (err) {
      const step = sagaDefinition.steps[currentStepIndex]
      this.emit("taskFailed", {
        sagaId: saga.sagaId,
        data,
        taskName: step.taskName,
        error: err,
      })
      this.emit("sagaFailed", {
        sagaId: saga.sagaId,
        data,
        error: err,
      })
      await saga.abortSaga()
      await this.compensate(saga, sagaDefinition)
      return saga
    }
  }

  private async executeSteps<StartPayload>(
    saga: Saga<StartPayload>,
    sagaDefinition: SagaDefinition,
    startIndex: number,
    data: unknown
  ): Promise<Saga<StartPayload>> {
    let prevStepResult: unknown = null
    let prevStep: SagaStep | null = null

    for (let i = startIndex; i < sagaDefinition.steps.length; i++) {
      const step = sagaDefinition.steps[i]

      if (step.isStart) {
        prevStep = step
        continue
      }

      if (step.isEnd) {
        const endSagaResult = await saga.endSaga()
        if (endSagaResult.isError()) {
          throw endSagaResult.data
        }
        this.emit("sagaSucceeded", {
          sagaId: saga.sagaId,
          data,
        })
        return saga
      }

      // Get previous step result if exists
      if (prevStep && !prevStep.isStart) {
        prevStepResult = await saga.getEndTaskData(prevStep.taskName)
      }

      const startTaskResult = await saga.startTask(
        step.taskName,
        prevStepResult
      )
      if (startTaskResult.isError()) {
        throw startTaskResult.data
      }

      this.emit("taskStarted", {
        sagaId: saga.sagaId,
        data,
        taskName: step.taskName,
      })
      const result = await step.invokeCallback(data, prevStepResult)
      const endTaskResult = await saga.endTask(step.taskName, result)

      if (endTaskResult.isError()) {
        throw endTaskResult.data
      }

      this.emit("taskSucceeded", {
        sagaId: saga.sagaId,
        data,
        taskName: step.taskName,
      })

      prevStep = step
      prevStepResult = result
    }

    return saga
  }

  private async compensate<StartPayload>(
    saga: Saga<StartPayload>,
    sagaDefinition: SagaDefinition
  ): Promise<Saga<StartPayload>> {
    const data = await saga.getJob()

    for (let i = sagaDefinition.steps.length - 1; i >= 0; i--) {
      const step = sagaDefinition.steps[i]

      if (step.isStart || step.isEnd) {
        continue
      }

      if (await saga.isTaskCompleted(step.taskName)) {
        const taskData = await saga.getEndTaskData(step.taskName)
        const startCompResult = await saga.startCompensatingTask(
          step.taskName,
          taskData
        )
        if (startCompResult.isError()) {
          throw startCompResult.data
        }

        this.emit("compensationStarted", {
          sagaId: saga.sagaId,
          data,
          taskName: step.taskName,
        })

        try {
          const result = await step.compensateCallback(data, taskData)
          this.emit("compensationSucceeded", {
            sagaId: saga.sagaId,
            data,
            taskName: step.taskName,
          })
          await saga.endCompensatingTask(step.taskName, result)
        } catch (err) {
          this.emit("compensationFailed", {
            sagaId: saga.sagaId,
            data,
            taskName: step.taskName,
            error: err,
          })
          // continue compensating other tasks even if one fails
        }
      }
    }

    return saga
  }
}
