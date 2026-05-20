import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { ensureConfig, loadConfig, saveConfig } from './config';
import { openDatabase } from './database/connection';
import { BooksRepository } from './repositories/booksRepository';
import { StatsRepository } from './repositories/statsRepository';
import { UsersRepository } from './repositories/usersRepository';
import { registerApiRoutes, registerErrorHandler } from './routes/apiRoutes';
import { registerPageRoutes } from './routes/pageRoutes';
import { LibraryService } from './services/libraryService';
import { MobileAccessService } from './services/mobileAccessService';

export interface StartServerOptions {
  port: number;
  projectRoot: string;
  appRoot: string;
}

export interface RunningServer {
  server: http.Server;
  close: () => Promise<void>;
}

export async function startServer(options: StartServerOptions): Promise<RunningServer> {
  ensureConfig(options.projectRoot);
  process.env.KRAKEN_BOOK_BASE_URL = `http://localhost:${options.port}`;

  const db = await openDatabase(options.projectRoot);
  const books = new BooksRepository(db);
  const users = new UsersRepository(db);
  const stats = new StatsRepository(db);
  const getConfig = () => loadConfig(options.projectRoot);
  const setConfig = (input: Parameters<typeof saveConfig>[1]) => saveConfig(options.projectRoot, input);
  const library = new LibraryService(db, books, users, getConfig);
  const mobileAccess = new MobileAccessService(options.port);

  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));
  app.use((request, response, next) => {
    if (!mobileAccess.isTunnelHost(request.headers.host) || mobileAccess.isAllowedTunnelPath(request.path)) {
      next();
      return;
    }

    response.status(404).send('Acesso indisponivel pelo link mobile.');
  });
  app.use('/assets', express.static(path.join(options.appRoot, 'assets'), { maxAge: '1h' }));
  app.use('/functions', express.static(path.join(options.appRoot, 'functions'), { maxAge: '1h' }));
  app.use('/ui', express.static(path.join(options.appRoot, 'ui'), { maxAge: '1h' }));

  registerApiRoutes(app, {
    database: db,
    projectRoot: options.projectRoot,
    books,
    users,
    stats,
    library,
    mobileAccess,
    getConfig,
    setConfig,
  });
  registerPageRoutes(app, { appRoot: options.appRoot });
  registerErrorHandler(app);

  const server = await listen(app, options.port);

  return {
    server,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await mobileAccess.stop();
      await db.close();
    },
  };
}

function listen(app: express.Express, port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Kraken Book DB listening on port ${port}`);
      resolve(server);
    });

    server.once('error', reject);
  });
}
