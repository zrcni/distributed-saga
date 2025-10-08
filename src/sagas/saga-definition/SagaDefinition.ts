import { SagaBuilder } from "./SagaBuilder"
import { SagaStep } from "./SagaStep"

export class SagaDefinition {
  steps: SagaStep[]

  constructor(steps: SagaStep[]) {
    this.steps = steps
  }

  static create(builder: SagaBuilder) {
    return new SagaDefinition(builder.steps)
  }
}
