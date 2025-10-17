# Saga Board Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Application                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ creates
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SagaCoordinator                             │
│  (from @zrcni/distributed-saga)                                  │
│  - Manages saga lifecycle                                        │
│  - Stores saga state                                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ wrapped by
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SagaAdapter                                │
│  (from @zrcni/distributed-saga-board-api)                        │
│  - Provides read interface to saga state                         │
│  - Implements visibility guards                                  │
│  - Enables saga actions (abort, retry)                           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ consumed by
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      createSagaBoard()                           │
│  (from @zrcni/distributed-saga-board-api)                        │
│  - Manages multiple adapters                                     │
│  - Configures UI options                                         │
│  - Coordinates with server adapter                               │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ uses
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ServerAdapter                               │
│  (ExpressAdapter, FastifyAdapter, etc.)                          │
│  - Provides HTTP routes                                          │
│  - Serves UI                                                     │
│  - Handles API requests                                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ mounted on
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Web Server                                  │
│  (Express, Fastify, Koa, etc.)                                   │
│  app.use('/admin/sagas', serverAdapter.getRouter())              │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ accessed by
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  - View sagas                                                    │
│  - Monitor task progress                                         │
│  - Execute actions                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Reading Saga State

```
Browser → HTTP GET /api/sources/:name/sagas
         ↓
    ServerAdapter (Express)
         ↓
    SagaAdapter.getSagaIds()
         ↓
    SagaCoordinator.getActiveSagaIds()
         ↓
    SagaLog (InMemory/MongoDB)
         ↓
    Returns saga IDs → Fetch details for each
         ↓
    Browser renders saga list
```

### Aborting a Saga

```
Browser → HTTP POST /api/sources/:name/sagas/:id/abort
         ↓
    ServerAdapter (Express)
         ↓
    SagaAdapter.abortSaga(sagaId)
         ↓
    SagaCoordinator.recoverSagaState()
         ↓
    Saga.abortSaga()
         ↓
    SagaLog.logMessage(AbortSaga)
         ↓
    Returns success → Browser shows updated state
```

## Package Dependencies

```
@zrcni/distributed-saga-board-express
    ├── @zrcni/distributed-saga-board-api
    ├── @zrcni/distributed-saga-board-ui
    └── express (peer dependency)

@zrcni/distributed-saga-board-api
    └── @zrcni/distributed-saga (peer dependency)

Example Application
    ├── @zrcni/distributed-saga-board-api
    ├── @zrcni/distributed-saga-board-express
    ├── @zrcni/distributed-saga
    └── express
```

## Key Design Principles

1. **Separation of Concerns**: API layer is framework-agnostic
2. **Pluggable Architecture**: Easy to add new server adapters
3. **Type Safety**: Full TypeScript support throughout
4. **Minimal Dependencies**: Keep the footprint small
5. **Zero Lock-in**: Dashboard is optional and non-invasive
6. **Security First**: Built-in access control mechanisms
