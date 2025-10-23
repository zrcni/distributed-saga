export interface SagaInfo {
  sagaId: string;
  status: 'active' | 'completed' | 'aborted';
  createdAt?: Date;
  updatedAt?: Date;
  job?: any;
  tasks: TaskInfo[];
  parentSagaId?: string | null;
  parentTaskId?: string | null;
  childSagas?: SagaInfo[];
}

export interface TaskInfo {
  taskName: string;
  status: 'not_started' | 'started' | 'completed' | 'compensating' | 'compensated';
  startedAt?: Date;
  completedAt?: Date;
  data?: any;
  error?: any;
  isOptional?: boolean;
  childSagas?: SagaInfo[];  // Child sagas created by this task
}

export interface SagaBoardOptions {
  uiConfig?: {
    boardTitle?: string;
    boardLogo?: {
      path: string;
      width?: number | string;
      height?: number | string;
    };
    miscLinks?: Array<{ text: string; url: string }>;
    favIcon?: {
      default: string;
      alternative?: string;
    };
  };
}

export interface SagaBoardRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  params: Record<string, string>;
}

export interface ISagaAdapter {
  getName(): string;
  getSagaIds(): Promise<string[]>;
  getSagaInfo(sagaId: string): Promise<SagaInfo | null>;
  abortSaga(sagaId: string): Promise<void>;
  retrySaga(sagaId: string): Promise<void>;
  deleteSaga(sagaId: string): Promise<void>;
  setVisibilityGuard?(guard: (req: SagaBoardRequest) => boolean): void;
  isVisible?(req: SagaBoardRequest): boolean;
}

export interface IServerAdapter {
  setBasePath(path: string): void;
  getRouter(): any;
  getBasePath(): string;
}
