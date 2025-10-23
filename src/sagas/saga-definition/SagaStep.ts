import { SagaBuilder } from "./SagaBuilder"
import {
  StepCompensateCallback,
  StepInvokeCallback,
  StepMiddlewareCallback,
} from "./types"

// Default noop function for compensation when not provided
const noopCompensate: StepCompensateCallback = async () => {}

export class SagaStep {
  private builder: SagaBuilder
  public invokeCallback: StepInvokeCallback
  public compensateCallback: StepCompensateCallback
  public middleware: StepMiddlewareCallback[] = []
  public taskName: string
  public isStart = false
  public isEnd = false
  public isOptional = false

  constructor(builder: SagaBuilder) {
    this.builder = builder
    // Initialize with noop function to make compensation optional
    this.compensateCallback = noopCompensate
  }

  next() {
    return this.builder.nextStep()
  }

  end() {
    return this.builder.end()
  }

  invoke<Data = unknown, PrevResult = unknown, ResultData = unknown>(
    callback: StepInvokeCallback<Data, PrevResult, ResultData>
  ) {
    this.invokeCallback = callback
    if (!this.taskName) {
      this.taskName = callback.name
    }
    return this
  }

  compensate<D = unknown>(callback: StepCompensateCallback<D>) {
    this.compensateCallback = callback
    return this
  }

  withName(name: string) {
    this.taskName = name
    return this
  }

  withMiddleware<Data = unknown, PrevResult = unknown>(
    callback: StepMiddlewareCallback<Data, PrevResult>
  ) {
    this.middleware.push(callback)
    return this
  }

  /**
   * Mark this task as optional. If an optional task fails, the saga will continue
   * to the next task instead of aborting. The error will be logged and an event
   * will be emitted, but the saga flow will proceed.
   */
  optional() {
    this.isOptional = true
    return this
  }
}

export class StartStep extends SagaStep {
  public isStart = true
  public isEnd = false
}
export class EndStep extends SagaStep {
  public isStart = false
  public isEnd = true
}
