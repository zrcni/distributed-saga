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
  createdAt: Date
  updatedAt: Date
  parentSagaId: string | null
  parentTaskId: string | null
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

  async getChildSagaIds(parentSagaId: string): Promise<ResultOk<string[]>> {
    try {
      const docs = await this.collection
        .find({ parentSagaId })
        .project<Pick<SagaDocument, "sagaId">>({ sagaId: 1 })
        .toArray()
      const childIds = docs.map((doc) => doc.sagaId)
      return Result.ok(childIds)
    } catch (error) {
      return Result.ok([])
    }
  }

  async startSaga<D>(
    sagaId: string,
    job: D,
    parentSagaId: string | null = null,
    parentTaskId: string | null = null
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

      const msg = SagaMessage.createStartSagaMessage(sagaId, job, parentSagaId, parentTaskId)

      const now = new Date()
      await this.collection.insertOne({
        _id: new ObjectId(),
        sagaId,
        messages: [msg],
        createdAt: now,
        updatedAt: now,
        parentSagaId,
        parentTaskId,
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
        {
          $push: { messages: msg },
          $set: { updatedAt: new Date() },
        }
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
    await collection.createIndex({ parentSagaId: 1 })
    await collection.createIndex({ updatedAt: 1 })
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

  /**
   * Delete sagas older than a specific date
   * Useful for cleaning up old completed or abandoned sagas
   */
  async deleteOldSagas(
    olderThan: Date
  ): Promise<ResultOk<number> | ResultError> {
    try {
      const result = await this.collection.deleteMany({
        updatedAt: { $lt: olderThan },
      })
      return Result.ok(result.deletedCount)
    } catch (error) {
      return Result.error(
        new SagaNotRunningError("failed to delete old sagas", {
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }

  /**
   * Get sagas that haven't been updated since a specific date
   * Useful for finding stale or abandoned sagas
   */
  async getStaleSagaIds(
    olderThan: Date
  ): Promise<ResultOk<string[]> | ResultError> {
    try {
      const docs = await this.collection
        .find({ updatedAt: { $lt: olderThan } })
        .project<Pick<SagaDocument, "sagaId">>({ sagaId: 1 })
        .toArray()
      const sagaIds = docs.map((doc) => doc.sagaId)
      return Result.ok(sagaIds)
    } catch (error) {
      return Result.error(
        new SagaNotRunningError("failed to get stale saga IDs", {
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }
}
