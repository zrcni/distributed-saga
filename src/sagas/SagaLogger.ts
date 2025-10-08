import { SagaRunner } from "./SagaRunner"

export class SagaLogger {
  sagaRunner: SagaRunner<any>

  constructor(sagaRunner: SagaRunner<any>) {
    this.sagaRunner = sagaRunner
  }

  onSagaStarted(listener: (event: { sagaId: string; data: unknown }) => void) {
    this.sagaRunner.emitter.on("sagaStarted", listener)
  }

  onSagaSucceeded(
    listener: (event: { sagaId: string; data: unknown }) => void
  ) {
    this.sagaRunner.emitter.on("sagaSucceeded", listener)
  }

  onSagaFailed(listener: (event: { sagaId: string; data: unknown }) => void) {
    this.sagaRunner.emitter.on("sagaFailed", listener)
  }

  onTaskStarted(
    listener: (event: {
      sagaId: string
      data: unknown
      taskName: string
    }) => void
  ) {
    this.sagaRunner.emitter.on("taskStarted", listener)
  }

  onTaskSucceeded(
    listener: (event: {
      sagaId: string
      data: unknown
      taskName: string
    }) => void
  ) {
    this.sagaRunner.emitter.on("taskSucceeded", listener)
  }

  onTaskFailed(
    listener: (event: {
      sagaId: string
      data: unknown
      taskName: string
    }) => void
  ) {
    this.sagaRunner.emitter.on("taskFailed", listener)
  }

  onCompensationStarted(
    listener: (event: {
      sagaId: string
      data: unknown
      taskName: string
    }) => void
  ) {
    this.sagaRunner.emitter.on("compensationStarted", listener)
  }

  onCompensationSucceeded(
    listener: (event: {
      sagaId: string
      data: unknown
      taskName: string
    }) => void
  ) {
    this.sagaRunner.emitter.on("compensationSucceeded", listener)
  }

  onCompensationFailed(
    listener: (event: {
      sagaId: string
      data: unknown
      taskName: string
    }) => void
  ) {
    this.sagaRunner.emitter.on("compensationFailed", listener)
  }
}
