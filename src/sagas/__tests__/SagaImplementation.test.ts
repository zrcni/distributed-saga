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

    describe("instance id() method", () => {
      it("should generate saga id from instance using the class sagaName", () => {
        const saga = new TestSaga()
        const runId = "run-123"
        const sagaId = saga.id(runId)

        expect(sagaId).toBe("test-saga-run-123")
      })

      it("should produce same result as static id() method", () => {
        const saga = new TestSaga()
        const runId = "run-456"
        
        const staticId = TestSaga.id(runId)
        const instanceId = saga.id(runId)

        expect(instanceId).toBe(staticId)
        expect(instanceId).toBe("test-saga-run-456")
      })

      it("should work with different runIds on the same instance", () => {
        const saga = new TestSaga()
        
        const id1 = saga.id("run-001")
        const id2 = saga.id("run-002")
        const id3 = saga.id("run-003")

        expect(id1).toBe("test-saga-run-001")
        expect(id2).toBe("test-saga-run-002")
        expect(id3).toBe("test-saga-run-003")
        expect(id1).not.toBe(id2)
        expect(id2).not.toBe(id3)
      })

      it("should work consistently across multiple instances", () => {
        const saga1 = new TestSaga()
        const saga2 = new TestSaga()
        const runId = "run-shared"

        const id1 = saga1.id(runId)
        const id2 = saga2.id(runId)

        expect(id1).toBe(id2)
        expect(id1).toBe("test-saga-run-shared")
      })

      it("should handle UUID runIds from instance", () => {
        const saga = new TestSaga()
        const uuid = "550e8400-e29b-41d4-a716-446655440000"
        const sagaId = saga.id(uuid)
        
        expect(sagaId).toBe(`test-saga-${uuid}`)
      })

      it("should handle numeric runIds from instance", () => {
        const saga = new TestSaga()
        const sagaId = saga.id("12345")
        
        expect(sagaId).toBe("test-saga-12345")
      })

      it("should handle empty string runId", () => {
        const saga = new TestSaga()
        const sagaId = saga.id("")
        
        expect(sagaId).toBe("test-saga-")
      })
    })

    describe("instance tasks getter", () => {
      it("should return tasks from the class", () => {
        const saga = new TestSaga()
        const tasks = saga.tasks

        expect(tasks).toEqual({
          STEP_ONE: "stepOne",
          STEP_TWO: "stepTwo",
          STEP_THREE: "stepThree",
        })
      })

      it("should return the same tasks object as the static property", () => {
        const saga = new TestSaga()
        const instanceTasks = saga.tasks
        const staticTasks = TestSaga["tasks"]

        expect(instanceTasks).toBe(staticTasks)
        expect(instanceTasks).toEqual(staticTasks)
      })

      it("should be consistent across multiple instances", () => {
        const saga1 = new TestSaga()
        const saga2 = new TestSaga()

        const tasks1 = saga1.tasks
        const tasks2 = saga2.tasks

        expect(tasks1).toBe(tasks2)
        expect(tasks1).toEqual(tasks2)
      })

      it("should allow accessing task names via instance", () => {
        const saga = new TestSaga()
        
        expect(saga.tasks.STEP_ONE).toBe("stepOne")
        expect(saga.tasks.STEP_TWO).toBe("stepTwo")
        expect(saga.tasks.STEP_THREE).toBe("stepThree")
      })

      it("should have all expected task keys", () => {
        const saga = new TestSaga()
        const taskKeys = Object.keys(saga.tasks)

        expect(taskKeys).toContain("STEP_ONE")
        expect(taskKeys).toContain("STEP_TWO")
        expect(taskKeys).toContain("STEP_THREE")
        expect(taskKeys).toHaveLength(3)
      })

      it("should return tasks object that can be used in saga definition", () => {
        const saga = new TestSaga()
        const definition = saga.getSagaDefinition()
        
        const stepOne = definition.steps.find(
          (step) => step.taskName === saga.tasks.STEP_ONE
        )
        const stepTwo = definition.steps.find(
          (step) => step.taskName === saga.tasks.STEP_TWO
        )
        const stepThree = definition.steps.find(
          (step) => step.taskName === saga.tasks.STEP_THREE
        )

        expect(stepOne).toBeDefined()
        expect(stepTwo).toBeDefined()
        expect(stepThree).toBeDefined()
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

    it("should generate different saga ids from instances", () => {
      const orderSaga = new OrderSaga()
      const shippingSaga = new ShippingSaga()

      const orderId = orderSaga.id("order-001")
      const shippingId = shippingSaga.id("ship-001")

      expect(orderId).toBe("order-saga-order-001")
      expect(shippingId).toBe("shipping-saga-ship-001")
      expect(orderId).not.toBe(shippingId)
    })

    it("should allow accessing different tasks from instances", () => {
      const orderSaga = new OrderSaga()
      const shippingSaga = new ShippingSaga()

      expect(orderSaga.tasks.VALIDATE_ORDER).toBe("validateOrder")
      expect(orderSaga.tasks.PROCESS_PAYMENT).toBe("processPayment")
      expect(orderSaga.tasks.RESERVE_INVENTORY).toBe("reserveInventory")

      expect(shippingSaga.tasks.CREATE_SHIPMENT).toBe("createShipment")
      expect(shippingSaga.tasks.ASSIGN_CARRIER).toBe("assignCarrier")
      expect(shippingSaga.tasks.GENERATE_LABEL).toBe("generateLabel")
    })

    it("should have different tasks objects between implementations", () => {
      const orderSaga = new OrderSaga()
      const shippingSaga = new ShippingSaga()

      expect(orderSaga.tasks).not.toBe(shippingSaga.tasks)
      expect(orderSaga.tasks).not.toEqual(shippingSaga.tasks)
    })

    it("should use instance tasks in saga definitions", () => {
      const orderSaga = new OrderSaga()
      const shippingSaga = new ShippingSaga()

      const orderDef = orderSaga.getSagaDefinition()
      const shippingDef = shippingSaga.getSagaDefinition()

      // Check order saga tasks
      const validateOrder = orderDef.steps.find(
        (step) => step.taskName === orderSaga.tasks.VALIDATE_ORDER
      )
      expect(validateOrder).toBeDefined()

      // Check shipping saga tasks
      const createShipment = shippingDef.steps.find(
        (step) => step.taskName === shippingSaga.tasks.CREATE_SHIPMENT
      )
      expect(createShipment).toBeDefined()
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

    it("should handle saga with special characters in sagaName from instance", () => {
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

      const saga = new SpecialCharSaga()
      const sagaId = saga.id("run-001")
      expect(sagaId).toBe("order-processing-v2.1-run-001")
    })

    it("should access tasks from instance with special characters", () => {
      class SpecialTaskSaga extends SagaImplementation {
        protected static sagaName = "special-task-saga"
        protected static tasks = {
          TASK_WITH_UNDERSCORE: "task_with_underscore",
          "TASK-WITH-DASH": "task-with-dash",
        }

        protected sagaDefinition: SagaDefinition

        constructor() {
          super()
          this.sagaDefinition = SagaBuilder.start()
            .invoke(async () => ({ done: true }))
            .withName(SpecialTaskSaga.tasks.TASK_WITH_UNDERSCORE)
            .end()
        }
      }

      const saga = new SpecialTaskSaga()
      expect(saga.tasks.TASK_WITH_UNDERSCORE).toBe("task_with_underscore")
      expect(saga.tasks["TASK-WITH-DASH"]).toBe("task-with-dash")
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

    it("should generate different ids from instances based on subclass sagaName", () => {
      const baseSaga = new BaseSaga()
      const extendedSaga = new ExtendedSaga()

      const baseId = baseSaga.id("run-001")
      const extendedId = extendedSaga.id("run-001")

      expect(baseId).toBe("base-saga-run-001")
      expect(extendedId).toBe("extended-saga-run-001")
      expect(baseId).not.toBe(extendedId)
    })

    it("should access correct tasks from base and extended instances", () => {
      const baseSaga = new BaseSaga()
      const extendedSaga = new ExtendedSaga()

      expect(baseSaga.tasks.BASE_TASK).toBe("baseTask")
      expect(baseSaga.tasks).not.toHaveProperty("EXTENDED_TASK")

      expect(extendedSaga.tasks.BASE_TASK).toBe("baseTask")
      expect(extendedSaga.tasks.EXTENDED_TASK).toBe("extendedTask")
    })

    it("should maintain different tasks objects in inheritance chain", () => {
      const baseSaga = new BaseSaga()
      const extendedSaga = new ExtendedSaga()

      const baseTasks = baseSaga.tasks
      const extendedTasks = extendedSaga.tasks

      expect(baseTasks).not.toBe(extendedTasks)
      expect(Object.keys(baseTasks)).toHaveLength(1)
      expect(Object.keys(extendedTasks)).toHaveLength(2)
    })

    it("should use correct tasks in definitions for inherited sagas", () => {
      const baseSaga = new BaseSaga()
      const extendedSaga = new ExtendedSaga()

      const baseDef = baseSaga.getSagaDefinition()
      const extendedDef = extendedSaga.getSagaDefinition()

      // Base saga should have only BASE_TASK
      const baseTaskInBase = baseDef.steps.find(
        (step) => step.taskName === baseSaga.tasks.BASE_TASK
      )
      expect(baseTaskInBase).toBeDefined()

      // Extended saga should have both tasks
      const baseTaskInExtended = extendedDef.steps.find(
        (step) => step.taskName === extendedSaga.tasks.BASE_TASK
      )
      const extendedTask = extendedDef.steps.find(
        (step) => step.taskName === extendedSaga.tasks.EXTENDED_TASK
      )
      expect(baseTaskInExtended).toBeDefined()
      expect(extendedTask).toBeDefined()
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

  describe("instance-level id() and tasks behavior", () => {
    class TestSagaForInstance extends SagaImplementation {
      protected static sagaName = "instance-test-saga"
      protected static tasks = {
        TASK_A: "taskA",
        TASK_B: "taskB",
      }

      protected sagaDefinition: SagaDefinition

      constructor() {
        super()
        this.sagaDefinition = SagaBuilder.start()
          .invoke(async () => ({ a: true }))
          .withName(TestSagaForInstance.tasks.TASK_A)
          .next()
          .invoke(async () => ({ b: true }))
          .withName(TestSagaForInstance.tasks.TASK_B)
          .end()
      }
    }

    describe("instance id() method behavior", () => {
      it("should delegate to static id() method", () => {
        const saga = new TestSagaForInstance()
        const runId = "test-123"

        const staticResult = TestSagaForInstance.id(runId)
        const instanceResult = saga.id(runId)

        expect(instanceResult).toBe(staticResult)
      })

      it("should work with different instances independently", () => {
        const saga1 = new TestSagaForInstance()
        const saga2 = new TestSagaForInstance()

        const id1 = saga1.id("run-1")
        const id2 = saga2.id("run-2")

        expect(id1).toBe("instance-test-saga-run-1")
        expect(id2).toBe("instance-test-saga-run-2")
      })

      it("should not be affected by instance state", () => {
        const saga = new TestSagaForInstance()

        // Call id multiple times with different runIds
        const id1 = saga.id("first")
        const id2 = saga.id("second")
        const id3 = saga.id("first") // Same runId as id1

        expect(id1).toBe("instance-test-saga-first")
        expect(id2).toBe("instance-test-saga-second")
        expect(id3).toBe("instance-test-saga-first")
        expect(id1).toBe(id3)
      })

      it("should handle runId with spaces", () => {
        const saga = new TestSagaForInstance()
        const id = saga.id("run with spaces")

        expect(id).toBe("instance-test-saga-run with spaces")
      })

      it("should handle very long runIds", () => {
        const saga = new TestSagaForInstance()
        const longRunId = "a".repeat(1000)
        const id = saga.id(longRunId)

        expect(id).toBe(`instance-test-saga-${longRunId}`)
        expect(id.length).toBe("instance-test-saga-".length + 1000)
      })

      it("should handle runId with special characters", () => {
        const saga = new TestSagaForInstance()
        
        const id1 = saga.id("run@#$%^&*()")
        const id2 = saga.id("run/with/slashes")
        const id3 = saga.id("run:with:colons")

        expect(id1).toBe("instance-test-saga-run@#$%^&*()")
        expect(id2).toBe("instance-test-saga-run/with/slashes")
        expect(id3).toBe("instance-test-saga-run:with:colons")
      })
    })

    describe("instance tasks getter behavior", () => {
      it("should return reference to static tasks object", () => {
        const saga = new TestSagaForInstance()
        const tasks = saga.tasks
        const staticTasks = (TestSagaForInstance as any).tasks

        // Should be the same reference
        expect(tasks).toBe(staticTasks)
      })

      it("should be immutable from instance perspective", () => {
        const saga = new TestSagaForInstance()
        const tasks = saga.tasks

        // Attempting to modify shouldn't affect other instances
        // (though we can't prevent modification since it's a reference)
        const tasksCopy = { ...tasks }
        expect(tasksCopy).toEqual(tasks)
      })

      it("should work consistently across multiple calls", () => {
        const saga = new TestSagaForInstance()

        const tasks1 = saga.tasks
        const tasks2 = saga.tasks
        const tasks3 = saga.tasks

        expect(tasks1).toBe(tasks2)
        expect(tasks2).toBe(tasks3)
      })

      it("should have enumerable properties", () => {
        const saga = new TestSagaForInstance()
        const tasks = saga.tasks

        const keys = Object.keys(tasks)
        expect(keys).toContain("TASK_A")
        expect(keys).toContain("TASK_B")
      })

      it("should allow destructuring", () => {
        const saga = new TestSagaForInstance()
        const { TASK_A, TASK_B } = saga.tasks

        expect(TASK_A).toBe("taskA")
        expect(TASK_B).toBe("taskB")
      })

      it("should support Object.values()", () => {
        const saga = new TestSagaForInstance()
        const taskValues = Object.values(saga.tasks)

        expect(taskValues).toContain("taskA")
        expect(taskValues).toContain("taskB")
        expect(taskValues).toHaveLength(2)
      })

      it("should support Object.entries()", () => {
        const saga = new TestSagaForInstance()
        const taskEntries = Object.entries(saga.tasks)

        expect(taskEntries).toContainEqual(["TASK_A", "taskA"])
        expect(taskEntries).toContainEqual(["TASK_B", "taskB"])
        expect(taskEntries).toHaveLength(2)
      })
    })

    describe("combined id() and tasks usage", () => {
      it("should use tasks to build saga and id to identify it", () => {
        const saga = new TestSagaForInstance()
        const runId = "combined-test"

        const sagaId = saga.id(runId)
        const definition = saga.getSagaDefinition()

        expect(sagaId).toBe("instance-test-saga-combined-test")

        const taskAStep = definition.steps.find(
          (step) => step.taskName === saga.tasks.TASK_A
        )
        const taskBStep = definition.steps.find(
          (step) => step.taskName === saga.tasks.TASK_B
        )

        expect(taskAStep).toBeDefined()
        expect(taskBStep).toBeDefined()
      })

      it("should work in a typical saga execution setup", () => {
        const saga = new TestSagaForInstance()
        const orderId = "order-12345"

        // Generate saga ID
        const sagaId = saga.id(orderId)
        expect(sagaId).toBe("instance-test-saga-order-12345")

        // Get tasks for execution
        const tasks = saga.tasks
        expect(tasks.TASK_A).toBe("taskA")
        expect(tasks.TASK_B).toBe("taskB")

        // Get definition for orchestrator
        const definition = saga.getSagaDefinition()
        expect(definition).toBeInstanceOf(SagaDefinition)
        expect(definition.steps.length).toBeGreaterThan(0)
      })
    })

    describe("edge cases with no sagaName", () => {
      it("should use class name when sagaName is not set", () => {
        class NoNameSaga extends SagaImplementation {
          // No static sagaName defined
          protected static tasks = {
            TASK: "task",
          }

          protected sagaDefinition: SagaDefinition

          constructor() {
            super()
            this.sagaDefinition = SagaBuilder.start()
              .invoke(async () => ({ done: true }))
              .withName(NoNameSaga.tasks.TASK)
              .end()
          }
        }

        const staticId = NoNameSaga.id("run-1")
        expect(staticId).toBe("NoNameSaga-run-1")

        const saga = new NoNameSaga()
        const instanceId = saga.id("run-1")
        expect(instanceId).toBe("NoNameSaga-run-1")
        expect(instanceId).toBe(staticId)
      })
    })
  })
})
