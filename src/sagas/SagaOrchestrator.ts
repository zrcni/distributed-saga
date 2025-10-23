import { EventEmitter } from "events"
import { SagaDefinition } from "@/sagas/saga-definition/SagaDefinition"
import { Saga } from "./Saga"
import { SagaStep } from "./saga-definition/SagaStep"
import {
  WritableSagaContext,
  TaskContext,
  CompensationContext,
} from "./saga-definition/types"

// Event types for SagaOrchestrator
export interface SagaOrchestratorEvents {
  sagaStarted: { sagaId: string; data: unknown }
  sagaSucceeded: { sagaId: string; data: unknown }
  sagaFailed: { sagaId: string; data: unknown; error: unknown }
  taskStarted: { sagaId: string; data: unknown; taskName: string }
  taskSucceeded: { sagaId: string; data: unknown; taskName: string }
  taskFailed: {
    sagaId: string
    data: unknown
    taskName: string
    error: unknown
  }
  optionalTaskFailed: {
    sagaId: string
    data: unknown
    taskName: string
    error: unknown
  }
  middlewareSucceeded: {
    sagaId: string
    data: unknown
    taskName: string
    middlewareData: Record<string, unknown>
  }
  middlewareFailed: {
    sagaId: string
    data: unknown
    taskName: string
    error: unknown
  }
  compensationStarted: { sagaId: string; data: unknown; taskName: string }
  compensationSucceeded: { sagaId: string; data: unknown; taskName: string }
  compensationFailed: {
    sagaId: string
    data: unknown
    taskName: string
    error: unknown
  }
}

export interface SagaOrchestrator {
  on<K extends keyof SagaOrchestratorEvents>(
    event: K,
    listener: (event: SagaOrchestratorEvents[K]) => void
  ): this
  once<K extends keyof SagaOrchestratorEvents>(
    event: K,
    listener: (event: SagaOrchestratorEvents[K]) => void
  ): this
  emit<K extends keyof SagaOrchestratorEvents>(
    event: K,
    data: SagaOrchestratorEvents[K]
  ): boolean
  off<K extends keyof SagaOrchestratorEvents>(
    event: K,
    listener: (event: SagaOrchestratorEvents[K]) => void
  ): this
  removeAllListeners(event?: keyof SagaOrchestratorEvents): this
}

export class SagaOrchestrator extends EventEmitter {
  /**
   * Create a writable saga context for task callbacks
   */
  private createWritableContext<StartPayload>(
    saga: Saga<StartPayload>
  ): WritableSagaContext {
    return {
      get: <T = Record<string, any>>() => saga.getSagaContext<T>(),
      update: async (updates: Record<string, any>) => {
        await saga.updateSagaContext(updates)
      },
    }
  }

  /**
   * Create a TaskContext object for invoke and middleware callbacks
   */
  private createTaskContext<StartPayload, PrevResultData, MiddlewareData>(
    saga: Saga<StartPayload>,
    prevResult: PrevResultData,
    middlewareData: MiddlewareData
  ): TaskContext<PrevResultData, MiddlewareData> {
    return {
      prev: prevResult,
      middleware: middlewareData,
      api: saga.asReadOnly(),
      sagaId: saga.sagaId,
      parentSagaId: saga.state.parentSagaId,
      parentTaskId: saga.state.parentTaskId,
      ctx: this.createWritableContext(saga),
    }
  }

  /**
   * Create a CompensationContext object for compensate callbacks
   */
  private createCompensationContext<StartPayload, TaskData, MiddlewareData>(
    saga: Saga<StartPayload>,
    taskData: TaskData,
    middlewareData: MiddlewareData
  ): CompensationContext<TaskData, MiddlewareData> {
    return {
      taskData,
      middleware: middlewareData,
      api: saga.asReadOnly(),
      sagaId: saga.sagaId,
      parentSagaId: saga.state.parentSagaId,
      parentTaskId: saga.state.parentTaskId,
      ctx: this.createWritableContext(saga),
    }
  }

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

      // Check if task is completed, not just started
      // This ensures that a task that was started but not completed
      // (e.g., due to server crash) will be retried
      if (!(await saga.isTaskCompleted(step.taskName))) {
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
        await saga.endSaga()
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

      // Run middleware before starting the task and collect results
      let middlewareData: Record<string, unknown> = {}
      if (step.middleware.length > 0) {
        try {
          middlewareData = await this.runMiddleware(
            step,
            data,
            prevStepResult,
            saga
          )
          this.emit("middlewareSucceeded", {
            sagaId: saga.sagaId,
            data,
            taskName: step.taskName,
            middlewareData,
          })
        } catch (err) {
          this.emit("middlewareFailed", {
            sagaId: saga.sagaId,
            data,
            taskName: step.taskName,
            error: err,
          })
          throw err
        }
      }

      // Only start the task if it hasn't been started yet
      // This handles recovery scenarios where a task was started but not completed
      if (!(await saga.isTaskStarted(step.taskName))) {
        await saga.startTask(step.taskName, prevStepResult, {
          isOptional: step.isOptional
        })

        this.emit("taskStarted", {
          sagaId: saga.sagaId,
          data,
          taskName: step.taskName,
        })
      }

      try {
        const taskContext = this.createTaskContext(
          saga,
          prevStepResult,
          middlewareData
        )
        const result = await step.invokeCallback(data, taskContext)
        await saga.endTask(step.taskName, result)

        this.emit("taskSucceeded", {
          sagaId: saga.sagaId,
          data,
          taskName: step.taskName,
        })

        prevStep = step
        prevStepResult = result
      } catch (err) {
        if (step.isOptional) {
          // For optional tasks, log the error and continue
          this.emit("optionalTaskFailed", {
            sagaId: saga.sagaId,
            data,
            taskName: step.taskName,
            error: err,
          })
          
          // Mark the task as completed with null to indicate optional failure
          // Store error marker for debugging/monitoring purposes
          await saga.endTask(step.taskName, null)
          
          // Store error information in saga context for debugging if needed
          const ctx = this.createWritableContext(saga)
          await ctx.update((current) => ({
            ...current,
            [`__optionalTaskErrors__`]: {
              ...(current[`__optionalTaskErrors__`] as Record<string, any> || {}),
              [step.taskName]: {
                __optionalTaskFailed: true,
                error: err instanceof Error ? err.message : String(err)
              }
            }
          }))
          
          prevStep = step
          prevStepResult = null // Optional task failures don't provide results
        } else {
          // For required tasks, throw the error to trigger saga failure
          throw err
        }
      }
    }

    return saga
  }

  private async runMiddleware<StartPayload>(
    step: SagaStep,
    data: unknown,
    prevStepResult: unknown,
    saga: Saga<StartPayload>
  ): Promise<Record<string, unknown>> {
    let accumulatedData: Record<string, unknown> = {}

    for (const middlewareCallback of step.middleware) {
      const taskContext = this.createTaskContext(
        saga,
        prevStepResult,
        accumulatedData
      )
      const result = await middlewareCallback(data, taskContext)

      // If middleware returns false explicitly, throw an error
      if (result === false) {
        throw new Error(`Middleware failed for step "${step.taskName}"`)
      }

      // If middleware returns an object (not true, not void, not false), merge it
      if (result && result !== true && typeof result === "object") {
        accumulatedData = {
          ...accumulatedData,
          ...(result as Record<string, unknown>),
        }
      }
    }

    return accumulatedData
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
        await saga.startCompensatingTask(step.taskName, taskData)

        this.emit("compensationStarted", {
          sagaId: saga.sagaId,
          data,
          taskName: step.taskName,
        })

        try {
          const compensationContext = this.createCompensationContext(
            saga,
            taskData,
            {}
          )
          const result = await step.compensateCallback(
            data,
            compensationContext
          )
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
