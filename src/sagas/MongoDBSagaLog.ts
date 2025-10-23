import { SagaAlreadyRunningError, SagaNotRunningError } from "@/errors"
import { SagaLog, SagaLogTransactionOptions } from "./types"
import { SagaCoordinator } from "./SagaCoordinator"
import { SagaMessage } from "./SagaMessage"
import { Collection, ObjectId, ClientSession } from "mongodb"

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

  async getMessages(sagaId: string): Promise<SagaMessage[]> {
    try {
      const doc = await this.collection.findOne({ sagaId })

      if (!doc) {
        throw new SagaNotRunningError("saga has not started yet", {
          sagaId,
        })
      }

      return doc.messages
    } catch (error) {
      if (error instanceof SagaNotRunningError) {
        throw error
      }
      throw new SagaNotRunningError("failed to get messages", {
        sagaId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async getActiveSagaIds(): Promise<string[]> {
    try {
      const docs = await this.collection
        .find({})
        .project<Pick<SagaDocument, "sagaId">>({ sagaId: 1 })
        .toArray()
      // Ensure _id is converted to string in case it's an ObjectId
      const sagaIds = docs.map((doc) => doc.sagaId)
      return sagaIds
    } catch (error) {
      // Return empty array on error - this method is often used for listing
      return []
    }
  }

  async getChildSagaIds(parentSagaId: string, options?: SagaLogTransactionOptions): Promise<string[]> {
    try {
      const findOptions = options?.session ? { session: options.session as ClientSession } : {}
      const docs = await this.collection
        .find({ parentSagaId }, findOptions)
        .project<Pick<SagaDocument, "sagaId">>({ sagaId: 1 })
        .toArray()
      const childIds = docs.map((doc) => doc.sagaId)
      return childIds
    } catch (error) {
      // Return empty array on error
      return []
    }
  }

  async startSaga<D>(
    sagaId: string,
    job: D,
    parentSagaId: string | null = null,
    parentTaskId: string | null = null
  ): Promise<void> {
    try {
      const existingDoc = await this.collection.findOne({ sagaId })

      if (existingDoc) {
        throw new SagaAlreadyRunningError("saga has already been started", {
          sagaId,
        })
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
    } catch (error) {
      if (error instanceof SagaAlreadyRunningError) {
        throw error
      }
      throw new SagaAlreadyRunningError("failed to start saga", {
        sagaId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async logMessage(msg: SagaMessage): Promise<void> {
    try {
      const result = await this.collection.updateOne(
        { sagaId: msg.sagaId },
        {
          $push: { messages: msg },
          $set: { updatedAt: new Date() },
        }
      )

      if (result.matchedCount === 0) {
        throw new SagaNotRunningError("saga has not started yet", {
          sagaId: msg.sagaId,
          taskId: msg.taskId,
        })
      }
    } catch (error) {
      if (error instanceof SagaNotRunningError) {
        throw error
      }
      throw new SagaNotRunningError("failed to log message", {
        sagaId: msg.sagaId,
        taskId: msg.taskId,
        error: error instanceof Error ? error.message : String(error),
      })
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
  async deleteSaga(sagaId: string, options?: SagaLogTransactionOptions): Promise<void> {
    try {
      const deleteOptions = options?.session ? { session: options.session as ClientSession } : {}
      await this.collection.deleteOne({ sagaId }, deleteOptions)
    } catch (error) {
      throw new SagaNotRunningError("failed to delete saga", {
        sagaId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Delete sagas older than a specific date
   * Useful for cleaning up old completed or abandoned sagas
   */
  async deleteOldSagas(olderThan: Date): Promise<number> {
    try {
      const result = await this.collection.deleteMany({
        updatedAt: { $lt: olderThan },
      })
      return result.deletedCount
    } catch (error) {
      throw new SagaNotRunningError("failed to delete old sagas", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get sagas that haven't been updated since a specific date
   * Useful for finding stale or abandoned sagas
   */
  async getStaleSagaIds(olderThan: Date): Promise<string[]> {
    try {
      const docs = await this.collection
        .find({ updatedAt: { $lt: olderThan } })
        .project<Pick<SagaDocument, "sagaId">>({ sagaId: 1 })
        .toArray()
      const sagaIds = docs.map((doc) => doc.sagaId)
      return sagaIds
    } catch (error) {
      throw new SagaNotRunningError("failed to get stale saga IDs", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Begin a MongoDB transaction session
   */
  async beginTransaction(): Promise<ClientSession> {
    const session = this.collection.db.client.startSession()
    session.startTransaction()
    return session
  }

  /**
   * Commit a MongoDB transaction
   */
  async commitTransaction(session: ClientSession): Promise<void> {
    await session.commitTransaction()
    await session.endSession()
  }

  /**
   * Abort/rollback a MongoDB transaction
   */
  async abortTransaction(session: ClientSession): Promise<void> {
    await session.abortTransaction()
    await session.endSession()
  }
}