import path from 'node:path';
import { createRequire } from 'node:module';
import type { Express, NextFunction, Request, Response } from 'express';

interface PageRouteOptions {
  appRoot: string;
}

export function registerPageRoutes(app: Express, options: PageRouteOptions): void {
  const requireFromApp = createRequire(path.join(options.appRoot, 'legacy-loader.js'));

  function requireUncached<T>(modulePath: string): T {
    const resolvedPath = requireFromApp.resolve(modulePath);
    delete require.cache[resolvedPath];
    return requireFromApp(resolvedPath) as T;
  }

  app.get('/config', pageRoute(async (_request: Request, response: Response) => {
    response.send(requireUncached<string>('./pages/buildConfigs.js'));
  }));

  app.get('/leitores', pageRoute(async (_request: Request, response: Response) => {
    const { UsersPage } = requireUncached<{ UsersPage: () => string }>('./pages/buildUsers.js');
    response.send(UsersPage());
  }));

  app.get('/status', pageRoute(async (_request: Request, response: Response) => {
    const { StatusPage } = requireUncached<{ StatusPage: () => Promise<string> }>('./pages/buildStats.js');
    response.send(await StatusPage());
  }));

  app.get('/historico', pageRoute(async (_request: Request, response: Response) => {
    const { HistoryPage } = requireUncached<{ HistoryPage: () => string }>('./pages/buildHistory.js');
    response.send(HistoryPage());
  }));

  app.get('/etiquetas', pageRoute(async (_request: Request, response: Response) => {
    const { LabelsPage } = requireUncached<{ LabelsPage: () => string }>('./pages/buildLabels.js');
    response.send(LabelsPage());
  }));

  app.get('/donate', pageRoute(async (_request: Request, response: Response) => {
    response.redirect('/');
  }));

  app.get('/', pageRoute(async (_request: Request, response: Response) => {
    const { BooksPage } = requireUncached<{ BooksPage: () => Promise<string> }>('./pages/buildBooks.js');
    response.send(await BooksPage());
  }));
}

function pageRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}
