import { SagaDefinition } from "./saga-definition/SagaDefinition"

export abstract class SagaImplementation {
  protected abstract sagaDefinition: SagaDefinition
  protected static sagaName: string
  protected static tasks: Record<string, string>

  static id(runId: string): string {
    return `${this.sagaName || this.name}-${runId}`
  }

  id(runId: string): string {
    return (this.constructor as typeof SagaImplementation).id(runId)
  }

  get tasks() {
    return (this.constructor as typeof SagaImplementation).tasks
  }

  getSagaDefinition() {
    return this.sagaDefinition
  }
}
