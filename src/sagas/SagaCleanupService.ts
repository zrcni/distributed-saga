import { SagaLog } from "./types"
import { SagaMessage, SagaMessageType } from "./SagaMessage"

export interface SagaCleanupOptions {
  /**
   * Delete completed sagas older than this duration (in milliseconds)
   * Default: 7 days (7 * 24 * 60 * 60 * 1000)
   */
  completedSagaRetentionMs?: number

  /**
   * Delete aborted sagas older than this duration (in milliseconds)
   * Default: 30 days
   */
  abortedSagaRetentionMs?: number

  /**
   * How often to run the cleanup job (in milliseconds)
   * Default: 1 hour
   */
  cleanupIntervalMs?: number

  /**
   * Archive sagas before deletion (callback)
   * If provided, this function will be called with saga data before deletion
   */
  archiveBeforeDelete?: (sagaId: string, messages: SagaMessage[]) => Promise<void>

  /**
   * Custom filter to determine which sagas should be cleaned up
   * Return true to delete the saga
   */
  shouldCleanupSaga?: (sagaId: string, messages: SagaMessage[]) => boolean

  /**
   * Log cleanup actions
   */
  onCleanup?: (deletedCount: number, archivedCount: number) => void

  /**
   * Log errors during cleanup
   */
  onError?: (error: Error) => void
}

export class SagaCleanupService {
  private log: SagaLog
  private options: Required<Omit<SagaCleanupOptions, 'archiveBeforeDelete' | 'shouldCleanupSaga' | 'onCleanup' | 'onError'>> & Pick<SagaCleanupOptions, 'archiveBeforeDelete' | 'shouldCleanupSaga' | 'onCleanup' | 'onError'>
  private intervalHandle?: NodeJS.Timeout
  private isRunning = false

  constructor(log: SagaLog, options: SagaCleanupOptions = {}) {
    this.log = log
    this.options = {
      completedSagaRetentionMs: options.completedSagaRetentionMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      abortedSagaRetentionMs: options.abortedSagaRetentionMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      cleanupIntervalMs: options.cleanupIntervalMs ?? 60 * 60 * 1000, // 1 hour
      archiveBeforeDelete: options.archiveBeforeDelete,
      shouldCleanupSaga: options.shouldCleanupSaga,
      onCleanup: options.onCleanup,
      onError: options.onError,
    }
  }

  /**
   * Start the automatic cleanup service
   */
  start(): void {
    if (this.intervalHandle) {
      return // Already running
    }

    // Run immediately
    this.runCleanup().catch((error) => {
      this.options.onError?.(error)
    })

    // Then run on interval
    this.intervalHandle = setInterval(() => {
      this.runCleanup().catch((error) => {
        this.options.onError?.(error)
      })
    }, this.options.cleanupIntervalMs)
  }

  /**
   * Stop the automatic cleanup service
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = undefined
    }
  }

  /**
   * Manually run cleanup once
   */
  async runCleanup(): Promise<{ deleted: number; archived: number }> {
    if (this.isRunning) {
      return { deleted: 0, archived: 0 }
    }

    this.isRunning = true
    let deletedCount = 0
    let archivedCount = 0

    try {
      const sagaIds = await this.log.getActiveSagaIds()

      for (const sagaId of sagaIds) {
        try {
          const shouldDelete = await this.shouldDeleteSaga(sagaId)
          
          if (shouldDelete) {
            // Archive before delete if callback provided
            if (this.options.archiveBeforeDelete) {
              const messages = await this.log.getMessages(sagaId)
              await this.options.archiveBeforeDelete(sagaId, messages)
              archivedCount++
            }

            // Delete the saga
            await this.log.deleteSaga(sagaId)
            deletedCount++
          }
        } catch (error) {
          this.options.onError?.(
            error instanceof Error ? error : new Error(String(error))
          )
        }
      }

      this.options.onCleanup?.(deletedCount, archivedCount)
    } finally {
      this.isRunning = false
    }

    return { deleted: deletedCount, archived: archivedCount }
  }

  /**
   * Determine if a saga should be deleted
   */
  private async shouldDeleteSaga(sagaId: string): Promise<boolean> {
    try {
      const messages = await this.log.getMessages(sagaId)
      
      if (messages.length === 0) {
        return false
      }

      // Use custom filter if provided
      if (this.options.shouldCleanupSaga) {
        return this.options.shouldCleanupSaga(sagaId, messages)
      }

      // Default behavior: check if saga is completed or aborted
      const lastMessage = messages[messages.length - 1]
    const isCompleted = lastMessage.msgType === SagaMessageType.EndSaga
    const isAborted = lastMessage.msgType === SagaMessageType.AbortSaga

    if (!isCompleted && !isAborted) {
      return false // Saga is still active
    }

    // Check age of the saga
    const lastUpdate = lastMessage.timestamp
    const now = new Date()
    const ageMs = now.getTime() - lastUpdate.getTime()

    if (isCompleted) {
      return ageMs > this.options.completedSagaRetentionMs
    } else if (isAborted) {
      return ageMs > this.options.abortedSagaRetentionMs
    }

    return false
    } catch (error) {
      return false
    }
  }

  /**
   * Get statistics about sagas that would be cleaned up
   */
  async getCleanupStats(): Promise<{
    completedToDelete: number
    abortedToDelete: number
    activeTotal: number
  }> {
    try {
      const sagaIds = await this.log.getActiveSagaIds()
      let completedToDelete = 0
      let abortedToDelete = 0

      for (const sagaId of sagaIds) {
        try {
          const messages = await this.log.getMessages(sagaId)
          
          if (messages.length === 0) {
            continue
          }

          const lastMessage = messages[messages.length - 1]
        const lastUpdate = lastMessage.timestamp
        const now = new Date()
        const ageMs = now.getTime() - lastUpdate.getTime()

        if (lastMessage.msgType === SagaMessageType.EndSaga) {
          if (ageMs > this.options.completedSagaRetentionMs) {
            completedToDelete++
          }
        } else if (lastMessage.msgType === SagaMessageType.AbortSaga) {
          if (ageMs > this.options.abortedSagaRetentionMs) {
            abortedToDelete++
          }
        }
      } catch (error) {
        // Skip this saga
      }
    }

    return {
      completedToDelete,
      abortedToDelete,
      activeTotal: sagaIds.length,
    }
    } catch (error) {
      return { completedToDelete: 0, abortedToDelete: 0, activeTotal: 0 }
    }
  }
}
