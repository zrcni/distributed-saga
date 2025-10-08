import { logger } from "@/logger"
import { SagaDefinition } from "@/sagas/saga-definition/SagaDefinition"
import { Saga } from "./Saga"
import { SagaStep } from "./saga-definition/SagaStep"

type ErrorHandler = (err: Error) => void

export class SagaRunner<StartPayload = unknown> {
  saga: Saga<StartPayload>
  sagaDefinition: SagaDefinition
  currentStepIndex: number
  handleError: ErrorHandler

  constructor(saga: Saga<StartPayload>, sagaDefinition: SagaDefinition) {
    this.saga = saga
    this.sagaDefinition = sagaDefinition
    this.handleError = () => {}
  }

  onError(handleError: (err: Error) => void) {
    this.handleError = handleError
    return this
  }

  private getCurrentStep(): SagaStep | null {
    return this.sagaDefinition.steps[this.currentStepIndex] ?? null
  }

  private getPreviousStep(): SagaStep | null {
    return this.sagaDefinition.steps[this.currentStepIndex - 1] ?? null
  }

  private incrementStep() {
    this.currentStepIndex += 1
  }

  async run() {
    if (await this.saga.isSagaCompleted()) {
      return this.saga
    }
    if (await this.saga.isSagaAborted()) {
      return this.compensate()
    }

    await this.initialize()

    const data = await this.saga.getJob()
    try {
      return await this.iterate(data)
    } catch (err) {
      logger.info(
        `Failed to run task ${this.getCurrentStep().taskName}. Aborting saga...`
      )
      // TODO add error as data to saga, but where?
      this.handleError(err)
      await this.saga.abortSaga()
      await this.compensate()
      return this.saga
    }
  }

  private async initialize() {
    this.currentStepIndex = -1

    for (const step of this.sagaDefinition.steps) {
      this.currentStepIndex += 1

      if (step.isStart) {
        continue
      }
      if (step.isEnd) {
        break
      }

      if (!(await this.saga.isTaskStarted(step.taskName))) {
        break
      }
    }
  }

  private async iterate(data: unknown): Promise<Saga<StartPayload>> {
    const step = this.getCurrentStep()

    if (step.isStart) {
      this.incrementStep()
      return this.iterate(data)
    }

    if (step.isEnd) {
      logger.info(`Ending saga`)
      const endSagaResult = await this.saga.endSaga()
      if (endSagaResult.isError()) {
        throw endSagaResult.data
      }
      logger.info(`Saga ended`)
      return this.saga
    }

    const prevStep = this.getPreviousStep()
    const prevStepResult =
      prevStep && !prevStep.isStart
        ? await this.saga.getEndTaskData(prevStep.taskName)
        : null

    const startTaskResult = await this.saga.startTask(
      step.taskName,
      prevStepResult
    )
    if (startTaskResult.isError()) {
      throw startTaskResult.data
    }

    logger.info(`Running task ${step.taskName}`)
    const result = await step.invokeCallback(data, prevStepResult)
    const endTaskResult = await this.saga.endTask(step.taskName, result)

    if (endTaskResult.isError()) {
      throw endTaskResult.data
    }

    logger.info(`Ended task ${step.taskName}`)
    this.incrementStep()
    return this.iterate(data)
  }

  private async compensate(): Promise<Saga<StartPayload>> {
    const data = await this.saga.getJob()

    for (let i = this.sagaDefinition.steps.length - 1; i >= 0; i--) {
      const step = this.sagaDefinition.steps[i]

      if (step.isStart || step.isEnd) {
        continue
      }

      if (await this.saga.isTaskCompleted(step.taskName)) {
        const taskData = await this.saga.getEndTaskData(step.taskName)
        const startCompResult = await this.saga.startCompensatingTask(
          step.taskName,
          taskData
        )
        if (startCompResult.isError()) {
          throw startCompResult.data
        }

        logger.info(`Compensating task ${step.taskName}`)

        const result = await step.compensateCallback(data, taskData)
        logger.info(`Compensated task ${step.taskName}`)
        await this.saga.endCompensatingTask(step.taskName, result)
      }
    }

    return this.saga
  }
}
