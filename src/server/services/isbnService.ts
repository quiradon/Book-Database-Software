import { AppError } from '../errors';

interface BrasilApiBook {
  isbn?: string;
  title?: string;
  authors?: unknown;
  publisher?: string;
  provider?: string;
}

interface OpenLibraryBook {
  title?: string;
  publishers?: string[];
  authors?: Array<{ key?: string }>;
}

interface OpenLibraryAuthor {
  name?: string;
  personal_name?: string;
}

interface GoogleBooksResponse {
  totalItems?: number;
  items?: GoogleBookItem[];
}

interface GoogleBookItem {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    industryIdentifiers?: GoogleBooksIdentifier[];
  };
}

interface GoogleBooksIdentifier {
  type?: string;
  identifier?: string;
}

export interface IsbnLookupResult {
  titulo: string;
  autor: string;
  editora: string;
  isbn: string;
  fonte?: string;
}

interface LookupProvider {
  lookup: (isbn: string) => Promise<IsbnLookupResult | null>;
}

interface LookupResultInput {
  titulo?: unknown;
  autores?: unknown;
  editora?: unknown;
  isbn: string;
  fonte: string;
}

const BRASIL_API_BASE_URL = 'https://brasilapi.com.br/api/isbn/v1';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const ISBN_PATTERN = /^(?:\d{9}[\dX]|\d{13})$/;

export function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9X]/gi, '').toUpperCase();
}

export async function lookupBookByIsbn(rawIsbn: string): Promise<IsbnLookupResult> {
  const isbn = normalizeIsbn(rawIsbn);

  if (!isbn) {
    throw new AppError(400, 'ISBN inválido');
  }

  if (!ISBN_PATTERN.test(isbn)) {
    throw new AppError(400, 'ISBN deve ter 10 ou 13 caracteres');
  }

  const providers: LookupProvider[] = [
    { lookup: lookupBrasilApi },
    { lookup: lookupOpenLibrary },
    { lookup: lookupGoogleBooks },
  ];

  let checkedProviders = 0;

  for (const provider of providers) {
    try {
      const result = await provider.lookup(isbn);
      checkedProviders += 1;

      if (result) {
        return result;
      }
    } catch (_error) {
      // Fallback intencional: uma API fora do ar nao deve bloquear as demais.
    }
  }

  if (checkedProviders === 0) {
    throw new AppError(502, 'Não foi possível consultar o ISBN agora');
  }

  throw new AppError(404, 'ISBN não encontrado em nenhum provedor');
}

async function lookupBrasilApi(isbn: string): Promise<IsbnLookupResult | null> {
  const book = await fetchJson<BrasilApiBook>(`${BRASIL_API_BASE_URL}/${encodeURIComponent(isbn)}`);

  if (!book) {
    return null;
  }

  return buildLookupResult({
    titulo: book.title,
    autores: book.authors,
    editora: book.publisher,
    isbn: normalizeIsbn(book.isbn ?? '') || isbn,
    fonte: book.provider ? `BrasilAPI (${book.provider})` : 'BrasilAPI',
  });
}

async function lookupOpenLibrary(isbn: string): Promise<IsbnLookupResult | null> {
  const book = await fetchJson<OpenLibraryBook>(`${OPEN_LIBRARY_BASE_URL}/isbn/${encodeURIComponent(isbn)}.json`);

  if (!book) {
    return null;
  }

  const authorNames = await resolveAuthorNames(book.authors ?? []);

  return buildLookupResult({
    titulo: book.title,
    autores: authorNames,
    editora: book.publishers,
    isbn,
    fonte: 'Open Library',
  });
}

async function lookupGoogleBooks(isbn: string): Promise<IsbnLookupResult | null> {
  const response = await fetchJson<GoogleBooksResponse>(
    `${GOOGLE_BOOKS_BASE_URL}?q=${encodeURIComponent(`isbn:${isbn}`)}&maxResults=1`,
  );

  const item = response?.items?.find((googleBook) => cleanString(googleBook.volumeInfo?.title)) ?? response?.items?.[0];
  const volumeInfo = item?.volumeInfo;

  if (!volumeInfo) {
    return null;
  }

  return buildLookupResult({
    titulo: volumeInfo.title,
    autores: volumeInfo.authors,
    editora: volumeInfo.publisher,
    isbn: pickGoogleIsbn(volumeInfo.industryIdentifiers, isbn),
    fonte: 'Google Books',
  });
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
        return author?.name || author?.personal_name || '';
      } catch (_error) {
        return '';
      }
    }),
  );

  return results.map((name) => name.trim()).filter(Boolean);
}

function buildLookupResult(input: LookupResultInput): IsbnLookupResult | null {
  const titulo = cleanString(input.titulo);

  if (!titulo) {
    return null;
  }

  const autores = toStringList(input.autores);
  const editoras = toStringList(input.editora);

  return {
    titulo,
    autor: autores.length > 0 ? autores.join(', ') : 'Autor não informado',
    editora: editoras.length > 0 ? editoras.join(', ') : 'Editora não informada',
    isbn: normalizeIsbn(input.isbn) || input.isbn,
    fonte: input.fonte,
  };
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanString(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickGoogleIsbn(identifiers: GoogleBooksIdentifier[] | undefined, fallback: string): string {
  const exactIdentifier = identifiers?.find((identifier) => normalizeIsbn(identifier.identifier ?? '') === fallback);
  const isbn13 = identifiers?.find((identifier) => identifier.type === 'ISBN_13');
  const isbn10 = identifiers?.find((identifier) => identifier.type === 'ISBN_10');

  return normalizeIsbn(exactIdentifier?.identifier ?? '')
    || normalizeIsbn(isbn13?.identifier ?? '')
    || normalizeIsbn(isbn10?.identifier ?? '')
    || fallback;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 400 || response.status === 404) {
      return null;
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
