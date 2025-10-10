import { Router, Request, Response, static as expressStatic } from 'express';
import { IServerAdapter, ISagaAdapter, SagaBoardOptions, SagaBoardRequest } from '@saga-board/api';
import * as path from 'path';

export class ExpressAdapter implements IServerAdapter {
  private basePath = '';
  private router: Router;
  private adapters: ISagaAdapter[] = [];
  private options?: SagaBoardOptions;

  constructor() {
    this.router = Router();
  }

  setBasePath(path: string): void {
    this.basePath = path.replace(/\/$/, ''); // Remove trailing slash
  }

  getBasePath(): string {
    return this.basePath;
  }

  getRouter(): Router {
    return this.router;
  }

  setupRoutes(adapters: ISagaAdapter[], options?: SagaBoardOptions): void {
    this.adapters = adapters;
    this.options = options;

    // Serve static files from UI package
    try {
      const uiStaticPath = path.join(require.resolve('@saga-board/ui'), '../static');
      this.router.use('/static', expressStatic(uiStaticPath));
    } catch (e) {
      console.warn('Could not load UI static files');
    }

    // API routes
    this.setupApiRoutes();

    // Serve the main UI
    this.router.get('/', (req: Request, res: Response) => {
      res.send(this.getHtml());
    });

    this.router.get('/sagas', (req: Request, res: Response) => {
      res.send(this.getHtml());
    });

    this.router.get('/sagas/:sagaId', (req: Request, res: Response) => {
      res.send(this.getHtml());
    });
  }

  private setupApiRoutes(): void {
    // Get all saga sources (adapters)
    this.router.get('/api/sources', async (req: Request, res: Response) => {
      try {
        const request = this.mapRequest(req);
        const visibleAdapters = this.adapters.filter((adapter) =>
          adapter.isVisible ? adapter.isVisible(request) : true
        );

        const sources = visibleAdapters.map((adapter) => ({
          name: adapter.getName(),
        }));

        res.json(sources);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sources' });
      }
    });

    // Get all sagas for a source
    this.router.get('/api/sources/:name/sagas', async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const adapter = this.findAdapter(name);

        if (!adapter) {
          return res.status(404).json({ error: 'Source not found' });
        }

        const request = this.mapRequest(req);
        if (adapter.isVisible && !adapter.isVisible(request)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const sagaIds = await adapter.getSagaIds();
        const sagas = await Promise.all(
          sagaIds.map(async (id: string) => {
            const info = await adapter.getSagaInfo(id);
            return info;
          })
        );

        res.json(sagas.filter(Boolean));
      } catch (error) {
        console.error('Error fetching sagas:', error);
        res.status(500).json({ error: 'Failed to fetch sagas' });
      }
    });

    // Get specific saga info
    this.router.get('/api/sources/:name/sagas/:sagaId', async (req: Request, res: Response) => {
      try {
        const { name, sagaId } = req.params;
        const adapter = this.findAdapter(name);

        if (!adapter) {
          return res.status(404).json({ error: 'Source not found' });
        }

        const request = this.mapRequest(req);
        if (adapter.isVisible && !adapter.isVisible(request)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const sagaInfo = await adapter.getSagaInfo(sagaId);

        if (!sagaInfo) {
          return res.status(404).json({ error: 'Saga not found' });
        }

        res.json(sagaInfo);
      } catch (error) {
        console.error('Error fetching saga:', error);
        res.status(500).json({ error: 'Failed to fetch saga' });
      }
    });

    // Abort saga
    this.router.post('/api/sources/:name/sagas/:sagaId/abort', async (req: Request, res: Response) => {
      try {
        const { name, sagaId } = req.params;
        const adapter = this.findAdapter(name);

        if (!adapter) {
          return res.status(404).json({ error: 'Source not found' });
        }

        const request = this.mapRequest(req);
        if (adapter.isVisible && !adapter.isVisible(request)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await adapter.abortSaga(sagaId);
        res.json({ success: true });
      } catch (error: any) {
        console.error('Error aborting saga:', error);
        res.status(500).json({ error: error.message || 'Failed to abort saga' });
      }
    });

    // Retry saga
    this.router.post('/api/sources/:name/sagas/:sagaId/retry', async (req: Request, res: Response) => {
      try {
        const { name, sagaId } = req.params;
        const adapter = this.findAdapter(name);

        if (!adapter) {
          return res.status(404).json({ error: 'Source not found' });
        }

        const request = this.mapRequest(req);
        if (adapter.isVisible && !adapter.isVisible(request)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await adapter.retrySaga(sagaId);
        res.json({ success: true });
      } catch (error: any) {
        console.error('Error retrying saga:', error);
        res.status(500).json({ error: error.message || 'Failed to retry saga' });
      }
    });

    // Get board configuration
    this.router.get('/api/config', (req: Request, res: Response) => {
      res.json({
        uiConfig: this.options?.uiConfig || {
          boardTitle: 'Saga Dashboard',
        },
        basePath: this.basePath,
      });
    });
  }

  private findAdapter(name: string): ISagaAdapter | undefined {
    return this.adapters.find((adapter) => adapter.getName() === name);
  }

  private mapRequest(req: Request): SagaBoardRequest {
    return {
      headers: req.headers as Record<string, string | string[] | undefined>,
      query: req.query as Record<string, any>,
      params: req.params as Record<string, string>,
    };
  }

  private getHtml(): string {
    const { boardTitle = 'Saga Dashboard' } = this.options?.uiConfig || {};
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${boardTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      color: #333;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #2c3e50;
    }

    .sources {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .source-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .source-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .source-name {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #2c3e50;
    }

    .sagas-list {
      margin-top: 20px;
    }

    .saga-card {
      background: white;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .saga-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .saga-id {
      font-family: monospace;
      font-size: 14px;
      color: #666;
    }

    .saga-status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .saga-status.active {
      background: #3498db;
      color: white;
    }

    .saga-status.completed {
      background: #2ecc71;
      color: white;
    }

    .saga-status.aborted {
      background: #e74c3c;
      color: white;
    }

    .tasks {
      margin-top: 10px;
    }

    .task {
      display: flex;
      align-items: center;
      padding: 8px;
      margin: 4px 0;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .task-name {
      flex: 1;
      font-weight: 500;
    }

    .task-status {
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
    }

    .task-status.started {
      background: #f39c12;
      color: white;
    }

    .task-status.completed {
      background: #27ae60;
      color: white;
    }

    .task-status.compensating {
      background: #e67e22;
      color: white;
    }

    .task-status.compensated {
      background: #95a5a6;
      color: white;
    }

    .actions {
      margin-top: 15px;
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .btn:hover {
      opacity: 0.8;
    }

    .btn-abort {
      background: #e74c3c;
      color: white;
    }

    .btn-retry {
      background: #3498db;
      color: white;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .error {
      background: #fee;
      color: #c33;
      padding: 15px;
      border-radius: 4px;
      margin: 10px 0;
    }

    .back-btn {
      display: inline-block;
      margin-bottom: 20px;
      color: #3498db;
      text-decoration: none;
      font-weight: 500;
    }

    .back-btn:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${boardTitle}</h1>
      <p id="subtitle">Monitor and manage your distributed sagas</p>
    </div>
    <div id="app">
      <div class="loading">Loading...</div>
    </div>
  </div>

  <script>
    const API_BASE = '${this.basePath}/api';
    let currentView = 'sources';
    let currentSource = null;

    async function fetchSources() {
      const response = await fetch(\`\${API_BASE}/sources\`);
      return response.json();
    }

    async function fetchSagas(sourceName) {
      const response = await fetch(\`\${API_BASE}/sources/\${sourceName}/sagas\`);
      return response.json();
    }

    async function fetchSaga(sourceName, sagaId) {
      const response = await fetch(\`\${API_BASE}/sources/\${sourceName}/sagas/\${sagaId}\`);
      return response.json();
    }

    async function abortSaga(sourceName, sagaId) {
      const response = await fetch(\`\${API_BASE}/sources/\${sourceName}/sagas/\${sagaId}/abort\`, {
        method: 'POST'
      });
      return response.json();
    }

    async function retrySaga(sourceName, sagaId) {
      const response = await fetch(\`\${API_BASE}/sources/\${sourceName}/sagas/\${sagaId}/retry\`, {
        method: 'POST'
      });
      return response.json();
    }

    function renderSources(sources) {
      const html = \`
        <div class="sources">
          \${sources.map(source => \`
            <div class="source-card" onclick="showSagas('\${source.name}')">
              <div class="source-name">\${source.name}</div>
            </div>
          \`).join('')}
        </div>
      \`;
      document.getElementById('app').innerHTML = html;
    }

    function renderSagas(sourceName, sagas) {
      const html = \`
        <a href="#" class="back-btn" onclick="showSources(); return false;">← Back to sources</a>
        <h2 style="margin-bottom: 20px;">Sagas in \${sourceName}</h2>
        <div class="sagas-list">
          \${sagas.length === 0 ? '<p>No sagas found</p>' : sagas.map(saga => \`
            <div class="saga-card">
              <div class="saga-header">
                <div>
                  <div class="saga-id">\${saga.sagaId}</div>
                </div>
                <span class="saga-status \${saga.status}">\${saga.status}</span>
              </div>
              \${saga.tasks && saga.tasks.length > 0 ? \`
                <div class="tasks">
                  <strong>Tasks:</strong>
                  \${saga.tasks.map(task => \`
                    <div class="task">
                      <div class="task-name">\${task.taskName}</div>
                      <span class="task-status \${task.status}">\${task.status}</span>
                    </div>
                  \`).join('')}
                </div>
              \` : ''}
              \${saga.status === 'active' ? \`
                <div class="actions">
                  <button class="btn btn-abort" onclick="handleAbort('\${sourceName}', '\${saga.sagaId}')">Abort</button>
                </div>
              \` : ''}
            </div>
          \`).join('')}
        </div>
      \`;
      document.getElementById('app').innerHTML = html;
    }

    async function showSources() {
      currentView = 'sources';
      document.getElementById('app').innerHTML = '<div class="loading">Loading sources...</div>';
      try {
        const sources = await fetchSources();
        renderSources(sources);
      } catch (error) {
        document.getElementById('app').innerHTML = \`<div class="error">Error loading sources: \${error.message}</div>\`;
      }
    }

    async function showSagas(sourceName) {
      currentView = 'sagas';
      currentSource = sourceName;
      document.getElementById('app').innerHTML = '<div class="loading">Loading sagas...</div>';
      try {
        const sagas = await fetchSagas(sourceName);
        renderSagas(sourceName, sagas);
      } catch (error) {
        document.getElementById('app').innerHTML = \`<div class="error">Error loading sagas: \${error.message}</div>\`;
      }
    }

    async function handleAbort(sourceName, sagaId) {
      if (!confirm('Are you sure you want to abort this saga?')) {
        return;
      }
      try {
        await abortSaga(sourceName, sagaId);
        alert('Saga aborted successfully');
        showSagas(sourceName);
      } catch (error) {
        alert('Error aborting saga: ' + error.message);
      }
    }

    // Auto-refresh every 5 seconds
    setInterval(() => {
      if (currentView === 'sagas' && currentSource) {
        fetchSagas(currentSource).then(sagas => renderSagas(currentSource, sagas)).catch(console.error);
      }
    }, 5000);

    // Initial load
    showSources();
  </script>
</body>
</html>
    `.trim();
  }
}
