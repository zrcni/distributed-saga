import { SagaDefinition } from "./saga-definition/SagaDefinition"

export abstract class SagaImplementation {
  protected abstract sagaDefinition: SagaDefinition

  protected static tasks: Record<string, string>

  getSagaDefinition() {
    return this.sagaDefinition
  }
}
