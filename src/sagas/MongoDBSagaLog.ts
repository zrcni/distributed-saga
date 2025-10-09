import { SagaAlreadyRunningError, SagaNotRunningError } from "@/errors"
import { Result, ResultError, ResultOk } from "@/Result"
import { SagaLog } from "./types"
import { SagaCoordinator } from "./SagaCoordinator"
import { SagaMessage } from "./SagaMessage"
import { Collection, ObjectId } from "mongodb"

interface SagaDocument {
  _id: ObjectId
  sagaId: string
  messages: SagaMessage[]
}

export class MongoDBSagaLog implements SagaLog {
  private collection: Collection<SagaDocument>

  constructor(collection: Collection<SagaDocument>) {
    this.collection = collection
  }

  async getMessages(
    sagaId: string
  ): Promise<ResultOk<SagaMessage[]> | ResultError<SagaNotRunningError>> {
    try {
      const doc = await this.collection.findOne({ sagaId })

      if (!doc) {
        return Result.error(
          new SagaNotRunningError("saga has not started yet", {
            sagaId,
          })
        )
      }

      return Result.ok(doc.messages)
    } catch (error) {
      return Result.error(
        new SagaNotRunningError("failed to get messages", {
          sagaId,
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }

  async getActiveSagaIds(): Promise<ResultOk<string[]>> {
    try {
      const docs = await this.collection
        .find({})
        .project<Pick<SagaDocument, "sagaId">>({ sagaId: 1 })
        .toArray()
      // Ensure _id is converted to string in case it's an ObjectId
      const sagaIds = docs.map((doc) => doc.sagaId)
      return Result.ok(sagaIds)
    } catch (error) {
      return Result.ok([])
    }
  }

  async startSaga<D>(
    sagaId: string,
    job: D
  ): Promise<ResultOk | ResultError<SagaAlreadyRunningError>> {
    try {
      const existingDoc = await this.collection.findOne({ sagaId })

      if (existingDoc) {
        return Result.error(
          new SagaAlreadyRunningError("saga has already been started", {
            sagaId,
          })
        )
      }

      const msg = SagaMessage.createStartSagaMessage(sagaId, job)

      await this.collection.insertOne({
        _id: new ObjectId(),
        sagaId,
        messages: [msg],
      })

      return Result.ok()
    } catch (error) {
      return Result.error(
        new SagaAlreadyRunningError("failed to start saga", {
          sagaId,
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }

  async logMessage(
    msg: SagaMessage
  ): Promise<ResultOk | ResultError<SagaNotRunningError>> {
    try {
      const result = await this.collection.updateOne(
        { sagaId: msg.sagaId },
        { $push: { messages: msg } }
      )

      if (result.matchedCount === 0) {
        return Result.error(
          new SagaNotRunningError("saga has not started yet", {
            sagaId: msg.sagaId,
            taskId: msg.taskId,
          })
        )
      }

      return Result.ok()
    } catch (error) {
      return Result.error(
        new SagaNotRunningError("failed to log message", {
          sagaId: msg.sagaId,
          taskId: msg.taskId,
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }

  static createMongoDBSagaCoordinator(collection: Collection<SagaDocument>) {
    const log = new MongoDBSagaLog(collection)
    return SagaCoordinator.create(log)
  }

  static async createIndexes(collection: Collection<SagaDocument>) {
    await collection.createIndex({ sagaId: 1 }, { unique: true })
  }

  /**
   * Clean up completed sagas
   */
  async deleteSaga(sagaId: string): Promise<ResultOk | ResultError> {
    try {
      await this.collection.deleteOne({ sagaId })
      return Result.ok()
    } catch (error) {
      return Result.error(
        new SagaNotRunningError("failed to delete saga", {
          sagaId,
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }
}
