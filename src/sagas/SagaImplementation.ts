import { SagaDefinition } from "./saga-definition/SagaDefinition"

export abstract class SagaImplementation {
  protected abstract sagaDefinition: SagaDefinition
  protected static sagaName: string
  protected static tasks: Record<string, string>

  static id(runId: string): string {
    return `${this.sagaName || this.name}-${runId}`
  }

  getSagaDefinition() {
    return this.sagaDefinition
  }
}
