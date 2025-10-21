import { Router, Request, Response, static as expressStatic } from 'express';
import { IServerAdapter, ISagaAdapter, SagaBoardOptions, SagaBoardRequest } from '@zrcni/distributed-saga-board-api';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';

export class ExpressAdapter implements IServerAdapter {
  private basePath = '';
  private router: Router;
  private adapters: ISagaAdapter[] = [];
  private options?: SagaBoardOptions;
  private uiDistPath: string;

  constructor() {
    this.router = Router();
    // Find the UI dist path
    try {
      this.uiDistPath = path.join(require.resolve('@zrcni/distributed-saga-board-ui/package.json'), '../dist');
    } catch (e) {
      // Fallback for development
      this.uiDistPath = path.join(__dirname, '../../ui/dist');
    }
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

    // Serve static files from UI build
    this.router.use('/static', expressStatic(path.join(this.uiDistPath, 'static')));

    // API routes
    this.setupApiRoutes();

    // Serve the main UI using EJS template
    this.router.get('/', (req: Request, res: Response) => {
      this.serveUI(req, res);
    });

    this.router.get('/sagas', (req: Request, res: Response) => {
      this.serveUI(req, res);
    });

    this.router.get('/sources/:name', (req: Request, res: Response) => {
      this.serveUI(req, res);
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

    // Delete saga
    this.router.delete('/api/sources/:name/sagas/:sagaId', async (req: Request, res: Response) => {
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

        await adapter.deleteSaga(sagaId);
        res.json({ success: true });
      } catch (error: any) {
        console.error('Error deleting saga:', error);
        res.status(500).json({ error: error.message || 'Failed to delete saga' });
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

  private serveUI(req: Request, res: Response): void {
    try {
      const ejsTemplatePath = path.join(require.resolve('@zrcni/distributed-saga-board-ui/package.json'), '../index.ejs');
      const indexHtmlPath = path.join(this.uiDistPath, 'index.html');

      let htmlContent: string;

      // Check if EJS template exists (for server-side rendering)
      if (fs.existsSync(ejsTemplatePath) && fs.existsSync(indexHtmlPath)) {
        // Read the built index.html to extract script and link tags
        const builtHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
        
        // Extract CSS link tags
        const cssRegex = /<link[^>]*rel="stylesheet"[^>]*>/g;
        const cssMatches = builtHtml.match(cssRegex) || [];
        const cssLinks = cssMatches
          .map(link => link.replace(/href="\.\//, `href="${this.basePath}/`))
          .join('\n    ');
        
        // Extract JS script tags
        const jsRegex = /<script[^>]*src="[^"]*"[^>]*><\/script>/g;
        const jsMatches = builtHtml.match(jsRegex) || [];
        const jsScripts = jsMatches
          .map(script => script.replace(/src="\.\//, `src="${this.basePath}/`))
          .join('\n    ');
        
        // Render EJS template with extracted assets
        const template = fs.readFileSync(ejsTemplatePath, 'utf-8');
        htmlContent = ejs.render(template, {
          basePath: this.basePath || '/',
          title: this.options?.uiConfig?.boardTitle || 'Saga Dashboard',
          uiConfig: JSON.stringify(this.options?.uiConfig || { boardTitle: 'Saga Dashboard' }),
          cssLinks,
          jsScripts,
        });
      } else if (fs.existsSync(indexHtmlPath)) {
        // Fallback to built index.html and inject config
        htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
        const uiConfigJson = JSON.stringify(this.options?.uiConfig || { boardTitle: 'Saga Dashboard' });
        htmlContent = htmlContent.replace(
          '<script id="__UI_CONFIG__" type="application/json">{}</script>',
          `<script id="__UI_CONFIG__" type="application/json">${uiConfigJson}</script>`
        );
        
        // Add base tag if needed
        if (this.basePath && !htmlContent.includes('<base href=')) {
          htmlContent = htmlContent.replace(
            '</head>',
            `<base href="${this.basePath}/" /></head>`
          );
        }
        
        // Fix asset paths to be absolute
        htmlContent = htmlContent.replace(/src="\.\/static\//g, `src="${this.basePath}/static/`);
        htmlContent = htmlContent.replace(/href="\.\/static\//g, `href="${this.basePath}/static/`);
      } else {
        throw new Error('UI files not found. Please build the @zrcni/distributed-saga-board-ui package.');
      }

      res.send(htmlContent);
    } catch (error) {
      console.error('Error serving UI:', error);
      res.status(500).send('Error loading dashboard UI. Please ensure @zrcni/distributed-saga-board-ui is built.');
    }
  }
}
