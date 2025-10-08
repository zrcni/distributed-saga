import { SagaBuilder } from "./SagaBuilder"

export * from "./types"

export function start() {
  return new SagaBuilder().currentStep
}
