import { SagaDefinition } from "./SagaDefinition"
import { EndStep, SagaStep, StartStep } from "./SagaStep"

export class SagaBuilder {
  steps: SagaStep[]
  private currentStepIndex: number

  constructor() {
    this.steps = [new StartStep(this)]
    this.currentStepIndex = 1
  }

  get currentStep(): SagaStep {
    if (!this.steps[this.currentStepIndex]) {
      this.steps[this.currentStepIndex] = new SagaStep(this)
    }
    return this.steps[this.currentStepIndex]
  }

  nextStep(): SagaStep {
    this.currentStepIndex += 1
    return this.currentStep
  }

  end(): SagaDefinition {
    this.currentStepIndex += 1
    this.steps[this.currentStepIndex] = new EndStep(this)
    return SagaDefinition.create(this)
  }
}
