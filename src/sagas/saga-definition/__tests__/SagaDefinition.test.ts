import { SagaDefinition } from "../SagaDefinition"
import { SagaStep, StartStep, EndStep } from "../SagaStep"
import { SagaBuilder } from "../SagaBuilder"
import { InvalidSagaDefinitionError } from "@/errors"

describe("SagaDefinition validation", () => {
  // Helper to create a mock builder for tests
  const createBuilder = (): SagaBuilder => {
    return new SagaBuilder()
  }

  const createValidStep = (taskName: string): SagaStep => {
    const builder = createBuilder()
    const step = new SagaStep(builder)
    step.taskName = taskName
    step.invokeCallback = async () => {}
    step.compensateCallback = async () => {}
    return step
  }

  const createStepWithoutInvoke = (taskName: string): SagaStep => {
    const builder = createBuilder()
    const step = new SagaStep(builder)
    step.taskName = taskName
    return step
  }

  const createStepWithoutTaskName = (): SagaStep => {
    const builder = createBuilder()
    const step = new SagaStep(builder)
    step.invokeCallback = async () => {}
    return step
  }

  describe("Valid saga definitions", () => {
    it("should accept a valid saga with start, middle steps, and end", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("step1"),
        createValidStep("step2"),
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).not.toThrow()
      const saga = new SagaDefinition(steps)
      expect(saga.isValid()).toBe(true)
      expect(saga.getValidationErrors()).toHaveLength(0)
    })

    it("should accept a minimal saga with only start and end", () => {
      const builder = createBuilder()
      const steps = [new StartStep(builder), new EndStep(builder)]

      expect(() => new SagaDefinition(steps)).not.toThrow()
      const saga = new SagaDefinition(steps)
      expect(saga.isValid()).toBe(true)
    })

    it("should accept a saga with one middle step", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("onlyStep"),
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).not.toThrow()
      const saga = new SagaDefinition(steps)
      expect(saga.isValid()).toBe(true)
    })

    it("should accept steps without compensateCallback (defaults to noop)", () => {
      const builder = createBuilder()
      const step = new SagaStep(builder)
      step.taskName = "step1"
      step.invokeCallback = async () => {}

      const steps = [
        new StartStep(builder),
        step,
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).not.toThrow()
      const saga = new SagaDefinition(steps)
      expect(saga.isValid()).toBe(true)
    })
  })

  describe("Empty or missing steps", () => {
    it("should reject an empty steps array", () => {
      expect(() => new SagaDefinition([])).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition([])
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          "Saga must have at least one step"
        )
      }
    })

    it("should reject saga with only one step", () => {
      const builder = createBuilder()
      expect(() => new SagaDefinition([new StartStep(builder)])).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition([new StartStep(builder)])
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          "Saga must have at least a start and end step"
        )
      }
    })
  })

  describe("Start and End step validation", () => {
    it("should reject saga not starting with StartStep", () => {
      const builder = createBuilder()
      const steps = [createValidStep("step1"), new EndStep(builder)]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          "First step must be a StartStep"
        )
      }
    })

    it("should reject saga not ending with EndStep", () => {
      const builder = createBuilder()
      const steps = [new StartStep(builder), createValidStep("step1")]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain("Last step must be an EndStep")
      }
    })

    it("should reject saga with StartStep in the middle", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("step1"),
        new StartStep(builder),
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          "StartStep can only be at the beginning"
        )
      }
    })

    it("should reject saga with EndStep in the middle", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("step1"),
        new EndStep(builder),
        createValidStep("step2"),
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          "EndStep can only be at the end"
        )
      }
    })
  })

  describe("Task name validation", () => {
    it("should reject step with missing task name", () => {
      const builder = createBuilder()
      const step = createStepWithoutTaskName()
      step.taskName = ""
      
      const steps = [
        new StartStep(builder),
        step,
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain("Step must have a task name")
      }
    })

    it("should reject step with whitespace-only task name", () => {
      const builder = createBuilder()
      const step = createStepWithoutTaskName()
      step.taskName = "   "
      
      const steps = [
        new StartStep(builder),
        step,
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain("Step must have a task name")
      }
    })

    it("should reject saga with duplicate task names", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("duplicateTask"),
        createValidStep("uniqueTask"),
        createValidStep("duplicateTask"),
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          'Duplicate task name: "duplicateTask"'
        )
      }
    })
  })

  describe("Invoke callback validation", () => {
    it("should reject step with missing invoke callback", () => {
      const builder = createBuilder()
      const step = createStepWithoutInvoke("step1")
      
      const steps = [
        new StartStep(builder),
        step,
        new EndStep(builder),
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError
        expect(sagaError.message).toContain(
          "Step must have an invoke callback"
        )
      }
    })
  })

  describe("Multiple validation errors", () => {
    it("should report all validation errors", () => {
      const builder = createBuilder()
      const stepWithoutName = createStepWithoutTaskName()
      stepWithoutName.taskName = ""
      
      const steps = [
        createValidStep("step1"), // Wrong: not a StartStep
        stepWithoutName,
        createValidStep("step3"),
        createValidStep("step3"), // Duplicate name
        createValidStep("step5"), // Wrong: not an EndStep
      ]

      expect(() => new SagaDefinition(steps)).toThrow(
        InvalidSagaDefinitionError
      )

      try {
        new SagaDefinition(steps)
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSagaDefinitionError)
        const sagaError = error as InvalidSagaDefinitionError

        // Should contain multiple errors
        expect(sagaError.message).toContain("First step must be a StartStep")
        expect(sagaError.message).toContain("Last step must be an EndStep")
        expect(sagaError.message).toContain("Step must have a task name")
        expect(sagaError.message).toContain('Duplicate task name: "step3"')
      }
    })
  })

  describe("getValidationErrors method", () => {
    it("should return empty array for valid saga", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("step1"),
        new EndStep(builder),
      ]

      const saga = new SagaDefinition(steps, true)
      expect(saga.getValidationErrors()).toHaveLength(0)
    })

    it("should return detailed errors for invalid saga", () => {
      const builder = createBuilder()
      const stepWithoutName = createStepWithoutTaskName()
      stepWithoutName.taskName = ""
      
      const steps = [
        createValidStep("step1"),
        stepWithoutName,
        createValidStep("step3"),
      ]

      const saga = new SagaDefinition(steps, true)
      const errors = saga.getValidationErrors()

      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.message.includes("StartStep"))).toBe(true)
      expect(errors.some((e) => e.message.includes("EndStep"))).toBe(true)
      expect(errors.some((e) => e.message.includes("task name"))).toBe(true)
    })

    it("should include stepIndex and stepName in errors", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("validStep"),
        createValidStep("validStep"), // Duplicate
        new EndStep(builder),
      ]

      const saga = new SagaDefinition(steps, true)
      const errors = saga.getValidationErrors()

      const duplicateError = errors.find((e) => e.message.includes("Duplicate"))
      expect(duplicateError).toBeDefined()
      expect(duplicateError!.stepIndex).toBe(2)
      expect(duplicateError!.stepName).toBe("validStep")
    })
  })

  describe("isValid method", () => {
    it("should return true for valid saga", () => {
      const builder = createBuilder()
      const steps = [
        new StartStep(builder),
        createValidStep("step1"),
        new EndStep(builder),
      ]

      const saga = new SagaDefinition(steps, true)
      expect(saga.isValid()).toBe(true)
    })

    it("should return false for invalid saga", () => {
      const builder = createBuilder()
      const steps = [createValidStep("step1"), new EndStep(builder)]

      const saga = new SagaDefinition(steps, true)
      expect(saga.isValid()).toBe(false)
    })
  })

  describe("Static factory methods", () => {
    it("should validate when using SagaDefinition.create()", () => {
      const builder = createBuilder()
      builder.steps = [createValidStep("step1"), new EndStep(builder)] // Missing StartStep

      expect(() => SagaDefinition.create(builder)).toThrow(
        InvalidSagaDefinitionError
      )
    })
  })
})
