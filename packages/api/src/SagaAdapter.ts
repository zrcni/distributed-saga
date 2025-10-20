import { ISagaAdapter, SagaInfo, SagaBoardRequest, TaskInfo } from './types';

// Re-declare the enum since we can't import from the main package in compilation
enum SagaMessageType {
  StartSaga = "StartSaga",
  EndSaga = "EndSaga",
  AbortSaga = "AbortSaga",
  StartTask = "StartTask",
  EndTask = "EndTask",
  StartCompensatingTask = "StartCompensatingTask",
  EndCompensatingTask = "EndCompensatingTask",
}

export interface SagaAdapterOptions {
  name?: string;
  readOnlyMode?: boolean;
  description?: string;
}

export class SagaAdapter implements ISagaAdapter {
  private coordinator: any; // SagaCoordinator from @zrcni/distributed-saga
  private options: SagaAdapterOptions;
  private visibilityGuard?: (req: SagaBoardRequest) => boolean;

  constructor(coordinator: any, options: SagaAdapterOptions = {}) {
    this.coordinator = coordinator;
    this.options = {
      readOnlyMode: false,
      ...options,
    };
  }

  getName(): string {
    return this.options.name || 'default';
  }

  getDescription(): string {
    return this.options.description || '';
  }

  isReadOnly(): boolean {
    return this.options.readOnlyMode || false;
  }

  async getSagaIds(): Promise<string[]> {
    const result = await this.coordinator.getActiveSagaIds();
    if (result.isError()) {
      throw new Error('Failed to get active saga IDs');
    }
    return result.data;
  }

  async getSagaInfo(sagaId: string): Promise<SagaInfo | null> {
    try {
      const messagesResult = await this.coordinator.log.getMessages(sagaId);
      if (messagesResult.isError()) {
        return null;
      }

      const messages = messagesResult.data;
      if (messages.length === 0) {
        return null;
      }

      // Reconstruct saga state from messages
      const tasks = new Map<string, TaskInfo>();
      let sagaAborted = false;
      let sagaCompleted = false;
      let job: any = null;

      for (const msg of messages) {
        switch (msg.msgType) {
          case SagaMessageType.StartSaga:
            job = msg.data;
            break;

          case SagaMessageType.StartTask:
            tasks.set(msg.taskId, {
              taskName: msg.taskId,
              status: 'started',
              data: msg.data,
            });
            break;

          case SagaMessageType.EndTask:
            const task = tasks.get(msg.taskId);
            if (task) {
              task.status = 'completed';
              task.data = msg.data;
            }
            break;

          case SagaMessageType.StartCompensatingTask:
            const taskToCompensate = tasks.get(msg.taskId);
            if (taskToCompensate) {
              taskToCompensate.status = 'compensating';
            }
            break;

          case SagaMessageType.EndCompensatingTask:
            const compensatedTask = tasks.get(msg.taskId);
            if (compensatedTask) {
              compensatedTask.status = 'compensated';
            }
            break;

          case SagaMessageType.AbortSaga:
            sagaAborted = true;
            break;

          case SagaMessageType.EndSaga:
            sagaCompleted = true;
            break;
        }
      }

      const status: 'active' | 'completed' | 'aborted' = sagaCompleted ? 'completed' : sagaAborted ? 'aborted' : 'active';

      // Get parent saga ID and parent task ID from the first message
      const parentSagaId = messages[0].parentSagaId ?? null;
      const parentTaskId = messages[0].parentTaskId ?? null;

      // Fetch child sagas
      const childSagaIds = await this.getChildSagaIds(sagaId);
      const childSagas: SagaInfo[] = [];
      
      for (const childId of childSagaIds) {
        const childInfo = await this.getSagaInfo(childId);
        if (childInfo) {
          childSagas.push(childInfo);
        }
      }

      // Group child sagas by their parent task ID
      const taskArray = Array.from(tasks.values());
      for (const task of taskArray) {
        task.childSagas = childSagas.filter(child => child.parentTaskId === task.taskName);
      }

      return {
        sagaId,
        status,
        job,
        tasks: taskArray,
        parentSagaId,
        parentTaskId,
        childSagas,  // Keep this for backward compatibility
      };
    } catch (error) {
      console.error('Error getting saga info:', error);
      return null;
    }
  }

  private async getChildSagaIds(parentSagaId: string): Promise<string[]> {
    try {
      const result = await this.coordinator.getChildSagaIds(parentSagaId);
      if (result.isError()) {
        return [];
      }
      return result.data;
    } catch (error) {
      return [];
    }
  }

  async abortSaga(sagaId: string): Promise<void> {
    if (this.isReadOnly()) {
      throw new Error('Cannot abort saga in read-only mode');
    }

    const recoverResult = await this.coordinator.recoverSagaState(
      sagaId,
      'rollback' as any
    );

    if (recoverResult.isError()) {
      throw new Error('Failed to abort saga');
    }

    const saga = recoverResult.data;
    await saga.abortSaga();
  }

  async retrySaga(sagaId: string): Promise<void> {
    if (this.isReadOnly()) {
      throw new Error('Cannot retry saga in read-only mode');
    }

    // Recovery logic would be implemented here
    // This would typically involve getting the saga definition
    // and re-running the saga orchestrator
    throw new Error('Retry not yet implemented');
  }

  setVisibilityGuard(guard: (req: SagaBoardRequest) => boolean): void {
    this.visibilityGuard = guard;
  }

  isVisible(req: SagaBoardRequest): boolean {
    if (!this.visibilityGuard) {
      return true;
    }
    return this.visibilityGuard(req);
  }
}
