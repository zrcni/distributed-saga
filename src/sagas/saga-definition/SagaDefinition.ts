import { fromSteps } from "./functional"
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

  static fromSteps(steps: Parameters<typeof fromSteps>[0]) {
    return fromSteps(steps)
  }
}
