import fs from 'node:fs';
import path from 'node:path';
import type { Express, NextFunction, Request, Response } from 'express';

interface PageRouteOptions {
  appRoot: string;
}

export function registerPageRoutes(app: Express, options: PageRouteOptions): void {
  const spaIndexPath = path.join(options.appRoot, 'ui', 'index.html');
  const serveSpa = pageRoute(async (_request: Request, response: Response) => {
    if (!fs.existsSync(spaIndexPath)) {
      response.status(500).send('React UI build not found. Run npm run build:ui.');
      return;
    }

    response.sendFile(spaIndexPath);
  });

  app.get('/config', serveSpa);
  app.get('/leitores', serveSpa);
  app.get('/status', serveSpa);
  app.get('/historico', serveSpa);
  app.get('/historico/livro/:bookId', serveSpa);
  app.get('/livros/:bookId', serveSpa);
  app.get('/etiquetas', serveSpa);
  app.get('/mobile', serveSpa);
  app.get('/mobile-access', serveSpa);

  app.get('/donate', pageRoute(async (_request: Request, response: Response) => {
    response.redirect('/');
  }));

  app.get('/atrasados', serveSpa);

  app.get('/', pageRoute(async (request: Request, response: Response, next: NextFunction) => {
    if (hasQueryParam(request.query, 'atrasos')) {
      response.redirect(`/atrasados${queryStringWithout(request.query, 'atrasos')}`);
      return;
    }

    await serveSpa(request, response, next);
  }));
}

function hasQueryParam(query: Request['query'], key: string): boolean {
  return Object.prototype.hasOwnProperty.call(query, key);
}

function queryStringWithout(query: Request['query'], keyToSkip: string): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (key === keyToSkip) {
      return;
    }

    appendQueryValue(params, key, value);
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

function appendQueryValue(params: URLSearchParams, key: string, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(params, key, item));
    return;
  }

  if (typeof value === 'string') {
    params.append(key, value);
  }
}

function pageRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}
