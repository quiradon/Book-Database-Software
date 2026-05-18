import type { BookInfo } from '../repositories/booksRepository';

interface PdfLine {
  text: string;
  size?: number;
  gapAfter?: number;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const LINE_HEIGHT = 14;
const FONT_OBJECT_ID = 3;

export function buildBooksPdfReport(books: BookInfo[], title: string): Buffer {
  const lines: PdfLine[] = [
    { text: title, size: 17, gapAfter: 10 },
    { text: `Gerado em ${formatDateTime(Date.now())}`, size: 9 },
    { text: `Total de livros no relatório: ${books.length}`, size: 10, gapAfter: 12 },
  ];

  if (books.length === 0) {
    lines.push({ text: 'Nenhum livro encontrado para os filtros atuais.', size: 11 });
    return renderPdf(lines);
  }

  for (const book of books) {
    lines.push({ text: `${book.id}. ${book.titulo}`, size: 12 });
    lines.push({ text: `Autor: ${book.autor || '-'} | Editora: ${book.editora || '-'} | ISBN: ${book.isbn || '-'}` });
    lines.push({
      text:
        `Tags: ${book.tags || '-'} | Status: ${statusLabel(book.status)} | ` +
        `Exemplares: ${book.total_exemplares || 1} (${book.exemplares_disponiveis || 0} disponíveis)`,
    });

    if (book.status !== 0) {
      lines.push({
        text:
          `Exemplar: ${book.exemplar_codigo || '-'} | ` +
          `Leitor: ${book.leitor_nome || '-'} (${book.leitor_turma || '-'}) | Prazo: ${formatTimestamp(book.data_prazo)}`,
      });
    }

    if (book.status === 2) {
      lines.push({ text: `Atraso: ${daysOverdue(book.data_prazo)} dia(s)`, gapAfter: 8 });
    } else {
      lines.push({ text: '', gapAfter: 6 });
    }
  }

  return renderPdf(lines);
}

export function buildOverduePdfReport(books: BookInfo[]): Buffer {
  const lines: PdfLine[] = [
    { text: 'Relatório de livros atrasados', size: 17, gapAfter: 10 },
    { text: `Gerado em ${formatDateTime(Date.now())}`, size: 9 },
    { text: `Livros atrasados: ${books.length}`, size: 10, gapAfter: 12 },
  ];

  if (books.length === 0) {
    lines.push({ text: 'Nenhum livro atrasado encontrado.', size: 11 });
    return renderPdf(lines);
  }

  for (const book of books) {
    lines.push({ text: `${book.id}. ${book.titulo}`, size: 12 });
    lines.push({ text: `Exemplar: ${book.exemplar_codigo || '-'} | Leitor: ${book.leitor_nome || '-'} (${book.leitor_turma || '-'})` });
    lines.push({ text: `Emprestado em: ${formatTimestamp(book.data_emprestimo)} | Prazo: ${formatTimestamp(book.data_prazo)}` });
    lines.push({ text: `Atraso: ${daysOverdue(book.data_prazo)} dia(s) | Contato via turma: ${book.leitor_turma || '-'}`, gapAfter: 8 });
  }

  return renderPdf(lines);
}

export function daysOverdue(value: string | number | null): number {
  const timestamp = normalizeTimestamp(value);

  if (!timestamp) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

export function statusLabel(status: number): string {
  if (status === 1) {
    return 'Emprestado';
  }

  if (status === 2) {
    return 'Atrasado';
  }

  return 'Disponível';
}

function renderPdf(lines: PdfLine[]): Buffer {
  const pages = paginate(lines);
  const objects: string[] = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  const pageObjectIds: number[] = [];
  let nextObjectId = 4;

  for (const page of pages) {
    const contentStream = page.join('\n');
    const contentId = nextObjectId++;
    const pageId = nextObjectId++;

    objects[contentId] = `<< /Length ${Buffer.byteLength(contentStream, 'latin1')} >>\nstream\n${contentStream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${FONT_OBJECT_ID} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageObjectIds.push(pageId);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  return buildPdf(objects);
}

function paginate(lines: PdfLine[]): string[][] {
  const pages: string[][] = [];
  let currentPage: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const pushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    currentPage = [];
    y = PAGE_HEIGHT - MARGIN;
  };

  for (const line of lines) {
    const fontSize = line.size ?? 10;
    const wrapped = wrapText(line.text, maxCharsForSize(fontSize));

    for (const text of wrapped) {
      if (y < MARGIN) {
        pushPage();
      }

      currentPage.push(textCommand(text, MARGIN, y, fontSize));
      y -= LINE_HEIGHT + Math.max(0, fontSize - 10);
    }

    y -= line.gapAfter ?? 0;
  }

  pushPage();
  return pages.length > 0 ? pages : [[textCommand('', MARGIN, PAGE_HEIGHT - MARGIN, 10)]];
}

function buildPdf(objects: string[]): Buffer {
  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets = [0];
  let offset = Buffer.byteLength(chunks[0], 'latin1');

  for (let index = 1; index < objects.length; index++) {
    const object = `${index} 0 obj\n${objects[index]}\nendobj\n`;
    offsets[index] = offset;
    chunks.push(object);
    offset += Buffer.byteLength(object, 'latin1');
  }

  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join('');

  chunks.push(xref);
  return Buffer.from(chunks.join(''), 'latin1');
}

function textCommand(text: string, x: number, y: number, size: number): string {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y.toFixed(2)} Tm ${toPdfHexString(text)} Tj ET`;
}

function toPdfHexString(value: string): string {
  const bytes = [];

  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;
    bytes.push(code <= 255 ? code : 63);
  }

  return `<${Buffer.from(bytes).toString('hex').toUpperCase()}>`;
}

function wrapText(value: string, maxChars: number): string[] {
  if (value.length === 0) {
    return [''];
  }

  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function maxCharsForSize(size: number): number {
  return Math.max(40, Math.floor((PAGE_WIDTH - MARGIN * 2) / (size * 0.54)));
}

function formatTimestamp(value: string | number | null): string {
  const timestamp = normalizeTimestamp(value);
  return timestamp ? formatDateTime(timestamp) : '-';
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function normalizeTimestamp(value: string | number | null): number | null {
  const numberValue = typeof value === 'string' ? Number(value) : value;

  if (!Number.isFinite(numberValue) || !numberValue) {
    return null;
  }

  return Math.abs(numberValue) < 10000000000 ? numberValue * 1000 : numberValue;
}
