# Saga Board - Architecture Overview

## Package Structure

Saga Board follows a modular architecture inspired by [bull-board](https://github.com/felixmosh/bull-board):

```
packages/
├── api/          # Core adapter interface and types
├── express/      # Express.js server adapter  
└── ui/           # React TypeScript frontend
```

## How It Works

### 1. API Package (@zrcni/distributed-saga-board-api)

Defines the core interfaces:
- `ISagaAdapter` - Wraps your saga coordinator
- `IServerAdapter` - Interface for server implementations (Express, Fastify, etc.)
- `SagaBoard` - Main orchestrator that connects adapters

### 2. UI Package (@zrcni/distributed-saga-board-ui)

A standalone React TypeScript application:
- Built with Vite for optimal performance
- Outputs static assets to `dist/`
- Provides `index.ejs` template for server-side rendering
- Uses React Router for client-side navigation

**Build Output:**
```
dist/
├── index.html           # Development reference
├── static/
│   ├── js/
│   │   └── index-[hash].js
│   └── css/
│       └── index-[hash].css
index.ejs               # EJS template (package root)
```

### 3. Express Package (@zrcni/distributed-saga-board-express)

Server adapter that:
1. **Serves the UI**: Renders `index.ejs` with server configuration
2. **Provides REST API**: Exposes saga data and actions
3. **Handles static assets**: Serves bundled JS/CSS from UI package

**Request Flow:**

```
Browser Request
    ↓
Express Router (basePath: /admin/sagas)
    ↓
    ├─→ /                    → serveUI() → index.ejs + config
    ├─→ /sources/:name       → serveUI() → (React handles routing)
    ├─→ /static/*            → Static files from @zrcni/distributed-saga-board-ui/dist
    └─→ /api/*               → REST API endpoints
```

## Server-Side Rendering vs Client-Side Routing

### Initial Page Load (SSR)
```typescript
// Express adapter
private serveUI(req: Request, res: Response): void {
  // 1. Load index.ejs template
  const template = fs.readFileSync(ejsTemplatePath);
  
  // 2. Inject configuration
  const html = ejs.render(template, {
    basePath: '/admin/sagas',
    title: 'Saga Dashboard',
    uiConfig: JSON.stringify({ boardTitle: '...' })
  });
  
  // 3. Send to browser
  res.send(html);
}
```

The browser receives:
```html
<!DOCTYPE html>
<html>
  <head>
    <base href="/admin/sagas/" />
    <title>Saga Dashboard</title>
  </head>
  <body>
    <script id="__UI_CONFIG__" type="application/json">
      {"boardTitle":"Saga Dashboard"}
    </script>
    <div id="root"></div>
    <script src="/admin/sagas/static/js/index-[hash].js"></script>
  </body>
</html>
```

### Client-Side Navigation
Once loaded, React Router handles all navigation:
- `/admin/sagas/` → SourcesPage
- `/admin/sagas/sources/MyCoordinator` → SagasPage

**No page reloads** - all transitions are client-side.

## Why This Architecture?

### Inspired by bull-board

1. **Separation of Concerns**
   - UI is pure React app (no server code mixed in)
   - Server adapters handle routing/serving
   - API package defines contracts

2. **Extensibility**
   - Easy to add new server adapters (Fastify, Hapi, etc.)
   - UI package can be reused across adapters
   - Clear interfaces for customization

3. **Developer Experience**
   - UI can be developed independently with Vite dev server
   - Type safety across all packages
   - Modern tooling (Vite, TypeScript, React 18)

4. **Production Ready**
   - Optimized Vite builds (code splitting, minification)
   - Static asset caching
   - Progressive enhancement

## Adding a New Server Adapter

To create an adapter for another framework (e.g., Fastify):

```typescript
import { IServerAdapter, ISagaAdapter, SagaBoardOptions } from '@zrcni/distributed-saga-board-api';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';

export class FastifyAdapter implements IServerAdapter {
  private uiDistPath: string;
  
  constructor() {
    this.uiDistPath = path.join(
      require.resolve('@zrcni/distributed-saga-board-ui/package.json'),
      '../dist'
    );
```

## Configuration Flow

```
User Code
    ↓
SagaBoard({ options: { uiConfig: {...} } })
    ↓
ExpressAdapter.setupRoutes()
    ↓
serveUI() → inject into index.ejs
    ↓
Browser: __UI_CONFIG__ script tag
    ↓
React: UIConfigContext.Provider
    ↓
Components: useUIConfig() hook
```

## API Communication

React app communicates with server via REST API:

```typescript
// In browser
const api = new Api({ basePath: '/admin/sagas' });
const sources = await api.getSources();  // GET /admin/sagas/api/sources
const sagas = await api.getSagas('MyCoordinator');  // GET /admin/sagas/api/sources/MyCoordinator/sagas
```

All API calls are relative to the basePath, making the dashboard portable.

## License

MIT
