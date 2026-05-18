import type { Express, NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import QRCode from 'qrcode';
import type { AppConfig } from '../config';
import { AppError, isAppError } from '../errors';
import type { BookInfo, BookLabelInfo, LoanHistoryStatus } from '../repositories/booksRepository';
import { BooksRepository } from '../repositories/booksRepository';
import { StatsRepository } from '../repositories/statsRepository';
import { UsersRepository } from '../repositories/usersRepository';
import { buildBooksPdfReport, buildOverduePdfReport } from '../reports/pdfReport';
import { lookupBookByIsbn } from '../services/isbnService';
import { LibraryService } from '../services/libraryService';

interface ApiDependencies {
  books: BooksRepository;
  users: UsersRepository;
  stats: StatsRepository;
  library: LibraryService;
  getConfig: () => AppConfig;
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function registerApiRoutes(app: Express, dependencies: ApiDependencies): void {
  const router = Router();

  router.get(
    '/books/isbn/:isbn',
    asyncRoute(async (request, response) => {
      response.json(await lookupBookByIsbn(request.params.isbn));
    }),
  );

  router.get(
    '/books/:id/copies',
    asyncRoute(async (request, response) => {
      response.json(await dependencies.books.listCopies(parseId(request.params.id)));
    }),
  );

  router.put(
    '/books/:id/copies',
    asyncRoute(async (request, response) => {
      await dependencies.library.setBookCopies(parseId(request.params.id), request.body.total);
      response.json(await dependencies.books.listCopies(parseId(request.params.id)));
    }),
  );

  router.get(
    '/books/:id',
    asyncRoute(async (request, response) => {
      const book = await dependencies.books.getById(parseId(request.params.id));

      if (!book) {
        throw new AppError(404, 'Livro não encontrado');
      }

      response.json(book);
    }),
  );

  router.get(
    '/books',
    asyncRoute(async (request, response) => {
      const result = await dependencies.books.list({
        search: singleQueryValue(request.query.search),
        status: optionalNumber(request.query.status),
        tag: singleQueryValue(request.query.tag),
        limit: optionalLimit(request.query.limit),
        offset: optionalOffset(request.query.offset),
      });

      response.setHeader('X-Has-More', result.hasMore ? '1' : '0');
      response.json(result.rows);
    }),
  );

  router.get(
    '/status',
    asyncRoute(async (_request, response) => {
      const stats = await dependencies.stats.get();
      response.json([stats]);
    }),
  );

  router.get(
    '/pendencias',
    asyncRoute(async (_request, response) => {
      response.json(await dependencies.books.listPending());
    }),
  );

  router.all(
    '/book/remove/:id',
    asyncRoute(async (request, response) => {
      await dependencies.library.removeBook(parseId(request.params.id));
      response.send('Livro removido com sucesso!');
    }),
  );

  router.all(
    '/books/devolucao/:id',
    asyncRoute(async (request, response) => {
      await dependencies.library.returnBook(parseId(request.params.id));
      response.send('Devolução realizada com sucesso!');
    }),
  );

  router.post(
    '/book/add',
    asyncRoute(async (request, response) => {
      const id = await dependencies.library.addBook(request.body);
      response.json({ id, message: 'Livro adicionado com sucesso!' });
    }),
  );

  router.post(
    '/book/edit/:id',
    asyncRoute(async (request, response) => {
      await dependencies.library.editBook(parseId(request.params.id), request.body);
      response.send('Livro atualizado com sucesso!');
    }),
  );

  router.all(
    '/users/remove/:id',
    asyncRoute(async (request, response) => {
      await dependencies.library.removeUser(parseId(request.params.id));
      response.send('Leitor removido com sucesso!');
    }),
  );

  router.post(
    '/users/add',
    asyncRoute(async (request, response) => {
      await dependencies.library.addUser(request.body);
      response.send('Leitor adicionado com sucesso!');
    }),
  );

  router.post(
    '/users/edit/:id',
    asyncRoute(async (request, response) => {
      await dependencies.library.editUser(parseId(request.params.id), request.body);
      response.send('Leitor atualizado com sucesso!');
    }),
  );

  router.get(
    '/users/:id',
    asyncRoute(async (request, response) => {
      const user = await dependencies.users.getById(parseId(request.params.id));

      if (!user) {
        throw new AppError(404, 'Leitor não encontrado');
      }

      response.json(user);
    }),
  );

  router.get(
    '/users',
    asyncRoute(async (request, response) => {
      const result = await dependencies.users.list({
        search: singleQueryValue(request.query.search),
        turma: singleQueryValue(request.query.turma),
        limit: optionalLimit(request.query.limit),
        offset: optionalOffset(request.query.offset),
      });

      response.setHeader('X-Has-More', result.hasMore ? '1' : '0');
      response.json(result.rows);
    }),
  );

  router.get(
    '/book-copies',
    asyncRoute(async (request, response) => {
      const bookIds = parseIdList(singleQueryValue(request.query.bookIds));
      response.json(await dependencies.books.listCopiesForBooks(bookIds));
    }),
  );

  router.all(
    '/book-copies/devolucao/:id',
    asyncRoute(async (request, response) => {
      await dependencies.library.returnCopy(parseId(request.params.id));
      response.send('Devolução realizada com sucesso!');
    }),
  );

  router.post(
    '/emprestimo',
    asyncRoute(async (request, response) => {
      await dependencies.library.loanBook({
        livro_id: request.body.livro_id,
        exemplar_id: request.body.exemplar_id,
        leitor_id: request.body.leitor_id,
        data_emprestimo: request.body.data,
        data_prazo: request.body.data_devolucao,
      });
      response.send('Emprestimo realizado com sucesso!');
    }),
  );

  router.get(
    '/loans/history',
    asyncRoute(async (request, response) => {
      const result = await dependencies.books.listLoanHistory({
        search: singleQueryValue(request.query.search),
        status: optionalLoanHistoryStatus(request.query.status),
        bookId: optionalNumber(request.query.bookId),
        limit: optionalLimit(request.query.limit),
        offset: optionalOffset(request.query.offset),
      });

      response.setHeader('X-Has-More', result.hasMore ? '1' : '0');
      response.json(result.rows);
    }),
  );

  router.post(
    '/import/books',
    asyncRoute(async (request, response) => {
      response.json(await dependencies.library.importBooks(parseImportItems(request.body)));
    }),
  );

  router.post(
    '/import/users',
    asyncRoute(async (request, response) => {
      response.json(await dependencies.library.importUsers(parseImportItems(request.body)));
    }),
  );

  router.get('/config', (_request, response) => {
    response.json(dependencies.getConfig());
  });

  app.use('/api', router);

  app.get(
    '/export/users',
    asyncRoute(async (_request, response) => {
      response.setHeader('Content-Disposition', 'attachment; filename="leitores.json"');
      response.json(await dependencies.users.exportRawUsers());
    }),
  );

  app.get(
    '/export/books',
    asyncRoute(async (_request, response) => {
      response.setHeader('Content-Disposition', 'attachment; filename="livros.json"');
      response.json(await dependencies.books.exportRawBooks());
    }),
  );

  app.get(
    '/export/loans-history',
    asyncRoute(async (_request, response) => {
      response.setHeader('Content-Disposition', 'attachment; filename="historico-emprestimos.json"');
      response.json(await dependencies.books.exportLoanHistory());
    }),
  );

  app.get(
    '/reports/books.pdf',
    asyncRoute(async (request, response) => {
      const result = await dependencies.books.list({
        search: singleQueryValue(request.query.search),
        status: optionalNumber(request.query.status),
        tag: singleQueryValue(request.query.tag),
      });
      const pdf = buildBooksPdfReport(result.rows, 'Relatório do acervo');

      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', 'attachment; filename="relatorio-acervo.pdf"');
      response.send(pdf);
    }),
  );

  app.get(
    '/reports/overdue.pdf',
    asyncRoute(async (_request, response) => {
      const result = await dependencies.books.list({
        status: 2,
      });
      const pdf = buildOverduePdfReport(result.rows);

      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', 'attachment; filename="relatorio-atrasados.pdf"');
      response.send(pdf);
    }),
  );

  app.get(
    '/labels/books',
    asyncRoute(async (request, response) => {
      const copyIds = parseIdList(singleQueryValue(request.query.copyIds));
      const labels = copyIds.length > 0
        ? await dependencies.books.listCopiesByIds(copyIds)
        : await labelsFromBooksQuery(request, dependencies.books);
      const html = await renderBookLabelsHtml(labels);

      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.send(html);
    }),
  );
}

export function registerErrorHandler(app: Express): void {
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (isAppError(error)) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error(error);
    response.status(500).json({ error: 'Erro interno do servidor' });
  });
}

function asyncRoute(handler: AsyncHandler): AsyncHandler {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

function parseId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'ID inválido');
  }

  return id;
}

function singleQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  const raw = singleQueryValue(value);

  if (!raw) {
    return undefined;
  }

  const numberValue = Number(raw);
  return Number.isInteger(numberValue) ? numberValue : undefined;
}

function optionalLoanHistoryStatus(value: unknown): LoanHistoryStatus | undefined {
  const raw = singleQueryValue(value)?.toUpperCase();

  if (raw === 'EMPRESTADO' || raw === 'DEVOLVIDO') {
    return raw;
  }

  return undefined;
}

function parseImportItems(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }

  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: unknown[] }).items;
  }

  throw new AppError(400, 'Arquivo de importação precisa ser uma lista JSON');
}

function parseIdList(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function optionalLimit(value: unknown): number | undefined {
  const parsed = optionalNumber(value);

  if (!parsed || parsed <= 0) {
    return undefined;
  }

  return Math.min(parsed, 200);
}

function optionalOffset(value: unknown): number {
  const parsed = optionalNumber(value);

  if (!parsed || parsed < 0) {
    return 0;
  }

  return parsed;
}

async function labelsFromBooksQuery(request: Request, books: BooksRepository): Promise<BookLabelInfo[]> {
  const explicitBookIds = parseIdList(singleQueryValue(request.query.bookIds));

  if (explicitBookIds.length > 0) {
    return books.listCopiesForBooks(explicitBookIds);
  }

  const result = await books.list({
    search: singleQueryValue(request.query.search),
    status: optionalNumber(request.query.status),
    tag: singleQueryValue(request.query.tag),
  });

  return books.listCopiesForBooks(result.rows.map((book) => book.id));
}

async function renderBookLabelsHtml(labelsSource: BookLabelInfo[]): Promise<string> {
  const labels = await Promise.all(
    labelsSource.map(async (copy) => ({
      copy,
      qr: await QRCode.toDataURL(buildBookQrPayload(copy), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 112,
      }),
    })),
  );

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Etiquetas QR - Book DB</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; font-family: Arial, sans-serif; color: #111; background: #fff; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
    .toolbar h1 { font-size: 18px; margin: 0; }
    .toolbar button { border: 1px solid #111; background: #fff; padding: 8px 12px; cursor: pointer; }
    .labels { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; }
    .label { min-height: 124px; border: 1px dashed #444; padding: 8px; display: grid; grid-template-columns: 82px 1fr; gap: 8px; align-items: center; break-inside: avoid; }
    .label img { width: 82px; height: 82px; }
    .title { font-size: 12px; font-weight: 700; line-height: 1.2; margin-bottom: 4px; overflow-wrap: anywhere; }
    .meta { font-size: 10px; line-height: 1.25; color: #333; overflow-wrap: anywhere; }
    @media print {
      body { padding: 0; }
      .toolbar { display: none; }
      .labels { gap: 0; grid-template-columns: repeat(3, 1fr); }
      .label { border: 1px solid #888; margin: 0; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Etiquetas QR (${labels.length} livro(s))</h1>
    <button onclick="window.print()">Imprimir</button>
  </div>
  <main class="labels">
    ${labels.map(({ copy, qr }) => renderBookLabel(copy, qr)).join('')}
  </main>
</body>
</html>`;
}

function renderBookLabel(copy: BookLabelInfo, qr: string): string {
  return `<section class="label">
  <img src="${qr}" alt="QR do exemplar ${escapeHtml(copy.codigo)}">
  <div>
    <div class="title">${escapeHtml(copy.titulo)}</div>
    <div class="meta">Exemplar: ${escapeHtml(copy.codigo)}</div>
    <div class="meta">ISBN: ${escapeHtml(copy.isbn || '-')}</div>
    <div class="meta">Autor: ${escapeHtml(copy.autor || '-')}</div>
  </div>
</section>`;
}

function buildBookQrPayload(copy: BookLabelInfo): string {
  return JSON.stringify({
    type: 'book-copy',
    bookId: copy.livro_id,
    copyId: copy.id,
    code: copy.codigo,
    isbn: copy.isbn || '',
    title: copy.titulo,
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
