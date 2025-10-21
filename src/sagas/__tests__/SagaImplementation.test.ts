import { SagaImplementation } from "../SagaImplementation"
import { SagaDefinition } from "../saga-definition/SagaDefinition"
import { SagaBuilder } from "../saga-definition/SagaBuilder"

describe("SagaImplementation", () => {
  describe("concrete implementation", () => {
    class TestSaga extends SagaImplementation {
      protected static sagaName = "test-saga"
      protected static tasks = {
        STEP_ONE: "stepOne",
        STEP_TWO: "stepTwo",
        STEP_THREE: "stepThree",
      }

      protected sagaDefinition: SagaDefinition

      constructor() {
        super()
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async () => {
            return { result: "step one completed" }
          })
          .compensate(async () => {
            console.log("Compensating step one")
          })
          .withName(TestSaga.tasks.STEP_ONE)
          .next()
          .invoke(async (data, prevResult) => {
            return { result: "step two completed", prev: prevResult }
          })
          .compensate(async () => {
            console.log("Compensating step two")
          })
          .withName(TestSaga.tasks.STEP_TWO)
          .next()
          .invoke(async () => {
            return { result: "step three completed" }
          })
          .compensate(async () => {
            console.log("Compensating step three")
          })
          .withName(TestSaga.tasks.STEP_THREE)
          .end()
      }
    }

    it("should be instantiable when properly extended", () => {
      const saga = new TestSaga()
      expect(saga).toBeInstanceOf(SagaImplementation)
      expect(saga).toBeInstanceOf(TestSaga)
    })

    it("should have access to sagaDefinition through getSagaDefinition()", () => {
      const saga = new TestSaga()
      const definition = saga.getSagaDefinition()

      expect(definition).toBeInstanceOf(SagaDefinition)
      expect(definition.steps).toHaveLength(5) // start + 3 steps + end
    })

    it("should have static sagaName property", () => {
      expect(TestSaga["sagaName"]).toBe("test-saga")
    })

    it("should have static tasks property", () => {
      expect(TestSaga["tasks"]).toEqual({
        STEP_ONE: "stepOne",
        STEP_TWO: "stepTwo",
        STEP_THREE: "stepThree",
      })
    })

    describe("static id() method", () => {
      it("should generate saga id from sagaName and runId", () => {
        const runId = "run-123"
        const sagaId = TestSaga.id(runId)

        expect(sagaId).toBe("test-saga-run-123")
      })

      it("should generate unique ids for different runIds", () => {
        const id1 = TestSaga.id("run-001")
        const id2 = TestSaga.id("run-002")
        const id3 = TestSaga.id("run-003")

        expect(id1).toBe("test-saga-run-001")
        expect(id2).toBe("test-saga-run-002")
        expect(id3).toBe("test-saga-run-003")
        expect(id1).not.toBe(id2)
        expect(id2).not.toBe(id3)
      })

      it("should handle numeric runIds", () => {
        const sagaId = TestSaga.id("12345")
        expect(sagaId).toBe("test-saga-12345")
      })

      it("should handle UUID runIds", () => {
        const uuid = "550e8400-e29b-41d4-a716-446655440000"
        const sagaId = TestSaga.id(uuid)
        expect(sagaId).toBe(`test-saga-${uuid}`)
      })

      it("should handle special characters in runId", () => {
        const sagaId = TestSaga.id("order-2024-01-15")
        expect(sagaId).toBe("test-saga-order-2024-01-15")
      })
    })
  })

  describe("multiple implementations", () => {
    class OrderSaga extends SagaImplementation {
      protected static sagaName = "order-saga"
      protected static tasks = {
        VALIDATE_ORDER: "validateOrder",
        PROCESS_PAYMENT: "processPayment",
        RESERVE_INVENTORY: "reserveInventory",
      }

      protected sagaDefinition: SagaDefinition

      constructor() {
        super()
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async () => ({ validated: true }))
          .withName(OrderSaga.tasks.VALIDATE_ORDER)
          .next()
          .invoke(async () => ({ paymentId: "pay_123" }))
          .withName(OrderSaga.tasks.PROCESS_PAYMENT)
          .next()
          .invoke(async () => ({ reservationId: "res_456" }))
          .withName(OrderSaga.tasks.RESERVE_INVENTORY)
          .end()
      }
    }

    class ShippingSaga extends SagaImplementation {
      protected static sagaName = "shipping-saga"
      protected static tasks = {
        CREATE_SHIPMENT: "createShipment",
        ASSIGN_CARRIER: "assignCarrier",
        GENERATE_LABEL: "generateLabel",
      }

      protected sagaDefinition: SagaDefinition

      constructor() {
        super()
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async () => ({ shipmentId: "ship_123" }))
          .withName(ShippingSaga.tasks.CREATE_SHIPMENT)
          .next()
          .invoke(async () => ({ carrier: "FedEx" }))
          .withName(ShippingSaga.tasks.ASSIGN_CARRIER)
          .next()
          .invoke(async () => ({ labelUrl: "https://example.com/label.pdf" }))
          .withName(ShippingSaga.tasks.GENERATE_LABEL)
          .end()
      }
    }

    it("should allow multiple different implementations", () => {
      const orderSaga = new OrderSaga()
      const shippingSaga = new ShippingSaga()

      expect(orderSaga).toBeInstanceOf(SagaImplementation)
      expect(shippingSaga).toBeInstanceOf(SagaImplementation)
      expect(orderSaga).toBeInstanceOf(OrderSaga)
      expect(shippingSaga).toBeInstanceOf(ShippingSaga)
    })

    it("should have different sagaNames", () => {
      expect(OrderSaga["sagaName"]).toBe("order-saga")
      expect(ShippingSaga["sagaName"]).toBe("shipping-saga")
    })

    it("should have different tasks", () => {
      expect(OrderSaga["tasks"]).toEqual({
        VALIDATE_ORDER: "validateOrder",
        PROCESS_PAYMENT: "processPayment",
        RESERVE_INVENTORY: "reserveInventory",
      })
      expect(ShippingSaga["tasks"]).toEqual({
        CREATE_SHIPMENT: "createShipment",
        ASSIGN_CARRIER: "assignCarrier",
        GENERATE_LABEL: "generateLabel",
      })
    })

    it("should generate different saga ids", () => {
      const orderId = OrderSaga.id("order-001")
      const shippingId = ShippingSaga.id("ship-001")

      expect(orderId).toBe("order-saga-order-001")
      expect(shippingId).toBe("shipping-saga-ship-001")
    })

    it("should have different saga definitions", () => {
      const orderSaga = new OrderSaga()
      const shippingSaga = new ShippingSaga()

      const orderDef = orderSaga.getSagaDefinition()
      const shippingDef = shippingSaga.getSagaDefinition()

      expect(orderDef).not.toBe(shippingDef)
      expect(orderDef.steps).toHaveLength(5) // start + 3 + end
      expect(shippingDef.steps).toHaveLength(5) // start + 3 + end
    })
  })

  describe("edge cases", () => {
    it("should handle saga with single task", () => {
      class SingleTaskSaga extends SagaImplementation {
        protected static sagaName = "single-task"
        protected static tasks = {
          ONLY_TASK: "onlyTask",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ done: true }))
            .withName(SingleTaskSaga.tasks.ONLY_TASK)
            .end()
        }
      }

      const saga = new SingleTaskSaga()
      const definition = saga.getSagaDefinition()

      expect(definition.steps).toHaveLength(3) // start + 1 task + end
    })

    it("should handle saga with many tasks", () => {
      class ManyTasksSaga extends SagaImplementation {
        protected static sagaName = "many-tasks"
        protected static tasks = {
          TASK_1: "task1",
          TASK_2: "task2",
          TASK_3: "task3",
          TASK_4: "task4",
          TASK_5: "task5",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ task: "task1" }))
            .compensate(async () => {})
            .withName(ManyTasksSaga.tasks.TASK_1)
            .next()
            .invoke(async () => ({ task: "task2" }))
            .compensate(async () => {})
            .withName(ManyTasksSaga.tasks.TASK_2)
            .next()
            .invoke(async () => ({ task: "task3" }))
            .compensate(async () => {})
            .withName(ManyTasksSaga.tasks.TASK_3)
            .next()
            .invoke(async () => ({ task: "task4" }))
            .compensate(async () => {})
            .withName(ManyTasksSaga.tasks.TASK_4)
            .next()
            .invoke(async () => ({ task: "task5" }))
            .compensate(async () => {})
            .withName(ManyTasksSaga.tasks.TASK_5)
            .end()
        }
      }

      const saga = new ManyTasksSaga()
      const definition = saga.getSagaDefinition()

      expect(definition.steps).toHaveLength(7) // start + 5 tasks + end
      expect(Object.keys((ManyTasksSaga as any).tasks)).toHaveLength(5)
    })

    it("should handle saga with empty task names", () => {
      class EmptyTaskNameSaga extends SagaImplementation {
        protected static sagaName = "empty-name-saga"
        protected static tasks = {
          UNNAMED: "unnamed",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ result: "unnamed" }))
            .compensate(async () => {})
            .withName(EmptyTaskNameSaga.tasks.UNNAMED)
            .end()
        }
      }

      const saga = new EmptyTaskNameSaga()
      expect(saga.getSagaDefinition()).toBeInstanceOf(SagaDefinition)
      expect(saga.getSagaDefinition().steps).toHaveLength(3) // start + 1 task + end
    })

    it("should handle saga with special characters in sagaName", () => {
      class SpecialCharSaga extends SagaImplementation {
        protected static sagaName = "order-processing-v2.1"
        protected static tasks = {
          PROCESS: "process",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ done: true }))
            .withName(SpecialCharSaga.tasks.PROCESS)
            .end()
        }
      }

      const sagaId = SpecialCharSaga.id("run-001")
      expect(sagaId).toBe("order-processing-v2.1-run-001")
    })
  })

  describe("inheritance chain", () => {
    class BaseSaga extends SagaImplementation {
      protected static sagaName = "base-saga"
      protected static tasks = {
        BASE_TASK: "baseTask",
      }

      protected sagaDefinition: SagaDefinition

      constructor() {
        super()
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async () => ({ base: true }))
          .withName(BaseSaga.tasks.BASE_TASK)
          .end()
      }
    }

    class ExtendedSaga extends BaseSaga {
      protected static sagaName = "extended-saga"
      protected static tasks = {
        ...BaseSaga.tasks,
        EXTENDED_TASK: "extendedTask",
      }

      constructor() {
        super()
        // Override the saga definition
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async () => ({ base: true }))
          .withName(BaseSaga.tasks.BASE_TASK)
          .next()
          .invoke(async () => ({ extended: true }))
          .withName(ExtendedSaga.tasks.EXTENDED_TASK)
          .end()
      }
    }

    it("should support inheritance", () => {
      const baseSaga = new BaseSaga()
      const extendedSaga = new ExtendedSaga()

      expect(baseSaga).toBeInstanceOf(SagaImplementation)
      expect(extendedSaga).toBeInstanceOf(SagaImplementation)
      expect(extendedSaga).toBeInstanceOf(BaseSaga)
    })

    it("should have different sagaNames in inheritance chain", () => {
      expect(BaseSaga["sagaName"]).toBe("base-saga")
      expect(ExtendedSaga["sagaName"]).toBe("extended-saga")
    })

    it("should allow extending tasks", () => {
      expect(ExtendedSaga["tasks"]).toEqual({
        BASE_TASK: "baseTask",
        EXTENDED_TASK: "extendedTask",
      })
    })

    it("should generate different ids based on subclass sagaName", () => {
      const baseId = BaseSaga.id("run-001")
      const extendedId = ExtendedSaga.id("run-001")

      expect(baseId).toBe("base-saga-run-001")
      expect(extendedId).toBe("extended-saga-run-001")
    })
  })

  describe("getSagaDefinition()", () => {
    class ComplexSaga extends SagaImplementation {
      protected static sagaName = "complex-saga"
      protected static tasks = {
        STEP_A: "stepA",
        STEP_B: "stepB",
      }

      protected sagaDefinition: SagaDefinition

      constructor() {
        super()
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async (data) => {
            return { stepA: "completed", input: data }
          })
          .compensate(async () => {
            console.log("Compensating step A")
          })
          .withName(ComplexSaga.tasks.STEP_A)
          .next()
          .invoke(async (data, prevResult) => {
            return { stepB: "completed", prevResult }
          })
          .compensate(async () => {
            console.log("Compensating step B")
          })
          .withName(ComplexSaga.tasks.STEP_B)
          .end()
      }
    }

    it("should return the same definition instance on multiple calls", () => {
      const saga = new ComplexSaga()
      const def1 = saga.getSagaDefinition()
      const def2 = saga.getSagaDefinition()

      expect(def1).toBe(def2)
    })

    it("should return a valid SagaDefinition", () => {
      const saga = new ComplexSaga()
      const definition = saga.getSagaDefinition()

      expect(definition).toBeInstanceOf(SagaDefinition)
      expect(definition.steps).toBeDefined()
      expect(Array.isArray(definition.steps)).toBe(true)
    })

    it("should have steps with correct task names", () => {
      const saga = new ComplexSaga()
      const definition = saga.getSagaDefinition()

      const stepA = definition.steps.find((step) => step.taskName === "stepA")
      const stepB = definition.steps.find((step) => step.taskName === "stepB")

      expect(stepA).toBeDefined()
      expect(stepB).toBeDefined()
    })

    it("should have steps with invoke callbacks", () => {
      const saga = new ComplexSaga()
      const definition = saga.getSagaDefinition()

      const namedSteps = definition.steps.filter(
        (step) => !step.isStart && !step.isEnd
      )

      namedSteps.forEach((step) => {
        expect(step.invokeCallback).toBeDefined()
        expect(typeof step.invokeCallback).toBe("function")
      })
    })

    it("should have steps with compensate callbacks", () => {
      const saga = new ComplexSaga()
      const definition = saga.getSagaDefinition()

      const namedSteps = definition.steps.filter(
        (step) => !step.isStart && !step.isEnd
      )

      namedSteps.forEach((step) => {
        expect(step.compensateCallback).toBeDefined()
        expect(typeof step.compensateCallback).toBe("function")
      })
    })
  })

  describe("practical usage patterns", () => {
    it("should support saga with middleware", () => {
      class MiddlewareSaga extends SagaImplementation {
        protected static sagaName = "middleware-saga"
        protected static tasks = {
          MAIN_TASK: "mainTask",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ result: "done" }))
            .withMiddleware(async (data) => {
              return {
                ...(typeof data === "object" && data !== null
                  ? (data as object)
                  : {}),
                timestamp: new Date(),
              }
            })
            .withName(MiddlewareSaga.tasks.MAIN_TASK)
            .end()
        }
      }

      const saga = new MiddlewareSaga()
      const definition = saga.getSagaDefinition()
      const mainStep = definition.steps.find(
        (step) => step.taskName === "mainTask"
      )

      expect(mainStep).toBeDefined()
      expect(mainStep!.middleware).toBeDefined()
      expect(Array.isArray(mainStep!.middleware)).toBe(true)
      expect(mainStep!.middleware.length).toBeGreaterThan(0)
    })

    it("should support saga without compensation", () => {
      class NoCompensationSaga extends SagaImplementation {
        protected static sagaName = "no-compensation"
        protected static tasks = {
          IDEMPOTENT_TASK: "idempotentTask",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ result: "idempotent operation" }))
            .withName(NoCompensationSaga.tasks.IDEMPOTENT_TASK)
            .end()
        }
      }

      const saga = new NoCompensationSaga()
      const definition = saga.getSagaDefinition()

      expect(definition).toBeInstanceOf(SagaDefinition)
      expect(definition.steps.length).toBeGreaterThan(0)
    })

    it("should work with dynamic saga definitions", () => {
      class DynamicSaga extends SagaImplementation {
        protected static sagaName = "dynamic-saga"
        protected static tasks = {
          DYNAMIC_TASK: "dynamicTask",
        }

        protected sagaDefinition: SagaDefinition

        constructor(taskCount: number = 3) {
          super()

          let builder = SagaBuilder.start()

          for (let i = 0; i < taskCount; i++) {
            builder = builder
              .invoke(async () => ({ taskNumber: i }))
              .compensate(async () => {})
              .withName(`${DynamicSaga.tasks.DYNAMIC_TASK}-${i}`)

            // Only call next() if there are more tasks to add
            if (i < taskCount - 1) {
              builder = builder.next()
            }
          }

          this.sagaDefinition = builder.end()
        }
      }

      const saga3Tasks = new DynamicSaga(3)
      const saga5Tasks = new DynamicSaga(5)

      const def3 = saga3Tasks.getSagaDefinition()
      const def5 = saga5Tasks.getSagaDefinition()

      // Both should be valid, but have different lengths
      expect(def3).toBeInstanceOf(SagaDefinition)
      expect(def5).toBeInstanceOf(SagaDefinition)
      expect(def3.steps.length).toBeLessThan(def5.steps.length)
    })
  })
})
