import { fromSteps } from "./functional"
import { SagaBuilder } from "./SagaBuilder"
import { SagaStep } from "./SagaStep"
import { InvalidSagaDefinitionError } from "@/errors"

export interface SagaValidationError {
  field: string
  message: string
  stepIndex?: number
  stepName?: string
}

export class SagaDefinition {
  steps: SagaStep[]

  constructor(steps: SagaStep[], skipValidation = false) {
    this.steps = steps
    if (!skipValidation) {
      this.validate()
    }
  }

  /**
   * Validate the saga definition
   * @throws {InvalidSagaDefinitionError} if validation fails
   */
  private validate(): void {
    const errors = this.getValidationErrors()
    if (errors.length > 0) {
      const errorMessages = errors.map(
        (err) =>
          `${err.field}: ${err.message}` +
          (err.stepName ? ` (step: ${err.stepName})` : "") +
          (err.stepIndex !== undefined ? ` (index: ${err.stepIndex})` : "")
      )
      throw new InvalidSagaDefinitionError(
        `Saga definition validation failed:\n${errorMessages.join("\n")}`,
        { errors }
      )
    }
  }

  /**
   * Get all validation errors without throwing
   * @returns Array of validation errors
   */
  public getValidationErrors(): SagaValidationError[] {
    const errors: SagaValidationError[] = []

    // Check if steps array is empty
    if (!this.steps || this.steps.length === 0) {
      errors.push({
        field: "steps",
        message: "Saga must have at least one step",
      })
      return errors
    }

    // Check minimum steps (start + end)
    if (this.steps.length < 2) {
      errors.push({
        field: "steps",
        message: "Saga must have at least a start and end step",
      })
      return errors
    }

    // Check first step is StartStep
    const firstStep = this.steps[0]
    if (!firstStep.isStart) {
      errors.push({
        field: "steps[0]",
        message: "First step must be a StartStep",
        stepIndex: 0,
      })
    }

    // Check last step is EndStep
    const lastStep = this.steps[this.steps.length - 1]
    if (!lastStep.isEnd) {
      errors.push({
        field: `steps[${this.steps.length - 1}]`,
        message: "Last step must be an EndStep",
        stepIndex: this.steps.length - 1,
      })
    }

    // Check middle steps
    const taskNames = new Set<string>()
    for (let i = 1; i < this.steps.length - 1; i++) {
      const step = this.steps[i]

      // Check that middle steps are not Start or End steps
      if (step.isStart) {
        errors.push({
          field: `steps[${i}]`,
          message: "StartStep can only be at the beginning",
          stepIndex: i,
        })
      }

      if (step.isEnd) {
        errors.push({
          field: `steps[${i}]`,
          message: "EndStep can only be at the end",
          stepIndex: i,
        })
      }

      // Check that step has a task name
      if (!step.taskName || step.taskName.trim() === "") {
        errors.push({
          field: `steps[${i}].taskName`,
          message: "Step must have a task name",
          stepIndex: i,
        })
      } else {
        // Check for duplicate task names
        if (taskNames.has(step.taskName)) {
          errors.push({
            field: `steps[${i}].taskName`,
            message: `Duplicate task name: "${step.taskName}"`,
            stepIndex: i,
            stepName: step.taskName,
          })
        }
        taskNames.add(step.taskName)
      }

      // Check that step has an invoke callback
      if (!step.invokeCallback) {
        errors.push({
          field: `steps[${i}].invokeCallback`,
          message: "Step must have an invoke callback",
          stepIndex: i,
          stepName: step.taskName,
        })
      }

      // Note: compensateCallback is optional (defaults to noop)
    }

    return errors
  }

  /**
   * Check if the saga definition is valid
   * @returns true if valid, false otherwise
   */
  public isValid(): boolean {
    return this.getValidationErrors().length === 0
  }

  static create(builder: SagaBuilder) {
    return new SagaDefinition(builder.steps)
  }

  static fromSteps(steps: Parameters<typeof fromSteps>[0]) {
    return fromSteps(steps)
  }
}
