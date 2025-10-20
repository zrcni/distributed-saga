import { SagaOrchestrator, SagaOrchestratorEvents } from "./SagaOrchestrator"

export class SagaLogger {
  sagaOrchestrator: SagaOrchestrator

  constructor(sagaOrchestrator: SagaOrchestrator) {
    this.sagaOrchestrator = sagaOrchestrator
  }

  onSagaStarted(
    listener: (event: SagaOrchestratorEvents["sagaStarted"]) => void
  ): this {
    this.sagaOrchestrator.on("sagaStarted", listener)
    return this
  }

  onSagaSucceeded(
    listener: (event: SagaOrchestratorEvents["sagaSucceeded"]) => void
  ): this {
    this.sagaOrchestrator.on("sagaSucceeded", listener)
    return this
  }

  onSagaFailed(
    listener: (event: SagaOrchestratorEvents["sagaFailed"]) => void
  ): this {
    this.sagaOrchestrator.on("sagaFailed", listener)
    return this
  }

  onTaskStarted(
    listener: (event: SagaOrchestratorEvents["taskStarted"]) => void
  ): this {
    this.sagaOrchestrator.on("taskStarted", listener)
    return this
  }

  onTaskSucceeded(
    listener: (event: SagaOrchestratorEvents["taskSucceeded"]) => void
  ): this {
    this.sagaOrchestrator.on("taskSucceeded", listener)
    return this
  }

  onTaskFailed(
    listener: (event: SagaOrchestratorEvents["taskFailed"]) => void
  ): this {
    this.sagaOrchestrator.on("taskFailed", listener)
    return this
  }

  onCompensationStarted(
    listener: (event: SagaOrchestratorEvents["compensationStarted"]) => void
  ): this {
    this.sagaOrchestrator.on("compensationStarted", listener)
    return this
  }

  onCompensationSucceeded(
    listener: (event: SagaOrchestratorEvents["compensationSucceeded"]) => void
  ): this {
    this.sagaOrchestrator.on("compensationSucceeded", listener)
    return this
  }

  onCompensationFailed(
    listener: (event: SagaOrchestratorEvents["compensationFailed"]) => void
  ): this {
    this.sagaOrchestrator.on("compensationFailed", listener)
    return this
  }

  onMiddlewareSucceeded(
    listener: (event: SagaOrchestratorEvents["middlewareSucceeded"]) => void
  ): this {
    this.sagaOrchestrator.on("middlewareSucceeded", listener)
    return this
  }

  onMiddlewareFailed(
    listener: (event: SagaOrchestratorEvents["middlewareFailed"]) => void
  ): this {
    this.sagaOrchestrator.on("middlewareFailed", listener)
    return this
  }
}
