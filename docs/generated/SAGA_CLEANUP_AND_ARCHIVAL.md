# Saga Cleanup and Archival

## Overview

The `SagaCleanupService` provides automatic expiration and archival of completed or aborted sagas. This prevents unbounded growth of saga storage and allows you to maintain a clean, performant system.

## Features

- ✅ Automatic cleanup of completed sagas after configurable retention period
- ✅ Separate retention periods for completed vs aborted sagas
- ✅ Optional archival before deletion
- ✅ Custom cleanup filters
- ✅ Scheduled automatic cleanup
- ✅ Manual cleanup trigger
- ✅ Cleanup statistics
- ✅ Error handling and logging

## Basic Usage

### Simple Setup (7-day retention)

```typescript
import { SagaCleanupService } from '@zrcni/distributed-saga'

// Create cleanup service with default 7-day retention
const cleanupService = new SagaCleanupService(coordinator.log)

// Start automatic cleanup (runs every hour)
cleanupService.start()

// Stop when shutting down
process.on('SIGTERM', () => {
  cleanupService.stop()
})
```

### Custom Retention Periods

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,   // 7 days for completed
  abortedSagaRetentionMs: 30 * 24 * 60 * 60 * 1000,    // 30 days for aborted
  cleanupIntervalMs: 2 * 60 * 60 * 1000,               // Run every 2 hours
})

cleanupService.start()
```

## Archival Before Deletion

Archive sagas to external storage before deleting them:

### Archive to File System

```typescript
import * as fs from 'fs/promises'
import * as path from 'path'

const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  
  archiveBeforeDelete: async (sagaId, messages) => {
    const archivePath = path.join('./archives', `${sagaId}.json`)
    const archiveData = {
      sagaId,
      archivedAt: new Date().toISOString(),
      messages,
    }
    
    await fs.mkdir('./archives', { recursive: true })
    await fs.writeFile(archivePath, JSON.stringify(archiveData, null, 2))
    console.log(`Archived saga ${sagaId} to ${archivePath}`)
  },
  
  onCleanup: (deleted, archived) => {
    console.log(`Cleanup completed: ${deleted} deleted, ${archived} archived`)
  },
  
  onError: (error) => {
    console.error('Cleanup error:', error)
  },
})

cleanupService.start()
```

### Archive to MongoDB Collection

```typescript
import { MongoClient } from 'mongodb'

const client = new MongoClient('mongodb://localhost:27017')
const archiveCollection = client.db('myapp').collection('saga_archives')

const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  
  archiveBeforeDelete: async (sagaId, messages) => {
    await archiveCollection.insertOne({
      sagaId,
      archivedAt: new Date(),
      messages,
      metadata: {
        totalMessages: messages.length,
        startedAt: messages[0]?.timestamp,
        completedAt: messages[messages.length - 1]?.timestamp,
      },
    })
  },
})

cleanupService.start()
```

### Archive to S3

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: 'us-east-1' })

const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  
  archiveBeforeDelete: async (sagaId, messages) => {
    const key = `saga-archives/${new Date().toISOString().split('T')[0]}/${sagaId}.json`
    
    await s3.send(new PutObjectCommand({
      Bucket: 'my-saga-archives',
      Key: key,
      Body: JSON.stringify({ sagaId, messages }, null, 2),
      ContentType: 'application/json',
    }))
    
    console.log(`Archived saga ${sagaId} to S3: ${key}`)
  },
})

cleanupService.start()
```

## Custom Cleanup Logic

### Custom Filter

Implement custom logic to determine which sagas should be cleaned up:

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  shouldCleanupSaga: (sagaId, messages) => {
    const lastMessage = messages[messages.length - 1]
    
    // Only cleanup completed sagas, never aborted ones
    if (lastMessage.msgType !== SagaMessageType.EndSaga) {
      return false
    }
    
    // Check if saga is older than 7 days
    const ageMs = Date.now() - lastMessage.timestamp.getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    
    if (ageMs < sevenDays) {
      return false
    }
    
    // Custom logic: Keep sagas with errors for 30 days
    const hasErrors = messages.some(msg => 
      msg.data && typeof msg.data === 'object' && 'error' in msg.data
    )
    
    if (hasErrors) {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      return ageMs > thirtyDays
    }
    
    return true
  },
})

cleanupService.start()
```

### Cleanup Specific Saga Types

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  shouldCleanupSaga: (sagaId, messages) => {
    const firstMessage = messages[0]
    
    // Only cleanup "order" sagas
    if (!sagaId.startsWith('order-')) {
      return false
    }
    
    // Check age
    const ageMs = Date.now() - firstMessage.timestamp.getTime()
    return ageMs > 7 * 24 * 60 * 60 * 1000
  },
})

cleanupService.start()
```

## Manual Cleanup

Run cleanup manually instead of automatically:

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
})

// Don't start automatic cleanup

// Run manually when needed
const result = await cleanupService.runCleanup()
console.log(`Deleted ${result.deleted} sagas, archived ${result.archived}`)
```

### Scheduled with Cron

```typescript
import * as cron from 'node-cron'

const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
})

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running saga cleanup...')
  const result = await cleanupService.runCleanup()
  console.log(`Cleanup completed: ${result.deleted} deleted, ${result.archived} archived`)
})
```

## Cleanup Statistics

Get statistics about what would be cleaned up:

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  abortedSagaRetentionMs: 30 * 24 * 60 * 60 * 1000,
})

const stats = await cleanupService.getCleanupStats()
console.log(`
  Active sagas: ${stats.activeTotal}
  Completed sagas to delete: ${stats.completedToDelete}
  Aborted sagas to delete: ${stats.abortedToDelete}
`)
```

## Logging and Monitoring

### With Logging

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  
  onCleanup: (deleted, archived) => {
    console.log(`[${new Date().toISOString()}] Cleanup completed`)
    console.log(`  - Deleted: ${deleted}`)
    console.log(`  - Archived: ${archived}`)
  },
  
  onError: (error) => {
    console.error(`[${new Date().toISOString()}] Cleanup error:`, error)
  },
})

cleanupService.start()
```

### With Metrics (Prometheus example)

```typescript
import { Registry, Counter, Gauge } from 'prom-client'

const register = new Registry()

const deletedCounter = new Counter({
  name: 'saga_cleanup_deleted_total',
  help: 'Total number of sagas deleted',
  registers: [register],
})

const archivedCounter = new Counter({
  name: 'saga_cleanup_archived_total',
  help: 'Total number of sagas archived',
  registers: [register],
})

const cleanupErrorCounter = new Counter({
  name: 'saga_cleanup_errors_total',
  help: 'Total number of cleanup errors',
  registers: [register],
})

const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  
  onCleanup: (deleted, archived) => {
    deletedCounter.inc(deleted)
    archivedCounter.inc(archived)
  },
  
  onError: (error) => {
    cleanupErrorCounter.inc()
  },
})

cleanupService.start()
```

## Configuration Options

```typescript
interface SagaCleanupOptions {
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
```

## Best Practices

### 1. Different Retention for Different Status

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,    // 7 days - completed sagas
  abortedSagaRetentionMs: 30 * 24 * 60 * 60 * 1000,     // 30 days - keep failed sagas longer
})
```

### 2. Always Archive Critical Sagas

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  archiveBeforeDelete: async (sagaId, messages) => {
    // Always archive, even if it fails, log the error but continue
    try {
      await archiveToS3(sagaId, messages)
    } catch (error) {
      console.error(`Failed to archive ${sagaId}:`, error)
      // Still allow deletion to proceed
    }
  },
})
```

### 3. Run Cleanup During Off-Peak Hours

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // Run once per day
})

// Start at 2 AM (off-peak)
const now = new Date()
const tomorrow2AM = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate() + 1,
  2, 0, 0
)

setTimeout(() => {
  cleanupService.start()
}, tomorrow2AM.getTime() - now.getTime())
```

### 4. Monitor Cleanup Performance

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  onCleanup: (deleted, archived) => {
    if (deleted > 1000) {
      console.warn(`Large cleanup: ${deleted} sagas deleted - consider more frequent cleanup`)
    }
  },
})
```

## Troubleshooting

### High Memory Usage During Cleanup

If cleanup uses too much memory, process sagas in batches:

```typescript
// This is handled internally, but you can adjust cleanup interval
const cleanupService = new SagaCleanupService(coordinator.log, {
  cleanupIntervalMs: 30 * 60 * 1000, // Run more frequently (every 30 min)
})
```

### Cleanup Taking Too Long

Monitor cleanup duration and adjust:

```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  onCleanup: (deleted, archived) => {
    const duration = Date.now() - startTime
    console.log(`Cleanup took ${duration}ms for ${deleted} sagas`)
    
    if (duration > 60000) { // > 1 minute
      console.warn('Cleanup is taking too long, consider optimizing archival')
    }
  },
})

let startTime: number
cleanupService.start()
```

## Migration Guide

### From Manual Cleanup

Before:
```typescript
// Manual cleanup
setInterval(async () => {
  const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  await sagaLog.deleteOldSagas(oldDate)
}, 60 * 60 * 1000)
```

After:
```typescript
const cleanupService = new SagaCleanupService(coordinator.log, {
  completedSagaRetentionMs: 7 * 24 * 60 * 60 * 1000,
  cleanupIntervalMs: 60 * 60 * 1000,
})
cleanupService.start()
```

## Related Documentation

- [Saga Board Dashboard](./SAGA_BOARD_SUMMARY.md)
- [MongoDB Saga Log](./TRANSACTIONS.md)
- [Testing Sagas](./TESTING.md)
