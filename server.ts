import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } else if (args[i].startsWith('--port=')) {
      const parsed = Number(args[i].slice('--port='.length));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  const envPort = Number(process.env.PORT);
  if (process.env.NODE_ENV !== 'production' && envPort === 8080) {
    return 3000;
  }
  return Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
}

async function startServer() {
  const app = express();
  const PORT = resolvePort();

  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  let loadedApiRouter: express.Router | null = null;
  let resolveBackend!: () => void;
  let rejectBackend!: (err: unknown) => void;
  const backendReady = new Promise<void>((res, rej) => {
    resolveBackend = res;
    rejectBackend = rej;
  });

  app.use('/api', async (req, res, next) => {
    try {
      await backendReady;
      if (loadedApiRouter) {
        return loadedApiRouter(req, res, next);
      }
      return next();
    } catch (err) {
      return next(err);
    }
  });
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  let viteMiddlewares:
    | ((
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => void)
    | null = null;
  let resolveVite!: () => void;
  let rejectVite!: (err: unknown) => void;
  const viteReady = new Promise<void>((res, rej) => {
    resolveVite = res;
    rejectVite = rej;
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
class ErrorOverlay {}
export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
`);
    });

    app.use(async (req, res, next) => {
      try {
        await viteReady;
        if (viteMiddlewares) {
          return viteMiddlewares(req, res, next);
        }
        return next();
      } catch (err) {
        return next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Stranger's Wisdom server running on http://0.0.0.0:${PORT}`);

    setImmediate(() => {
      Promise.all([
        import('./src/server/routes.ts'),
        import('./src/server/realtime.ts'),
      ])
        .then(([{ default: apiRouter }, { setupRealtimeServer }]) => {
          setupRealtimeServer(server);
          loadedApiRouter = apiRouter;
          resolveBackend();
        })
        .catch((err) => {
          console.error('Failed to initialize backend routes:', err);
          rejectBackend(err);
          process.exit(1);
        });

      if (process.env.NODE_ENV !== 'production') {
        import('vite')
          .then(({ createServer: createViteServer }) =>
            createViteServer({
              server: { middlewareMode: true, hmr: false, ws: false, watch: null },
              appType: 'spa',
            })
          )
          .then((vite) => {
            viteMiddlewares = vite.middlewares;
            resolveVite();
          })
          .catch((err) => {
            console.error('Failed to initialize Vite dev middleware:', err);
            rejectVite(err);
            process.exit(1);
          });
      } else {
        resolveVite();
      }
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
