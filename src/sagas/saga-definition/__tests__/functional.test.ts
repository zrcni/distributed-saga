import { step, fromSteps, FunctionalStepBuilder } from "../functional"
import { SagaDefinition } from "../SagaDefinition"
import { SagaOrchestrator } from "../../SagaOrchestrator"
import { InMemorySagaLog } from "../../InMemorySagaLog"

describe("Functional Saga API", () => {
  describe("FunctionalStepBuilder", () => {
    it("should create a step with a name", () => {
      const stepBuilder = step("testStep")
      expect(stepBuilder).toBeInstanceOf(FunctionalStepBuilder)
      expect(stepBuilder.getConfig().name).toBe("testStep")
    })

    it("should allow setting an invoke callback", () => {
      const invokeCallback = jest.fn(async (data: any) => ({ result: "test" }))
      const stepBuilder = step("testStep").invoke(invokeCallback)

      expect(stepBuilder.getConfig().invoke).toBe(invokeCallback)
    })

    it("should allow setting a compensate callback", () => {
      const compensateCallback = jest.fn(async () => {})
      const stepBuilder = step("testStep").compensate(compensateCallback)

      expect(stepBuilder.getConfig().compensate).toBe(compensateCallback)
    })

    it("should allow chaining invoke and compensate", () => {
      const invokeCallback = jest.fn(async () => ({ result: "test" }))
      const compensateCallback = jest.fn(async () => {})

      const stepBuilder = step("testStep")
        .invoke(invokeCallback)
        .compensate(compensateCallback)

      const config = stepBuilder.getConfig()
      expect(config.invoke).toBe(invokeCallback)
      expect(config.compensate).toBe(compensateCallback)
    })

    it("should maintain type safety with typed data", () => {
      interface StepData {
        userId: string
        amount: number
      }

      interface StepResult {
        transactionId: string
      }

      const stepBuilder = step<StepData>("payment")
        .invoke<StepResult>(async (data, context) => {
          // TypeScript should enforce correct types here
          const userId: string = data.userId
          const amount: number = data.amount
          return { transactionId: `txn-${userId}-${amount}` }
        })
        .compensate(async (data, context) => {
          // TypeScript should enforce correct types here
          const txnId: string = context.taskData.transactionId
          console.log(`Refunding ${txnId}`)
        })

      expect(stepBuilder.getConfig().name).toBe("payment")
    })

    it("should allow adding middleware", () => {
      const middleware1 = jest.fn(async () => {})
      const middleware2 = jest.fn(async () => {})

      const stepBuilder = step("testStep")
        .withMiddleware(middleware1)
        .withMiddleware(middleware2)

      const config = stepBuilder.getConfig()
      expect(config.middleware).toHaveLength(2)
      expect(config.middleware![0]).toBe(middleware1)
      expect(config.middleware![1]).toBe(middleware2)
    })

    it("should allow chaining invoke, compensate, and middleware", () => {
      const invokeCallback = jest.fn(async () => ({ result: "test" }))
      const compensateCallback = jest.fn(async () => {})
      const middleware = jest.fn(async () => {})

      const stepBuilder = step("testStep")
        .invoke(invokeCallback)
        .withMiddleware(middleware)
        .compensate(compensateCallback)

      const config = stepBuilder.getConfig()
      expect(config.invoke).toBe(invokeCallback)
      expect(config.compensate).toBe(compensateCallback)
      expect(config.middleware).toHaveLength(1)
      expect(config.middleware![0]).toBe(middleware)
    })
  })

  describe("fromSteps", () => {
    it("should create a SagaDefinition from an array of step configs", () => {
      const steps = [
        { name: "step1", invoke: async () => ({ result: 1 }) },
        { name: "step2", invoke: async () => ({ result: 2 }) },
      ]

      const sagaDefinition = fromSteps(steps)

      expect(sagaDefinition).toBeInstanceOf(SagaDefinition)
      expect(sagaDefinition.steps.length).toBe(4) // StartStep + 2 steps + EndStep
    })

    it("should create a SagaDefinition from FunctionalStepBuilder instances", () => {
      const steps = [
        step("step1").invoke(async () => ({ result: 1 })),
        step("step2").invoke(async () => ({ result: 2 })),
      ]

      const sagaDefinition = fromSteps(steps)

      expect(sagaDefinition).toBeInstanceOf(SagaDefinition)
      expect(sagaDefinition.steps.length).toBe(4)
    })

    it("should create a SagaDefinition from mixed step types", () => {
      const steps = [
        step("step1").invoke(async () => ({ result: 1 })),
        { name: "step2", invoke: async () => ({ result: 2 }) },
      ]

      const sagaDefinition = fromSteps(steps)

      expect(sagaDefinition).toBeInstanceOf(SagaDefinition)
      expect(sagaDefinition.steps.length).toBe(4)
    })

    it("should create steps with compensate callbacks", () => {
      const compensateCallback = jest.fn(async () => {})
      const steps = [
        step("step1")
          .invoke(async () => ({ result: 1 }))
          .compensate(compensateCallback),
      ]

      const sagaDefinition = fromSteps(steps)

      expect(sagaDefinition).toBeInstanceOf(SagaDefinition)
      // Verify the step has the compensate callback
      const step1 = sagaDefinition.steps[1] // Skip StartStep
      expect(step1.compensateCallback).toBe(compensateCallback)
    })

    it("should handle empty step arrays", () => {
      const sagaDefinition = fromSteps([])

      expect(sagaDefinition).toBeInstanceOf(SagaDefinition)
      expect(sagaDefinition.steps.length).toBe(2) // StartStep + EndStep
    })

    it("should accept SagaStep instances", () => {
      const steps = [step("step1").invoke(async () => ({ result: 1 }))]
      const sagaDef1 = fromSteps(steps)
      const sagaStep = sagaDef1.steps[1] // Get the actual SagaStep

      // Should be able to mix SagaStep with other types
      const sagaDef2 = fromSteps([
        sagaStep,
        step("step2").invoke(async () => ({ result: 2 })),
      ])

      expect(sagaDef2).toBeInstanceOf(SagaDefinition)
      expect(sagaDef2.steps.length).toBe(4)
    })
  })

  describe("Functional API Integration Tests", () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("should execute a simple saga with functional API", async () => {
      const step1Invoke = jest.fn(async () => ({ value: 1 }))
      const step2Invoke = jest.fn(async (data: any, context: any) => ({
        value: context.prev.value + 1,
      }))

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke),
        step("step2").invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {
        initial: true,
      })
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Invoke).toHaveBeenCalledTimes(1)
      expect(step2Invoke).toHaveBeenCalledTimes(1)
      expect(step2Invoke).toHaveBeenCalledWith(
        { initial: true },
        expect.objectContaining({
          prev: { value: 1 },
          middleware: {},
          sagaId: "test-saga",
          parentSagaId: null,
          parentTaskId: null,
          api: expect.objectContaining({ sagaId: "test-saga" }),
          ctx: expect.objectContaining({ get: expect.any(Function), update: expect.any(Function) })
        })
      )
    })

    it("should execute compensation when a step fails", async () => {
      const step1Invoke = jest.fn(async () => ({ value: 1 }))
      const step1Compensate = jest.fn(async () => {})
      const step2Invoke = jest.fn(async () => {
        throw new Error("Step 2 failed")
      })
      const step2Compensate = jest.fn(async () => {})

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke).compensate(step1Compensate),
        step("step2").invoke(step2Invoke).compensate(step2Compensate),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {
        initial: true,
      })
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Invoke).toHaveBeenCalledTimes(1)
      expect(step2Invoke).toHaveBeenCalledTimes(1)

      // Step1 should be compensated since step2 failed
      expect(step1Compensate).toHaveBeenCalledTimes(1)
      // Step2 should not be compensated (it never succeeded)
      expect(step2Compensate).not.toHaveBeenCalled()
    })

    it("should pass data through multiple steps", async () => {
      interface OrderData {
        orderId: string
        amount: number
      }

      const step1Result = { paymentId: "pay-123" }
      const step2Result = { inventoryId: "inv-456" }

      const step1Invoke = jest.fn(async (data: OrderData) => step1Result)
      const step2Invoke = jest.fn(
        async (data: OrderData, context) => {
          expect(context.prev.paymentId).toBe("pay-123")
          return step2Result
        }
      )
      const step3Invoke = jest.fn(
        async (data: OrderData, context) => {
          expect(context.prev.inventoryId).toBe("inv-456")
          return { completed: true }
        }
      )

      const sagaDefinition = fromSteps([
        step<OrderData>("processPayment").invoke(step1Invoke),
        step<OrderData>("reserveInventory").invoke(step2Invoke),
        step<OrderData>("sendConfirmation").invoke(step3Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const orderData: OrderData = { orderId: "order-1", amount: 100 }
      const result = await coordinator.createSaga("test-saga", orderData)
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Invoke).toHaveBeenCalledWith(orderData, expect.objectContaining({
        prev: null,
        middleware: {},
        sagaId: "test-saga",
        parentSagaId: null,
        parentTaskId: null,
        api: expect.objectContaining({ sagaId: "test-saga" }),
        ctx: expect.objectContaining({ get: expect.any(Function), update: expect.any(Function) })
      }))
      expect(step2Invoke).toHaveBeenCalledWith(orderData, expect.objectContaining({
        prev: step1Result,
        middleware: {},
        sagaId: "test-saga",
        parentSagaId: null,
        parentTaskId: null,
        api: expect.objectContaining({ sagaId: "test-saga" }),
        ctx: expect.objectContaining({ get: expect.any(Function), update: expect.any(Function) })
      }))
      expect(step3Invoke).toHaveBeenCalledWith(orderData, expect.objectContaining({
        prev: step2Result,
        middleware: {},
        sagaId: "test-saga",
        parentSagaId: null,
        parentTaskId: null,
        api: expect.objectContaining({ sagaId: "test-saga" }),
        ctx: expect.objectContaining({ get: expect.any(Function), update: expect.any(Function) })
      }))
    })

    it("should execute compensations in reverse order", async () => {
      const executionOrder: string[] = []

      const step1Invoke = jest.fn(async () => {
        executionOrder.push("step1-invoke")
        return {}
      })
      const step1Compensate = jest.fn(async () => {
        executionOrder.push("step1-compensate")
      })

      const step2Invoke = jest.fn(async () => {
        executionOrder.push("step2-invoke")
        return {}
      })
      const step2Compensate = jest.fn(async () => {
        executionOrder.push("step2-compensate")
      })

      const step3Invoke = jest.fn(async () => {
        executionOrder.push("step3-invoke")
        throw new Error("Step 3 failed")
      })

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke).compensate(step1Compensate),
        step("step2").invoke(step2Invoke).compensate(step2Compensate),
        step("step3").invoke(step3Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      // Verify execution order: invocations forward, compensations backward
      expect(executionOrder).toEqual([
        "step1-invoke",
        "step2-invoke",
        "step3-invoke",
        "step2-compensate",
        "step1-compensate",
      ])
    })

    it("should handle synchronous invoke callbacks", async () => {
      const step1Invoke = jest.fn(() => ({ value: 1 }))
      const step2Invoke = jest.fn((data: any, prev: any) => ({
        value: prev.value + 1,
      }))

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke),
        step("step2").invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Invoke).toHaveBeenCalledTimes(1)
      expect(step2Invoke).toHaveBeenCalledTimes(1)
    })

    it("should handle synchronous compensate callbacks", async () => {
      const step1Invoke = jest.fn(async () => ({ value: 1 }))
      const step1Compensate = jest.fn(() => {
        // Synchronous compensation
      })
      const step2Invoke = jest.fn(async () => {
        throw new Error("Step 2 failed")
      })

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke).compensate(step1Compensate),
        step("step2").invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Compensate).toHaveBeenCalledTimes(1)
    })

    it("should work with complex data transformations", async () => {
      interface UserRegistration {
        email: string
        password: string
      }

      const sagaDefinition = fromSteps([
        step<UserRegistration>("validateEmail").invoke(async (data) => {
          const isValid = data.email.includes("@")
          if (!isValid) throw new Error("Invalid email")
          return { emailValid: true }
        }),

        step<UserRegistration>("hashPassword").invoke(
          async (data, prev: any) => {
            const hashedPassword = `hashed_${data.password}`
            return { hashedPassword, emailValid: prev?.emailValid }
          }
        ),

        step<UserRegistration>("createUser").invoke(async (data, prev: any) => {
          const userId = "user-123"
          return {
            userId,
            email: data.email,
            hashedPassword: prev?.hashedPassword,
            emailValid: prev?.emailValid,
          }
        }),

        step<UserRegistration>("sendWelcomeEmail")
          .invoke(async (data, prev: any) => {
            return {
              emailSent: true,
              userId: prev?.userId,
              email: prev?.email,
              hashedPassword: prev?.hashedPassword,
              emailValid: prev?.emailValid,
            }
          })
          .compensate(async (data, taskData: any) => {
            // Would send cancellation email in real scenario
          }),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const registrationData: UserRegistration = {
        email: "test@example.com",
        password: "secret123",
      }
      const result = await coordinator.createSaga("test-saga", registrationData)
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      // If we get here without errors, the saga completed successfully
      expect(saga.state.sagaCompleted).toBe(true)
    })
  })

  describe("Functional API Edge Cases", () => {
    it("should reject steps with no callbacks", () => {
      expect(() => fromSteps([{ name: "emptyStep" }])).toThrow(
        "Saga definition validation failed"
      )
    })

    it("should reject steps with only compensate callback", () => {
      const compensate = jest.fn(async () => {})
      expect(() => fromSteps([step("step1").compensate(compensate)])).toThrow(
        "Saga definition validation failed"
      )
    })

    it("should allow reusing step builders", () => {
      const reusableStep = step("reusable").invoke(async () => ({ value: 1 }))

      const saga1 = fromSteps([reusableStep])
      const saga2 = fromSteps([reusableStep])

      expect(saga1).toBeInstanceOf(SagaDefinition)
      expect(saga2).toBeInstanceOf(SagaDefinition)
    })

    it("should handle large number of steps", () => {
      const steps = Array.from({ length: 100 }, (_, i) =>
        step(`step${i}`).invoke(async () => ({ index: i }))
      )

      const sagaDefinition = fromSteps(steps)

      expect(sagaDefinition).toBeInstanceOf(SagaDefinition)
      expect(sagaDefinition.steps.length).toBe(102) // StartStep + 100 steps + EndStep
    })

    it("should preserve step names correctly", () => {
      const sagaDefinition = fromSteps([
        step("firstStep").invoke(async () => ({})),
        step("secondStep").invoke(async () => ({})),
        { name: "thirdStep", invoke: async () => ({}) },
      ])

      expect(sagaDefinition.steps[1].taskName).toBe("firstStep")
      expect(sagaDefinition.steps[2].taskName).toBe("secondStep")
      expect(sagaDefinition.steps[3].taskName).toBe("thirdStep")
    })

    it("should handle compensation for steps without compensate callbacks", async () => {
      const step1Invoke = jest.fn(async () => ({ value: 1 }))
      const step2Invoke = jest.fn(async () => {
        throw new Error("Step 2 failed")
      })

      // Neither step has a compensate callback
      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke),
        step("step2").invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data

      // Should not throw even though steps don't have compensate callbacks
      const orchestrator = new SagaOrchestrator()
      await expect(
        orchestrator.run(saga, sagaDefinition)
      ).resolves.not.toThrow()

      expect(step1Invoke).toHaveBeenCalledTimes(1)
      expect(step2Invoke).toHaveBeenCalledTimes(1)
      
      // Verify compensation was attempted (noop was called)
      expect(saga.state.sagaAborted).toBe(true)
    })

    it("should execute middleware before step invocation", async () => {
      const middleware = jest.fn(async () => {})
      const stepInvoke = jest.fn(async () => ({ value: 1 }))

      const sagaDefinition = fromSteps([
        step("step1").withMiddleware(middleware).invoke(stepInvoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", { data: "test" })
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(middleware).toHaveBeenCalledTimes(1)
      expect(middleware).toHaveBeenCalledWith({ data: "test" }, expect.objectContaining({
        prev: null,
        middleware: {},
        sagaId: "test-saga",
        parentSagaId: null,
        parentTaskId: null,
        api: expect.objectContaining({ sagaId: "test-saga" }),
        ctx: expect.objectContaining({ get: expect.any(Function), update: expect.any(Function) })
      }))
      expect(stepInvoke).toHaveBeenCalledTimes(1)
    })

    it("should execute multiple middleware functions in order", async () => {
      const executionOrder: string[] = []
      const middleware1 = jest.fn(async () => {
        executionOrder.push("middleware1")
      })
      const middleware2 = jest.fn(async () => {
        executionOrder.push("middleware2")
      })
      const stepInvoke = jest.fn(async () => {
        executionOrder.push("invoke")
        return {}
      })

      const sagaDefinition = fromSteps([
        step("step1")
          .withMiddleware(middleware1)
          .withMiddleware(middleware2)
          .invoke(stepInvoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(executionOrder).toEqual(["middleware1", "middleware2", "invoke"])
    })

    it("should abort saga when middleware fails", async () => {
      const step1Invoke = jest.fn(async () => ({ value: 1 }))
      const step1Compensate = jest.fn(async () => {})
      const middleware = jest
        .fn()
        .mockRejectedValue(new Error("Middleware failed"))
      const step2Invoke = jest.fn(async () => ({ value: 2 }))

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke).compensate(step1Compensate),
        step("step2").withMiddleware(middleware).invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Invoke).toHaveBeenCalledTimes(1)
      expect(middleware).toHaveBeenCalledTimes(1)
      expect(step2Invoke).not.toHaveBeenCalled()
      expect(step1Compensate).toHaveBeenCalledTimes(1)
      expect(saga.state.sagaAborted).toBe(true)
    })

    it("should abort saga when middleware returns false", async () => {
      const step1Invoke = jest.fn(async () => ({ value: 1 }))
      const step1Compensate = jest.fn(async () => {})
      const middleware = jest.fn().mockReturnValue(false)
      const step2Invoke = jest.fn(async () => ({ value: 2 }))

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke).compensate(step1Compensate),
        step("step2").withMiddleware(middleware).invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(step1Invoke).toHaveBeenCalledTimes(1)
      expect(middleware).toHaveBeenCalledTimes(1)
      expect(step2Invoke).not.toHaveBeenCalled()
      expect(step1Compensate).toHaveBeenCalledTimes(1)
      expect(saga.state.sagaAborted).toBe(true)
    })

    it("should pass previous step result to middleware", async () => {
      const step1Result = { value: 100 }
      const step1Invoke = jest.fn(async () => step1Result)
      const middleware = jest.fn(async (data, context) => {
        expect(context.prev).toEqual(step1Result)
      })
      const step2Invoke = jest.fn(async () => ({ value: 2 }))

      const sagaDefinition = fromSteps([
        step("step1").invoke(step1Invoke),
        step("step2").withMiddleware(middleware).invoke(step2Invoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", { data: "test" })
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(middleware).toHaveBeenCalledWith({ data: "test" }, expect.objectContaining({
        prev: step1Result,
        middleware: {},
        sagaId: "test-saga",
        parentSagaId: null,
        parentTaskId: null,
        api: expect.objectContaining({ sagaId: "test-saga" }),
        ctx: expect.objectContaining({ get: expect.any(Function), update: expect.any(Function) })
      }))
      expect(step2Invoke).toHaveBeenCalledTimes(1)
    })

    it("should accumulate and merge middleware data", async () => {
      const middleware1 = jest.fn(async () => ({ key1: "value1" }))
      const middleware2 = jest.fn(async (data, context) => {
        expect(context.middleware).toEqual({ key1: "value1" })
        return { key2: "value2" }
      })
      const stepInvoke = jest.fn(async (data, context) => {
        expect(context.middleware).toEqual({ key1: "value1", key2: "value2" })
        return { value: 1 }
      })

      const sagaDefinition = fromSteps([
        step("step1")
          .withMiddleware(middleware1)
          .withMiddleware(middleware2)
          .invoke(stepInvoke),
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(middleware1).toHaveBeenCalled()
      expect(middleware2).toHaveBeenCalled()
      expect(stepInvoke).toHaveBeenCalled()
    })

    it("should support middleware in config object format", async () => {
      const middleware1 = jest.fn(async () => {})
      const middleware2 = jest.fn(async () => {})
      const stepInvoke = jest.fn(async () => ({ value: 1 }))

      const sagaDefinition = fromSteps([
        {
          name: "step1",
          invoke: stepInvoke,
          middleware: [middleware1, middleware2],
        },
      ])

      const coordinator = InMemorySagaLog.createInMemorySagaCoordinator()
      const result = await coordinator.createSaga("test-saga", {})
      expect(result).toBeOkResult()
      if (result.isError()) return

      const saga = result.data
      const orchestrator = new SagaOrchestrator()
      await orchestrator.run(saga, sagaDefinition)

      expect(middleware1).toHaveBeenCalledTimes(1)
      expect(middleware2).toHaveBeenCalledTimes(1)
      expect(stepInvoke).toHaveBeenCalledTimes(1)
    })
  })
})
