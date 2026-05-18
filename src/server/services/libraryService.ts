import type { AppConfig } from '../config';
import type { SqliteConnection } from '../database/connection';
import { AppError } from '../errors';
import type { BookInput, LoanInput } from '../repositories/booksRepository';
import { BooksRepository } from '../repositories/booksRepository';
import type { UserInput } from '../repositories/usersRepository';
import { UsersRepository } from '../repositories/usersRepository';

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

export class LibraryService {
  constructor(
    private readonly db: SqliteConnection,
    private readonly books: BooksRepository,
    private readonly users: UsersRepository,
    private readonly getConfig: () => AppConfig,
  ) {}

  async addBook(input: Partial<BookInput> & { quantidade_exemplares?: unknown }): Promise<number> {
    const book = normalizeBookInput(input);
    const copies = optionalCopyCount(input.quantidade_exemplares) ?? 1;

    return this.db.transaction(async () => {
      const bookId = await this.books.create(book);
      await this.syncBookCopies(bookId, copies);
      return bookId;
    });
  }

  async editBook(id: number, input: Partial<BookInput> & { quantidade_exemplares?: unknown }): Promise<void> {
    const book = normalizeBookInput(input);
    const copies = optionalCopyCount(input.quantidade_exemplares);

    await this.db.transaction(async () => {
      const updated = await this.books.update(id, book);

      if (!updated) {
        throw new AppError(404, 'Livro não encontrado');
      }

      if (copies) {
        await this.syncBookCopies(id, copies);
      }
    });
  }

  async removeBook(id: number): Promise<void> {
    const removed = await this.books.remove(id);

    if (!removed) {
      throw new AppError(404, 'Livro não encontrado');
    }
  }

  async addUser(input: Partial<UserInput>): Promise<void> {
    await this.users.create(normalizeUserInput(input));
  }

  async editUser(id: number, input: Partial<UserInput>): Promise<void> {
    const updated = await this.users.update(id, normalizeUserInput(input));

    if (!updated) {
      throw new AppError(404, 'Leitor não encontrado');
    }
  }

  async removeUser(id: number): Promise<void> {
    const removed = await this.users.remove(id);

    if (!removed) {
      throw new AppError(404, 'Leitor não encontrado');
    }
  }

  async returnBook(bookId: number): Promise<void> {
    await this.db.transaction(async () => {
      const loan = await this.books.getLoanByBookId(bookId);

      if (!loan) {
        throw new AppError(404, 'Empréstimo não encontrado');
      }

      const [book, user] = await Promise.all([
        this.books.getById(bookId),
        this.users.getById(loan.leitor_id),
      ]);
      const returned = await this.books.returnLoan(bookId);

      if (!returned) {
        throw new AppError(404, 'Empréstimo não encontrado');
      }

      const dataDevolucao = Date.now();
      const historyUpdated = await this.books.finishLoanHistory({
        livro_id: bookId,
        exemplar_id: loan.exemplar_id,
        data_emprestimo: loan.data_emprestimo,
        data_devolucao: dataDevolucao,
      });

      if (!historyUpdated && book && user) {
        await this.books.createLoanHistory({
          livro_id: book.id,
          leitor_id: user.id,
          livro_titulo: book.titulo,
          leitor_nome: user.nome,
          leitor_turma: user.turma,
          exemplar_id: loan.exemplar_id,
          exemplar_codigo: loan.exemplar_codigo,
          data_emprestimo: loan.data_emprestimo,
          data_prazo: loan.data_prazo,
          data_devolucao: dataDevolucao,
          status: 'DEVOLVIDO',
        });
      }
    });
  }

  async returnCopy(copyId: number): Promise<void> {
    await this.db.transaction(async () => {
      const loan = await this.books.getLoanByCopyId(copyId);

      if (!loan) {
        throw new AppError(404, 'Empréstimo não encontrado');
      }

      const [book, user] = await Promise.all([
        this.books.getById(loan.livro_id),
        this.users.getById(loan.leitor_id),
      ]);
      const returned = await this.books.returnLoanByCopyId(copyId);

      if (!returned) {
        throw new AppError(404, 'Empréstimo não encontrado');
      }

      const dataDevolucao = Date.now();
      const historyUpdated = await this.books.finishLoanHistory({
        livro_id: loan.livro_id,
        exemplar_id: loan.exemplar_id,
        data_emprestimo: loan.data_emprestimo,
        data_devolucao: dataDevolucao,
      });

      if (!historyUpdated && book && user) {
        await this.books.createLoanHistory({
          livro_id: book.id,
          leitor_id: user.id,
          livro_titulo: book.titulo,
          leitor_nome: user.nome,
          leitor_turma: user.turma,
          exemplar_id: loan.exemplar_id,
          exemplar_codigo: loan.exemplar_codigo,
          data_emprestimo: loan.data_emprestimo,
          data_prazo: loan.data_prazo,
          data_devolucao: dataDevolucao,
          status: 'DEVOLVIDO',
        });
      }
    });
  }

  async loanBook(input: Partial<LoanInput>): Promise<void> {
    const loan = normalizeLoanInput(input);
    const config = this.getConfig();

    await this.db.transaction(async () => {
      const [book, user, userLoans] = await Promise.all([
        this.books.getById(loan.livro_id),
        this.users.getById(loan.leitor_id),
        this.books.countLoansByUserId(loan.leitor_id),
      ]);

      if (!book) {
        throw new AppError(404, 'Livro não encontrado');
      }

      if (!user) {
        throw new AppError(404, 'Leitor não encontrado');
      }

      if (userLoans >= config.max_per_user) {
        throw new AppError(400, 'Leitor excedeu o limite de empréstimos');
      }

      const copy = loan.exemplar_id
        ? await this.books.getCopyById(loan.exemplar_id)
        : await this.books.getFirstAvailableCopy(book.id);

      if (!copy || copy.livro_id !== book.id) {
        throw new AppError(404, 'Exemplar não encontrado');
      }

      if (copy.emprestimo_id) {
        throw new AppError(409, 'Exemplar já está emprestado');
      }

      await this.books.createLoan({
        ...loan,
        exemplar_id: copy.id,
      });
      await this.books.createLoanHistory({
        livro_id: book.id,
        leitor_id: user.id,
        livro_titulo: book.titulo,
        leitor_nome: user.nome,
        leitor_turma: user.turma,
        exemplar_id: copy.id,
        exemplar_codigo: copy.codigo,
        data_emprestimo: loan.data_emprestimo,
        data_prazo: loan.data_prazo,
        status: 'EMPRESTADO',
      });
    });
  }

  async setBookCopies(bookId: number, total: unknown): Promise<void> {
    const desiredTotal = copyCount(total);

    await this.db.transaction(async () => {
      await this.syncBookCopies(bookId, desiredTotal);
    });
  }

  async importBooks(items: unknown[]): Promise<ImportSummary> {
    const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };

    await this.db.transaction(async () => {
      for (const item of items) {
        try {
          const book = normalizeBookInput(item as Partial<BookInput>);
          const normalizedIsbn = normalizeIsbn(book.isbn);
          const existing = normalizedIsbn
            ? await this.books.findByNormalizedIsbn(normalizedIsbn)
            : undefined;

          if (existing) {
            await this.books.update(existing.id, book);
            const copies = optionalCopyCount((item as { quantidade_exemplares?: unknown }).quantidade_exemplares);
            if (copies) {
              await this.syncBookCopies(existing.id, copies);
            }
            summary.updated += 1;
          } else {
            const bookId = await this.books.create(book);
            const copies = optionalCopyCount((item as { quantidade_exemplares?: unknown }).quantidade_exemplares);
            if (copies) {
              await this.syncBookCopies(bookId, copies);
            }
            summary.created += 1;
          }
        } catch (_error) {
          summary.skipped += 1;
        }
      }
    });

    return summary;
  }

  async importUsers(items: unknown[]): Promise<ImportSummary> {
    const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };

    await this.db.transaction(async () => {
      for (const item of items) {
        try {
          const user = normalizeUserInput(item as Partial<UserInput>);
          const existing = await this.users.findByContact(user.contato);

          if (existing) {
            await this.users.update(existing.id, user);
            summary.updated += 1;
          } else {
            await this.users.create(user);
            summary.created += 1;
          }
        } catch (_error) {
          summary.skipped += 1;
        }
      }
    });

    return summary;
  }

  private async syncBookCopies(bookId: number, desiredTotal: number): Promise<void> {
    const book = await this.books.getById(bookId);

    if (!book) {
      throw new AppError(404, 'Livro não encontrado');
    }

    let copies = await this.books.listCopies(bookId);
    const loaned = copies.filter((copy) => copy.emprestimo_id);

    if (desiredTotal < loaned.length) {
      throw new AppError(400, 'Não é possível remover exemplares emprestados');
    }

    while (copies.length < desiredTotal) {
      const nextNumber = Math.max(0, ...copies.map((copy) => copy.numero)) + 1;
      await this.books.createCopy(bookId, nextNumber);
      copies = await this.books.listCopies(bookId);
    }

    while (copies.length > desiredTotal) {
      const removable = copies
        .filter((copy) => !copy.emprestimo_id)
        .sort((a, b) => b.numero - a.numero)[0];

      if (!removable) {
        throw new AppError(400, 'Não há exemplar disponível para remover');
      }

      await this.books.deleteAvailableCopy(removable.id);
      copies = await this.books.listCopies(bookId);
    }
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, `Campo obrigatório: ${field}`);
  }

  return value.trim();
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBookInput(input: Partial<BookInput>): BookInput {
  return {
    titulo: requiredString(input.titulo, 'titulo'),
    autor: requiredString(input.autor, 'autor'),
    editora: requiredString(input.editora, 'editora'),
    isbn: optionalString(input.isbn),
    tags: requiredString(input.tags, 'tags'),
  };
}

function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9X]/gi, '').toUpperCase();
}

function normalizeUserInput(input: Partial<UserInput>): UserInput {
  return {
    nome: requiredString(input.nome, 'nome'),
    contato: requiredString(input.contato, 'contato'),
    turma: requiredString(input.turma, 'turma'),
  };
}

function positiveInteger(value: unknown, field: string): number {
  const numberValue = typeof value === 'string' ? Number(value) : value;

  if (!Number.isInteger(numberValue) || Number(numberValue) <= 0) {
    throw new AppError(400, `Campo inválido: ${field}`);
  }

  return Number(numberValue);
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  return positiveInteger(value, field);
}

function copyCount(value: unknown): number {
  const numberValue = typeof value === 'string' ? Number(value) : value;

  if (!Number.isInteger(numberValue) || Number(numberValue) < 1 || Number(numberValue) > 999) {
    throw new AppError(400, 'Quantidade de exemplares inválida');
  }

  return Number(numberValue);
}

function optionalCopyCount(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  return copyCount(value);
}

function timestamp(value: unknown, field: string): number {
  const numberValue = typeof value === 'string' ? Number(value) : value;

  if (!Number.isFinite(numberValue) || Number(numberValue) <= 0) {
    throw new AppError(400, `Campo inválido: ${field}`);
  }

  return Number(numberValue);
}

function normalizeLoanInput(input: Partial<LoanInput>): LoanInput {
  const loan = {
    livro_id: positiveInteger(input.livro_id, 'livro_id'),
    exemplar_id: optionalPositiveInteger(input.exemplar_id, 'exemplar_id'),
    leitor_id: positiveInteger(input.leitor_id, 'leitor_id'),
    data_emprestimo: timestamp(input.data_emprestimo, 'data'),
    data_prazo: timestamp(input.data_prazo, 'data_devolucao'),
  };

  if (loan.data_prazo <= loan.data_emprestimo) {
    throw new AppError(400, 'Prazo de devolução precisa ser maior que a data de empréstimo');
  }

  return loan;
}
