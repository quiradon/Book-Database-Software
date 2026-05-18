import type { Express, NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { AppConfig } from '../config';
import { AppError, isAppError } from '../errors';
import type { BookInfo, BookLabelInfo, LoanHistoryStatus } from '../repositories/booksRepository';
import { BooksRepository } from '../repositories/booksRepository';
import { StatsRepository } from '../repositories/statsRepository';
import { UsersRepository } from '../repositories/usersRepository';
import { buildBooksPdfReport, buildLabelsPdfReport, buildOverduePdfReport } from '../reports/pdfReport';
import { normalizeSearchTerm } from '../search';
import { lookupBookByIsbn } from '../services/isbnService';
import { LibraryService } from '../services/libraryService';

interface ApiDependencies {
  books: BooksRepository;
  users: UsersRepository;
  stats: StatsRepository;
  library: LibraryService;
  getConfig: () => AppConfig;
  setConfig: (input: Partial<AppConfig>) => AppConfig;
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

const DEFAULT_PAGE_LIMIT = 60;
const MAX_PAGE_LIMIT = 200;
const DEFAULT_CLASS_LIMIT = 20;
const MAX_CLASS_LIMIT = 100;

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
      const limit = pageLimit(request.query.limit);
      const offset = optionalOffset(request.query.offset);
      const result = await dependencies.books.list({
        search: singleQueryValue(request.query.search),
        status: optionalNumber(request.query.status),
        tag: singleQueryValue(request.query.tag),
        limit,
        offset,
      });

      sendPaginatedJson(response, result.rows, result.hasMore, limit, offset);
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
      const limit = pageLimit(request.query.limit);
      const offset = optionalOffset(request.query.offset);
      const result = await dependencies.users.list({
        search: singleQueryValue(request.query.search),
        turma: singleQueryValue(request.query.turma),
        limit,
        offset,
      });

      sendPaginatedJson(response, result.rows, result.hasMore, limit, offset);
    }),
  );

  router.get(
    '/book-copies',
    asyncRoute(async (request, response) => {
      const bookIds = parseIdList(singleQueryValue(request.query.bookIds));
      response.json(await dependencies.books.listCopiesForBooks(bookIds));
    }),
  );

  router.get(
    '/book-copies/:id/movements',
    asyncRoute(async (request, response) => {
      response.json(await dependencies.books.listCopyMovements(parseId(request.params.id)));
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
      const limit = pageLimit(request.query.limit);
      const offset = optionalOffset(request.query.offset);
      const result = await dependencies.books.listLoanHistory({
        search: singleQueryValue(request.query.search),
        status: optionalLoanHistoryStatus(request.query.status),
        bookId: optionalNumber(request.query.bookId),
        copyId: optionalNumber(request.query.copyId),
        limit,
        offset,
      });

      sendPaginatedJson(response, result.rows, result.hasMore, limit, offset);
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

  router.get(
    '/classes',
    asyncRoute(async (request, response) => {
      const search = normalizeSearchTerm(singleQueryValue(request.query.search) ?? '');
      const limit = classLimit(request.query.limit);
      const classes = dependencies.getConfig().turmas
        .filter((classItem) => {
          if (!search) {
            return true;
          }

          return normalizeSearchTerm(`${classItem.nome} ${classItem.value}`).includes(search);
        })
        .slice(0, limit);

      response.json(classes);
    }),
  );

  router.put(
    '/config',
    asyncRoute(async (request, response) => {
      response.json(dependencies.setConfig(request.body));
    }),
  );

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
      const pdf = await buildLabelsPdfReport(labels, dependencies.getConfig());

      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', 'attachment; filename="etiquetas-livros.pdf"');
      response.send(pdf);
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

function pageLimit(value: unknown): number {
  const parsed = optionalNumber(value);

  if (!parsed || parsed <= 0) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
}

function classLimit(value: unknown): number {
  const parsed = optionalNumber(value);

  if (!parsed || parsed <= 0) {
    return DEFAULT_CLASS_LIMIT;
  }

  return Math.min(parsed, MAX_CLASS_LIMIT);
}

function optionalOffset(value: unknown): number {
  const parsed = optionalNumber(value);

  if (!parsed || parsed < 0) {
    return 0;
  }

  return parsed;
}

function sendPaginatedJson<T>(
  response: Response,
  rows: T[],
  hasMore: boolean,
  limit: number,
  offset: number,
): void {
  response.setHeader('X-Has-More', hasMore ? '1' : '0');
  response.setHeader('X-Limit', String(limit));
  response.setHeader('X-Offset', String(offset));
  response.setHeader('X-Next-Offset', String(offset + rows.length));
  response.json(rows);
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
