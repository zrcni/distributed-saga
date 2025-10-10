import { ISagaAdapter, IServerAdapter, SagaBoardOptions } from './types';

export interface SagaBoardApi {
  addAdapter(adapter: ISagaAdapter): void;
  removeAdapter(adapterName: string): void;
  getAdapters(): ISagaAdapter[];
  setAdapters(adapters: ISagaAdapter[]): void;
}

export function createSagaBoard(config: {
  adapters: ISagaAdapter[];
  serverAdapter: IServerAdapter;
  options?: SagaBoardOptions;
}): SagaBoardApi {
  const { adapters: initialAdapters, serverAdapter, options } = config;
  
  let adapters = [...initialAdapters];
  const boardOptions = {
    uiConfig: {
      boardTitle: 'Saga Dashboard',
      favIcon: {
        default: '/static/favicon.svg',
        alternative: '/static/favicon-32x32.png',
      },
      ...options?.uiConfig,
    },
  };

  // Setup API routes on the server adapter
  (serverAdapter as any).setupRoutes?.(adapters, boardOptions);

  const api: SagaBoardApi = {
    addAdapter(adapter: ISagaAdapter) {
      if (!adapters.find((a) => a.getName() === adapter.getName())) {
        adapters.push(adapter);
      }
    },

    removeAdapter(adapterName: string) {
      adapters = adapters.filter((a) => a.getName() !== adapterName);
    },

    getAdapters() {
      return [...adapters];
    },

    setAdapters(newAdapters: ISagaAdapter[]) {
      adapters = [...newAdapters];
    },
  };

  return api;
}
