import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function normalizeTimestamp(value: unknown): number | null {
  const numberValue = Number(value);
  if (Number.isFinite(numberValue)) {
    return Math.abs(numberValue) < 10000000000 ? numberValue * 1000 : numberValue;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function formatDate(value: unknown): string {
  const timestamp = normalizeTimestamp(value);
  if (!timestamp) {
    return '-';
  }
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

export function formatDateTime(value: unknown): string {
  const timestamp = normalizeTimestamp(value);
  if (!timestamp) {
    return '-';
  }
  return new Date(timestamp).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function daysOverdue(value: unknown): number {
  const timestamp = normalizeTimestamp(value);
  if (!timestamp) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

export function queryString(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(error.error || 'Erro na requisição');
  }

  return response.json() as Promise<T>;
}

export async function apiText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error('Erro na requisição');
  }
  return response.text();
}

export interface PageResult<T> {
  rows: T[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export async function apiPage<T>(url: string): Promise<PageResult<T>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Erro ao carregar dados');
  }
  return {
    rows: (await response.json()) as T[],
    hasMore: response.headers.get('X-Has-More') === '1',
    limit: Number(response.headers.get('X-Limit') || 60),
    offset: Number(response.headers.get('X-Offset') || 0),
  };
}
