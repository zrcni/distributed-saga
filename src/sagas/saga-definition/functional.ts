import { SagaDefinition } from "./SagaDefinition"
import { SagaStep, StartStep, EndStep } from "./SagaStep"
import { SagaBuilder } from "./SagaBuilder"
import { StepInvokeCallback, StepCompensateCallback } from "./types"

/**
 * Represents a step configuration in the functional API
 */
export interface StepConfig<
  Data = unknown,
  PrevResult = unknown,
  ResultData = unknown,
  TaskData = unknown
> {
  name: string
  invoke?: StepInvokeCallback<Data, PrevResult, ResultData>
  compensate?: StepCompensateCallback<Data, TaskData, ResultData>
}

/**
 * Builder for a single step with a fluent API
 */
export class FunctionalStepBuilder<
  Data = unknown,
  PrevResult = unknown,
  ResultData = unknown
> {
  private config: StepConfig<Data, PrevResult, ResultData>

  constructor(name: string) {
    this.config = { name }
  }

  /**
   * Define the invoke callback for this step
   */
  invoke<R = ResultData>(
    callback: StepInvokeCallback<Data, PrevResult, R>
  ): FunctionalStepBuilder<Data, PrevResult, R> {
    this.config.invoke = callback as any
    return this as any
  }

  /**
   * Define the compensate callback for this step
   */
  compensate<R = unknown>(
    callback: StepCompensateCallback<Data, ResultData, R>
  ): FunctionalStepBuilder<Data, PrevResult, ResultData> {
    this.config.compensate = callback as any
    return this
  }

  /**
   * Get the configuration for this step
   * @internal
   */
  getConfig(): StepConfig<Data, PrevResult, ResultData> {
    return this.config
  }
}

/**
 * Create a new step with the given name
 *
 * @example
 * ```typescript
 * const paymentStep = step('processPayment')
 *   .invoke(async (data) => ({ paymentId: '123' }))
 *   .compensate(async (data, result) => {
 *     await refundPayment(result.paymentId)
 *   })
 * ```
 */
export function step<Data = unknown>(
  name: string
): FunctionalStepBuilder<Data, unknown, unknown> {
  return new FunctionalStepBuilder(name)
}

/**
 * Convert a functional step configuration to a SagaStep
 * @internal
 */
function createSagaStep(builder: SagaBuilder, config: StepConfig): SagaStep {
  const sagaStep = new SagaStep(builder)
    .withName(config.name)
    .invoke(config.invoke)

  if (config.compensate) {
    sagaStep.compensate(config.compensate)
  }

  return sagaStep
}

/**
 * Create a saga definition from an array of step configurations
 *
 * This is useful when you need to dynamically build sagas or when working
 * with configuration-driven saga definitions.
 *
 * @example
 * ```typescript
 * const steps = [
 *   { name: 'step1', invoke: async () => ({ result: 1 }) },
 *   { name: 'step2', invoke: async (data, prev) => ({ result: prev.result + 1 }) },
 * ]
 * const saga = fromSteps(steps)
 * ```
 */
export function fromSteps(
  steps: (StepConfig | SagaStep | FunctionalStepBuilder)[]
): SagaDefinition {
  const builder = new SagaBuilder()
  const sagaSteps: SagaStep[] = [new StartStep(builder)]

  for (const step of steps) {
    if (step instanceof SagaStep) {
      sagaSteps.push(step)
    } else if (step instanceof FunctionalStepBuilder) {
      const sagaStep = createSagaStep(builder, step.getConfig())
      sagaSteps.push(sagaStep)
    } else {
      const sagaStep = createSagaStep(builder, step)
      sagaSteps.push(sagaStep)
    }
  }

  sagaSteps.push(new EndStep(builder))
  builder.steps = sagaSteps

  return new SagaDefinition(sagaSteps)
}
