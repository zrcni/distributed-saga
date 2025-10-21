export interface SagaInfo {
  sagaId: string;
  status: string;
  tasks?: Array<{
    taskName: string;
    status: string;
    childSagas?: SagaInfo[];  // Child sagas created by this task
  }>;
  parentSagaId?: string | null;
  parentTaskId?: string | null;
  childSagas?: SagaInfo[];
}

export interface Source {
  name: string;
}

export class Api {
  private basePath: string;

  constructor({ basePath }: { basePath: string }) {
    // Remove trailing slash and ensure we don't have double slashes
    this.basePath = basePath.replace(/\/$/, '') || '';
    console.log('[API] Initialized with basePath:', this.basePath);
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.basePath}/api${normalizedEndpoint}`;
    
    console.log('[API] Fetching:', url);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      console.error('[API] Error response:', response.status, response.statusText);
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[API] Response data:', data);
    return data;
  }

  async getSources(): Promise<Source[]> {
    return this.fetch<Source[]>('/sources');
  }

  async getSagas(sourceName: string): Promise<SagaInfo[]> {
    return this.fetch<SagaInfo[]>(`/sources/${sourceName}/sagas`);
  }

  async getSaga(sourceName: string, sagaId: string): Promise<SagaInfo> {
    return this.fetch<SagaInfo>(`/sources/${sourceName}/sagas/${sagaId}`);
  }

  async abortSaga(sourceName: string, sagaId: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(
      `/sources/${sourceName}/sagas/${sagaId}/abort`,
      { method: 'POST' }
    );
  }

  async retrySaga(sourceName: string, sagaId: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(
      `/sources/${sourceName}/sagas/${sagaId}/retry`,
      { method: 'POST' }
    );
  }

  async deleteSaga(sourceName: string, sagaId: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(
      `/sources/${sourceName}/sagas/${sagaId}`,
      { method: 'DELETE' }
    );
  }

  async getConfig(): Promise<{ uiConfig: any; basePath: string }> {
    return this.fetch<{ uiConfig: any; basePath: string }>('/config');
  }
}
