import { AppError } from '../errors';

interface OpenLibraryBook {
  title?: string;
  publishers?: string[];
  authors?: Array<{ key?: string }>;
}

interface OpenLibraryAuthor {
  name?: string;
  personal_name?: string;
}

export interface IsbnLookupResult {
  titulo: string;
  autor: string;
  editora: string;
  isbn: string;
}

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';

export function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9X]/gi, '').toUpperCase();
}

export async function lookupBookByIsbn(rawIsbn: string): Promise<IsbnLookupResult> {
  const isbn = normalizeIsbn(rawIsbn);

  if (!isbn) {
    throw new AppError(400, 'ISBN inválido');
  }

  const book = await fetchJson<OpenLibraryBook>(`${OPEN_LIBRARY_BASE_URL}/isbn/${encodeURIComponent(isbn)}.json`);
  const authorNames = await resolveAuthorNames(book.authors ?? []);

  return {
    titulo: book.title?.trim() || 'Título não informado',
    autor: authorNames.length > 0 ? authorNames.join(', ') : 'Autor não informado',
    editora: Array.isArray(book.publishers) && book.publishers.length > 0
      ? book.publishers.filter(Boolean).join(', ')
      : 'Editora não informada',
    isbn,
  };
}

async function resolveAuthorNames(authors: Array<{ key?: string }>): Promise<string[]> {
  const authorKeys = authors
    .map((author) => author.key)
    .filter((key): key is string => Boolean(key))
    .slice(0, 4);

  const results = await Promise.all(
    authorKeys.map(async (key) => {
      try {
        const author = await fetchJson<OpenLibraryAuthor>(`${OPEN_LIBRARY_BASE_URL}${key}.json`);
        return author.name || author.personal_name || '';
      } catch (_error) {
        return '';
      }
    }),
  );

  return results.map((name) => name.trim()).filter(Boolean);
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new AppError(404, 'ISBN não encontrado');
    }

    if (!response.ok) {
      throw new AppError(502, 'Erro ao consultar serviço de ISBN');
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, 'Não foi possível consultar o ISBN agora');
  } finally {
    clearTimeout(timeout);
  }
}
