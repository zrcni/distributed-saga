import { SagaOrchestrator, SagaOrchestratorEvents } from "./SagaOrchestrator"

export class SagaLogger {
  sagaOrchestrator: SagaOrchestrator

  constructor(sagaOrchestrator: SagaOrchestrator) {
    this.sagaOrchestrator = sagaOrchestrator
  }

  onSagaStarted(listener: (event: SagaOrchestratorEvents["sagaStarted"]) => void) {
    this.sagaOrchestrator.on("sagaStarted", listener)
  }

  onSagaSucceeded(
    listener: (event: SagaOrchestratorEvents["sagaSucceeded"]) => void
  ) {
    this.sagaOrchestrator.on("sagaSucceeded", listener)
  }

  onSagaFailed(listener: (event: SagaOrchestratorEvents["sagaFailed"]) => void) {
    this.sagaOrchestrator.on("sagaFailed", listener)
  }

  onTaskStarted(
    listener: (event: SagaOrchestratorEvents["taskStarted"]) => void
  ) {
    this.sagaOrchestrator.on("taskStarted", listener)
  }

  onTaskSucceeded(
    listener: (event: SagaOrchestratorEvents["taskSucceeded"]) => void
  ) {
    this.sagaOrchestrator.on("taskSucceeded", listener)
  }

  onTaskFailed(
    listener: (event: SagaOrchestratorEvents["taskFailed"]) => void
  ) {
    this.sagaOrchestrator.on("taskFailed", listener)
  }

  onCompensationStarted(
    listener: (event: SagaOrchestratorEvents["compensationStarted"]) => void
  ) {
    this.sagaOrchestrator.on("compensationStarted", listener)
  }

  onCompensationSucceeded(
    listener: (event: SagaOrchestratorEvents["compensationSucceeded"]) => void
  ) {
    this.sagaOrchestrator.on("compensationSucceeded", listener)
  }

  onCompensationFailed(
    listener: (event: SagaOrchestratorEvents["compensationFailed"]) => void
  ) {
    this.sagaOrchestrator.on("compensationFailed", listener)
  }

  onMiddlewareSucceeded(
    listener: (event: SagaOrchestratorEvents["middlewareSucceeded"]) => void
  ) {
    this.sagaOrchestrator.on("middlewareSucceeded", listener)
  }

  onMiddlewareFailed(
    listener: (event: SagaOrchestratorEvents["middlewareFailed"]) => void
  ) {
    this.sagaOrchestrator.on("middlewareFailed", listener)
  }
}
