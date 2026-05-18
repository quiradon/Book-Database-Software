import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileDown,
  History,
  Library,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Tags,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActionItem, ActionMenu, Badge, Button, Card, Input, LinkButton, Modal, SearchableSelect, Select } from './ui';
import type { SearchableSelectOption } from './ui';
import { apiFetch, apiPage, apiText, daysOverdue, formatDate, formatDateTime, queryString } from './lib';
import type { AppConfig, BookCopyInfo, BookInfo, CopyMovementInfo, LoanHistoryInfo, StatsRow, UserInfo } from './types';

const PAGE_SIZE = 60;

interface ToastState {
  tone: 'success' | 'error';
  text: string;
}

interface BookFormState {
  titulo: string;
  autor: string;
  editora: string;
  isbn: string;
  tags: string;
  quantidade_exemplares: number;
}

interface UserFormState {
  nome: string;
  contato: string;
  turma: string;
}

function emptyBookForm(config?: AppConfig): BookFormState {
  return {
    titulo: '',
    autor: '',
    editora: '',
    isbn: '',
    tags: config?.tags[0] ?? '',
    quantidade_exemplares: 1,
  };
}

function emptyUserForm(): UserFormState {
  return {
    nome: '',
    contato: '',
    turma: '',
  };
}

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const route = window.location.pathname;

  const notify = useCallback((tone: ToastState['tone'], text: string) => {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    apiFetch<AppConfig>('/api/config')
      .then(setConfig)
      .catch(() => notify('error', 'Erro ao carregar configurações.'));
  }, [notify]);

  const page = useMemo(() => {
    if (route === '/leitores') {
      return <UsersPage config={config} notify={notify} />;
    }
    if (route === '/status') {
      return <StatsPage />;
    }
    if (route === '/config') {
      return <ConfigPage config={config} notify={notify} onConfigChanged={setConfig} />;
    }
    if (route === '/etiquetas') {
      return <LabelsPage config={config} notify={notify} />;
    }
    if (route === '/historico' || route.startsWith('/historico/livro/')) {
      return <HistoryPage notify={notify} />;
    }
    if (route.startsWith('/livros/')) {
      return <BookDetailPage notify={notify} />;
    }
    return <BooksPage overdueMode={route === '/atrasados'} config={config} notify={notify} />;
  }, [config, notify, route]);

  return (
    <div className="min-h-screen bg-[#15151d] text-slate-100">
      {toast && (
        <div
          className={`fixed bottom-4 left-4 z-[80] rounded-lg border px-4 py-3 text-sm shadow-xl ${
            toast.tone === 'success'
              ? 'border-emerald-500/50 bg-emerald-950 text-emerald-100'
              : 'border-rose-500/50 bg-rose-950 text-rose-100'
          }`}
        >
          {toast.text}
        </div>
      )}
      <div className="grid min-h-screen grid-cols-[1fr_320px]">
        <main className="min-w-0 overflow-auto p-4">{page}</main>
        <Sidebar activeRoute={route} />
      </div>
    </div>
  );
}

function Sidebar({ activeRoute }: { activeRoute: string }) {
  const items = [
    { href: '/', label: 'Livros', icon: BookOpen, active: activeRoute === '/' },
    { href: '/atrasados', label: 'Livros Atrasados', icon: Clock, active: activeRoute === '/atrasados' },
    { href: '/leitores', label: 'Leitores', icon: Users, active: activeRoute === '/leitores' },
    { href: '/config', label: 'Configurações', icon: Settings, active: activeRoute === '/config' },
    { href: '/status', label: 'Estatísticas', icon: BarChart3, active: activeRoute === '/status' },
  ];

  return (
    <aside className="border-l border-black/40 bg-[#1b1b25] p-3 shadow-2xl">
      <a className="mb-5 flex items-center gap-3 border-b border-white/12 pb-4 text-2xl font-semibold" href="/">
        <img src="/assets/img/icon.png" className="h-8 w-8" alt="" />
        Arkanu Book DB
      </a>
      <nav className="space-y-1">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition ${
              item.active ? 'bg-blue-600 text-white' : 'text-slate-100 hover:bg-white/8'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </a>
        ))}
      </nav>
      <div className="mt-6 grid gap-2">
        <LinkButton href="/?modal=new" variant="primary">Adicionar Livro</LinkButton>
        <LinkButton href="/leitores?modal=new" variant="secondary">Adicionar Leitor</LinkButton>
      </div>
    </aside>
  );
}

function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-blue-500/40 bg-black/20 p-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-44 flex-1 gap-1 text-sm text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

function BookStatusBadge({ book }: { book: BookInfo }) {
  if (book.exemplares_atrasados > 0) {
    return <Badge tone="red">Atrasado</Badge>;
  }
  if (book.exemplares_emprestados > 0) {
    return <Badge tone="yellow">Emprestado</Badge>;
  }
  return <Badge tone="green">Prateleira</Badge>;
}

function copyBadge(copy: BookCopyInfo) {
  if (!copy.emprestimo_id) {
    return <Badge tone="green">Disponível</Badge>;
  }
  return daysOverdue(copy.data_prazo) > 0 ? <Badge tone="red">Atrasado</Badge> : <Badge tone="yellow">Emprestado</Badge>;
}

function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-blue-100">
      <Loader2 className="animate-spin" size={16} />
      {label}
    </span>
  );
}

function ListLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-2/5 rounded bg-white/10" />
            <div className="h-4 w-3/5 rounded bg-white/8" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded bg-blue-500/20" />
              <div className="h-6 w-24 rounded bg-blue-500/20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card className="border-dashed border-white/16 bg-white/[0.03] text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
        <Search size={18} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {detail && <p className="mt-1 text-sm text-slate-400">{detail}</p>}
    </Card>
  );
}

function ClassCombobox({
  value,
  onChange,
  includeAll = false,
  allLabel = 'Todas',
  placeholder = 'Buscar turma',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [classes, setClasses] = useState<AppConfig['turmas']>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLoading(true);
      apiFetch<AppConfig['turmas']>(`/api/classes?${queryString({ search: search.trim(), limit: 30 })}`)
        .then(setClasses)
        .catch(() => setClasses([]))
        .finally(() => setLoading(false));
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [disabled, search]);

  const options = useMemo<SearchableSelectOption[]>(() => {
    const classOptions = classes.map((item) => ({
      value: item.value,
      label: item.nome,
      description: item.value,
    }));

    return includeAll ? [{ value: '', label: allLabel, description: 'Sem filtro de turma' }, ...classOptions] : classOptions;
  }, [allLabel, classes, includeAll]);

  const selectedClass = classes.find((item) => item.value === value);
  const selectedLabel = value ? selectedClass?.nome ?? value : includeAll ? allLabel : '';

  return (
    <SearchableSelect
      value={value}
      selectedLabel={selectedLabel}
      options={options}
      onChange={(nextValue) => onChange(nextValue)}
      onSearchChange={setSearch}
      placeholder={placeholder}
      emptyText="Nenhuma turma encontrada."
      loading={loading}
      disabled={disabled}
      allowClear={includeAll}
    />
  );
}

function BooksPage({
  overdueMode,
  config,
  notify,
}: {
  overdueMode: boolean;
  config: AppConfig | null;
  notify: (tone: ToastState['tone'], text: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState(overdueMode ? '2' : params.get('status') ?? '');
  const [tag, setTag] = useState(params.get('tag') ?? '');
  const [offset, setOffset] = useState(0);
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookDialog, setBookDialog] = useState<{ mode: 'new' | 'edit'; book?: BookInfo } | null>(() => {
    const modal = params.get('modal');
    return modal === 'new' ? { mode: 'new' } : null;
  });
  const [loanBook, setLoanBook] = useState<BookInfo | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ bookId: number; bookTitle: string; copyId?: number } | null>(null);

  const loadBooks = useCallback(
    async (nextOffset = offset) => {
      setLoading(true);
      try {
        const activeSearch = search.trim();
        const qs = activeSearch
          ? queryString({ search: activeSearch, limit: PAGE_SIZE, offset: nextOffset })
          : queryString({ status, tag, limit: PAGE_SIZE, offset: nextOffset });
        const result = await apiPage<BookInfo>(`/api/books?${qs}`);
        setBooks(result.rows);
        setHasMore(result.hasMore);
        setOffset(nextOffset);
        const urlParams = activeSearch ? queryString({ search: activeSearch }) : queryString({ status: overdueMode && status === '2' ? '' : status, tag });
        window.history.replaceState(null, '', `${overdueMode ? '/atrasados' : '/'}${urlParams ? `?${urlParams}` : ''}`);
      } catch (error) {
        console.error(error);
        notify('error', 'Erro ao carregar livros.');
      } finally {
        setLoading(false);
      }
    },
    [notify, offset, overdueMode, search, status, tag],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadBooks(0), 220);
    return () => window.clearTimeout(timeout);
  }, [loadBooks]);

  useEffect(() => {
    const modal = params.get('modal');
    if (modal && modal !== 'new') {
      apiFetch<BookInfo>(`/api/books/${modal}`)
        .then((book) => setBookDialog({ mode: 'edit', book }))
        .catch(() => notify('error', 'Livro não encontrado.'));
    }
    const emprestimo = params.get('emprestimo');
    if (emprestimo) {
      apiFetch<BookInfo>(`/api/books/${emprestimo}`)
        .then(setLoanBook)
        .catch(() => notify('error', 'Livro não encontrado.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setSearch('');
    setTag('');
    setStatus(overdueMode ? '2' : '');
    setOffset(0);
  };

  const removeBook = async (book: BookInfo) => {
    if (!window.confirm(`Excluir "${book.titulo}"?`)) {
      return;
    }
    try {
      await apiText(`/api/book/remove/${book.id}`, { method: 'POST' });
      notify('success', 'Livro removido.');
      await loadBooks(offset);
    } catch {
      notify('error', 'Erro ao remover livro.');
    }
  };

  return (
    <>
      <PageToolbar>
        <Field label="Busca">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-500" size={16} />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título, autor, editora, ISBN ou tag" />
          </div>
        </Field>
        <Field label="Status">
          <Select disabled={Boolean(search.trim())} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="0">Prateleira</option>
            <option value="1">Emprestados</option>
            <option value="2">Atrasados</option>
          </Select>
        </Field>
        <Field label="Tag">
          <Select disabled={Boolean(search.trim())} value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">Todas</option>
            {config?.tags.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </Field>
        <Button variant="secondary" onClick={clearFilters}>Limpar</Button>
        <LinkButton href="/etiquetas" variant="secondary"><QrCode size={16} />Etiquetas QR</LinkButton>
      </PageToolbar>

      <div className="mb-3 text-sm text-blue-200">
        {search.trim() ? `Busca global ativa: "${search.trim()}". Status e tag estão sendo ignorados.` : status || tag ? `Filtros ativos${status ? `: ${status === '2' ? 'Atrasados' : status === '1' ? 'Emprestados' : 'Prateleira'}` : ''}${tag ? ` | Tag: ${tag}` : ''}` : 'Sem filtros ativos.'}
      </div>
      <div className="mb-2 text-sm text-slate-300">
        {loading ? <Spinner label="Atualizando acervo" /> : books.length ? `Exibindo ${offset + 1}-${offset + books.length}${hasMore ? ' | há mais resultados' : ''}` : 'Nenhum livro encontrado.'}
      </div>

      {loading && books.length === 0 ? <ListLoading /> : books.length === 0 ? (
        <EmptyState title="Nenhum livro encontrado" detail="Ajuste a busca ou os filtros para ampliar os resultados." />
      ) : <div className="space-y-3">
        {books.map((book) => (
          <Card key={book.id}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <a href={`/livros/${book.id}`} className="text-xl font-bold hover:text-blue-300">{book.titulo}</a>
                  <BookStatusBadge book={book} />
                </div>
                <p>Autor: {book.autor} | Editora: {book.editora} | ISBN: {book.isbn || '-'}</p>
                <p>Exemplares: {book.total_exemplares || 0} | Disponíveis: {book.exemplares_disponiveis || 0} | Emprestados: {book.exemplares_emprestados || 0}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {book.tags?.split(',').filter(Boolean).map((item) => <Badge key={item}>{item}</Badge>)}
                </div>
              </div>
              <ActionMenu>
                <ActionItem onSelect={() => { window.location.href = `/livros/${book.id}`; }}>Detalhes</ActionItem>
                <ActionItem onSelect={() => setBookDialog({ mode: 'edit', book })}>Editar</ActionItem>
                <ActionItem onSelect={() => setHistoryTarget({ bookId: book.id, bookTitle: book.titulo, copyId: book.exemplar_id ?? undefined })}>Histórico</ActionItem>
                <ActionItem onSelect={() => setLoanBook(book)}>Emprestar</ActionItem>
                <ActionItem danger onSelect={() => void removeBook(book)}>Deletar</ActionItem>
              </ActionMenu>
            </div>
          </Card>
        ))}
      </div>}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="secondary" disabled={loading || offset === 0} onClick={() => void loadBooks(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button>
        <span className="text-sm text-slate-400">Página {Math.floor(offset / PAGE_SIZE) + 1}</span>
        <Button variant="secondary" disabled={loading || !hasMore} onClick={() => void loadBooks(offset + PAGE_SIZE)}>Próxima</Button>
      </div>

      <BookDialog
        open={Boolean(bookDialog)}
        mode={bookDialog?.mode ?? 'new'}
        book={bookDialog?.book}
        config={config}
        onClose={() => setBookDialog(null)}
        onSaved={() => {
          setBookDialog(null);
          notify('success', 'Livro salvo.');
          void loadBooks(offset);
        }}
        notify={notify}
      />
      <LoanDialog
        book={loanBook}
        config={config}
        onClose={() => setLoanBook(null)}
        onSaved={() => {
          setLoanBook(null);
          notify('success', 'Empréstimo realizado.');
          void loadBooks(offset);
        }}
        notify={notify}
      />
      <CopyHistoryModal
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
        notify={notify}
      />
    </>
  );
}

function BookDialog({
  open,
  mode,
  book,
  config,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  mode: 'new' | 'edit';
  book?: BookInfo;
  config: AppConfig | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (tone: ToastState['tone'], text: string) => void;
}) {
  const [form, setForm] = useState<BookFormState>(emptyBookForm(config ?? undefined));
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    setForm(book ? {
      titulo: book.titulo,
      autor: book.autor,
      editora: book.editora,
      isbn: book.isbn ?? '',
      tags: book.tags ?? '',
      quantidade_exemplares: book.total_exemplares || 1,
    } : emptyBookForm(config ?? undefined));
  }, [book, config, open]);

  const setField = (key: keyof BookFormState, value: string | number) => setForm((current) => ({ ...current, [key]: value }));

  const lookupIsbn = async () => {
    if (!form.isbn.trim()) {
      notify('error', 'Informe o ISBN antes de buscar.');
      return;
    }
    setLookupLoading(true);
    try {
      const data = await apiFetch<{ titulo: string; autor: string; editora: string; isbn: string }>(`/api/books/isbn/${encodeURIComponent(form.isbn)}`);
      setForm((current) => ({ ...current, titulo: data.titulo, autor: data.autor, editora: data.editora, isbn: data.isbn || current.isbn }));
      notify('success', 'Dados do ISBN preenchidos.');
    } catch {
      notify('error', 'Não foi possível encontrar esse ISBN.');
    } finally {
      setLookupLoading(false);
    }
  };

  const save = async () => {
    try {
      const payload = {
        titulo: form.titulo,
        autor: form.autor,
        editora: form.editora,
        isbn: form.isbn,
        tags: form.tags,
        quantidade_exemplares: Number(form.quantidade_exemplares) || 1,
      };
      if (mode === 'new') {
        await apiFetch('/api/book/add', { method: 'POST', body: JSON.stringify(payload) });
      } else if (book) {
        await apiText(`/api/book/edit/${book.id}`, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      }
      onSaved();
    } catch (error) {
      console.error(error);
      notify('error', 'Erro ao salvar livro.');
    }
  };

  return (
    <Modal open={open} title={mode === 'new' ? 'Adicionar livro' : 'Editar livro'} onOpenChange={(next) => !next && onClose()}>
      <div className="grid gap-3">
        <Field label="Nome"><Input value={form.titulo} onChange={(event) => setField('titulo', event.target.value)} /></Field>
        <Field label="Autor"><Input value={form.autor} onChange={(event) => setField('autor', event.target.value)} /></Field>
        <Field label="Editora"><Input value={form.editora} onChange={(event) => setField('editora', event.target.value)} /></Field>
        <Field label="ISBN opcional">
          <div className="flex gap-2">
            <Input value={form.isbn} onChange={(event) => setField('isbn', event.target.value)} />
            <Button type="button" variant="secondary" disabled={lookupLoading} onClick={() => void lookupIsbn()}>{lookupLoading ? 'Buscando...' : 'Buscar ISBN'}</Button>
          </div>
        </Field>
        <Field label="Quantidade de exemplares"><Input type="number" min={1} max={999} value={form.quantidade_exemplares} onChange={(event) => setField('quantidade_exemplares', Number(event.target.value))} /></Field>
        <Field label="Tags">
          <Input list="book-tags-list" value={form.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="Ex: HQs,Romance" />
        </Field>
        <datalist id="book-tags-list">{config?.tags.map((item) => <option key={item} value={item} />)}</datalist>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function LoanDialog({
  book,
  config,
  onClose,
  onSaved,
  notify,
}: {
  book: BookInfo | null;
  config: AppConfig | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (tone: ToastState['tone'], text: string) => void;
}) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [copies, setCopies] = useState<BookCopyInfo[]>([]);
  const [readerId, setReaderId] = useState('');
  const [readerSearch, setReaderSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [copyId, setCopyId] = useState('');
  const [days, setDays] = useState('7');

  useEffect(() => {
    if (!book) {
      setUsers([]);
      setCopies([]);
      setReaderId('');
      setReaderSearch('');
      setClassFilter('');
      setCopyId('');
      return;
    }

    setReaderId('');
    setReaderSearch('');
    setClassFilter('');
    setCopyId('');

    apiFetch<BookCopyInfo[]>(`/api/books/${book.id}/copies`)
      .then((copiesResult) => {
        const available = copiesResult.filter((copy) => !copy.emprestimo_id);
        setCopies(available);
        setCopyId(available[0]?.id ? String(available[0].id) : '');
      })
      .catch(() => notify('error', 'Erro ao carregar exemplares disponíveis.'));
  }, [book?.id, notify]);

  useEffect(() => {
    if (!book) return;

    const timeout = window.setTimeout(() => {
      setUsersLoading(true);
      const qs = queryString({
        search: readerSearch.trim(),
        turma: classFilter,
        limit: 20,
        offset: 0,
      });

      apiPage<UserInfo>(`/api/users?${qs}`)
        .then((result) => {
          setUsers(result.rows);
          setReaderId((current) => {
            if (result.rows.some((user) => String(user.id) === current)) {
              return current;
            }

            return result.rows[0]?.id ? String(result.rows[0].id) : '';
          });
        })
        .catch(() => {
          setUsers([]);
          notify('error', 'Erro ao buscar alunos.');
        })
        .finally(() => setUsersLoading(false));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [book?.id, classFilter, notify, readerSearch]);

  const save = async () => {
    if (!book || !readerId || !copyId) {
      notify('error', 'Selecione leitor e exemplar.');
      return;
    }
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + Number(days));
    try {
      await apiText('/api/emprestimo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          livro_id: book.id,
          exemplar_id: Number(copyId),
          leitor_id: Number(readerId),
          data: start.getTime(),
          data_devolucao: end.getTime(),
        }),
      });
      onSaved();
    } catch {
      notify('error', 'Erro ao realizar empréstimo.');
    }
  };

  return (
    <Modal open={Boolean(book)} title={`Emprestar ${book?.titulo ?? ''}`} onOpenChange={(next) => !next && onClose()}>
      <div className="grid gap-3">
        <Field label="Filtrar por turma">
          <ClassCombobox
            value={classFilter}
            includeAll
            allLabel="Todas as turmas"
            onChange={(value) => setClassFilter(value)}
          />
        </Field>
        <Field label="Leitor">
          <SearchableSelect
            value={readerId}
            options={users.map((user) => ({
              value: String(user.id),
              label: user.nome,
              description: `${user.turma} | ${user.emprestimos}/${config?.max_per_user ?? '-'} empréstimo(s)`,
            }))}
            onChange={setReaderId}
            onSearchChange={setReaderSearch}
            placeholder="Buscar aluno por nome, turma ou contato"
            emptyText="Nenhum aluno encontrado."
            loading={usersLoading}
            allowClear
          />
        </Field>
        <Field label="Exemplar">
          <Select value={copyId} onChange={(event) => setCopyId(event.target.value)}>
            {copies.map((copy) => <option key={copy.id} value={copy.id}>{copy.codigo}</option>)}
          </Select>
        </Field>
        <Field label="Prazo">
          <Select value={days} onChange={(event) => setDays(event.target.value)}>
            <option value="7">7 dias</option>
            <option value="14">14 dias</option>
            <option value="21">21 dias</option>
            <option value="30">30 dias</option>
          </Select>
        </Field>
        <p className="text-sm text-slate-400">Limite por leitor: {config?.max_per_user ?? '-'}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()}>Emprestar</Button>
        </div>
      </div>
    </Modal>
  );
}

function BookDetailPage({ notify }: { notify: (tone: ToastState['tone'], text: string) => void }) {
  const bookId = Number(window.location.pathname.match(/^\/livros\/(\d+)/)?.[1]);
  const [book, setBook] = useState<BookInfo | null>(null);
  const [copies, setCopies] = useState<BookCopyInfo[]>([]);
  const [loanBook, setLoanBook] = useState<BookInfo | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ bookId: number; bookTitle: string; copyId?: number } | null>(null);

  const load = useCallback(async () => {
    const [bookData, copyData] = await Promise.all([
      apiFetch<BookInfo>(`/api/books/${bookId}`),
      apiFetch<BookCopyInfo[]>(`/api/books/${bookId}/copies`),
    ]);
    setBook(bookData);
    setCopies(copyData);
  }, [bookId]);

  useEffect(() => {
    load()
      .catch(() => notify('error', 'Erro ao carregar livro.'));
  }, [load, notify]);

  const returnCopy = async (copy: BookCopyInfo) => {
    if (!window.confirm(`Devolver o exemplar ${copy.codigo}?`)) return;
    try {
      await apiText(`/api/book-copies/devolucao/${copy.id}`, { method: 'POST' });
      notify('success', 'Exemplar devolvido.');
      await load();
    } catch {
      notify('error', 'Erro ao devolver exemplar.');
    }
  };

  if (!book) {
    return (
      <div className="grid gap-3">
        <Card><Spinner label="Carregando livro" /></Card>
        <ListLoading rows={3} />
      </div>
    );
  }

  return (
    <div>
      <Card className="mb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{book.titulo}</h1>
              <BookStatusBadge book={book} />
            </div>
            <p>Autor: {book.autor} | Editora: {book.editora} | ISBN: {book.isbn || '-'}</p>
            <p>Exemplares: {book.total_exemplares} | Disponíveis: {book.exemplares_disponiveis} | Emprestados: {book.exemplares_emprestados} | Atrasados: {book.exemplares_atrasados}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/">Voltar</LinkButton>
            <LinkButton href={`/?modal=${book.id}`}>Editar</LinkButton>
            <Button variant="secondary" onClick={() => setHistoryTarget({ bookId, bookTitle: book.titulo })}>Histórico</Button>
            <Button onClick={() => setLoanBook(book)}>Emprestar</Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Exemplares</h2>
            <span className="text-sm text-slate-400">{copies.length} exemplar(es)</span>
          </div>
          <div className="space-y-3">
            {copies.map((copy) => (
              <Card key={copy.id}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="font-semibold">{copy.codigo}</h3>
                      {copyBadge(copy)}
                    </div>
                    {copy.emprestimo_id ? (
                      <>
                        <p>Leitor: <strong>{copy.leitor_nome}</strong> | Turma: {copy.leitor_turma}</p>
                        <p>Emprestado em {formatDate(copy.data_emprestimo)} | Prazo {formatDate(copy.data_prazo)}</p>
                      </>
                    ) : <p className="text-slate-400">Sem empréstimo ativo.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setHistoryTarget({ bookId, bookTitle: book.titulo, copyId: copy.id })}>Histórico</Button>
                    {copy.emprestimo_id ? (
                      <Button variant="danger" onClick={() => void returnCopy(copy)}>Devolver</Button>
                    ) : (
                      <Button onClick={() => setLoanBook(book)}>Emprestar</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
      <LoanDialog
        book={loanBook}
        config={null}
        onClose={() => setLoanBook(null)}
        onSaved={() => {
          setLoanBook(null);
          notify('success', 'Empréstimo realizado.');
          void load();
        }}
        notify={notify}
      />
      <CopyHistoryModal
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
        notify={notify}
      />
    </div>
  );
}

function CopyHistoryModal({
  target,
  onClose,
  notify,
}: {
  target: { bookId: number; bookTitle: string; copyId?: number } | null;
  onClose: () => void;
  notify: (tone: ToastState['tone'], text: string) => void;
}) {
  const [copies, setCopies] = useState<BookCopyInfo[]>([]);
  const [selectedCopyId, setSelectedCopyId] = useState<number | null>(null);
  const [movements, setMovements] = useState<CopyMovementInfo[]>([]);
  const [loadingCopies, setLoadingCopies] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => {
    if (!target) {
      setCopies([]);
      setSelectedCopyId(null);
      setMovements([]);
      return;
    }

    setLoadingCopies(true);
    apiFetch<BookCopyInfo[]>(`/api/books/${target.bookId}/copies`)
      .then((items) => {
        setCopies(items);
        setSelectedCopyId(target.copyId ?? items[0]?.id ?? null);
      })
      .catch(() => notify('error', 'Erro ao carregar exemplares.'))
      .finally(() => setLoadingCopies(false));
  }, [notify, target?.bookId, target?.copyId]);

  useEffect(() => {
    if (!target || !selectedCopyId) {
      setMovements([]);
      return;
    }

    setLoadingMovements(true);
    apiFetch<CopyMovementInfo[]>(`/api/book-copies/${selectedCopyId}/movements`)
      .then(setMovements)
      .catch(() => notify('error', 'Erro ao carregar histórico do exemplar.'))
      .finally(() => setLoadingMovements(false));
  }, [notify, selectedCopyId, target]);

  const selectedCopy = copies.find((copy) => copy.id === selectedCopyId) ?? null;

  return (
    <Modal
      open={Boolean(target)}
      title={target ? `Histórico de ${target.bookTitle}` : 'Histórico'}
      onOpenChange={(next) => !next && onClose()}
      contentClassName="w-[min(920px,calc(100vw-32px))]"
    >
      <div className="grid gap-4">
        {loadingCopies ? (
          <Card className="animate-pulse">
            <div className="h-9 rounded bg-white/10" />
          </Card>
        ) : copies.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label="Exemplar">
              <Select value={selectedCopyId ? String(selectedCopyId) : ''} onChange={(event) => setSelectedCopyId(Number(event.target.value))}>
                {copies.map((copy) => (
                  <option key={copy.id} value={copy.id}>{copy.codigo}</option>
                ))}
              </Select>
            </Field>
            {selectedCopy && (
              <div className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm">
                {copyBadge(selectedCopy)}
                <span className="ml-2 text-slate-300">{selectedCopy.codigo}</span>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="Nenhum exemplar cadastrado" />
        )}

        {loadingMovements ? (
          <ListLoading rows={4} />
        ) : movements.length > 0 ? (
          <CopyMovementTimeline movements={movements} />
        ) : (
          <EmptyState title="Sem movimentações" detail="Este exemplar ainda não possui movimentações registradas." />
        )}
      </div>
    </Modal>
  );
}

function CopyMovementTimeline({ movements }: { movements: CopyMovementInfo[] }) {
  return (
    <div className="relative space-y-3 pl-6 before:absolute before:left-2 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-blue-500/30">
      {movements.map((movement) => (
        <div key={movement.id} className="relative rounded-lg border border-white/12 bg-[#161620] p-4">
          <span className="absolute -left-[22px] top-4 flex h-8 w-8 items-center justify-center rounded-full border border-blue-500/50 bg-[#1b1b25] text-blue-200">
            {movementIcon(movement.tipo)}
          </span>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={movement.tipo === 'CADASTRADO' ? 'blue' : movement.tipo === 'DEVOLVIDO' ? 'green' : 'yellow'}>
                  {movementLabel(movement.tipo)}
                </Badge>
                <span className="text-sm text-slate-400">{formatDateTime(movement.data)}</span>
              </div>
              <h3 className="font-semibold">{movement.exemplar_codigo}</h3>
              {movement.leitor_nome ? (
                <p className="text-sm text-slate-300">
                  Pessoa: <strong>{movement.leitor_nome}</strong> | Turma: {movement.leitor_turma || '-'}
                </p>
              ) : (
                <p className="text-sm text-slate-400">Movimentação interna do acervo.</p>
              )}
            </div>
            {movement.data_prazo && (
              <div className="rounded-md border border-white/12 px-3 py-2 text-sm text-slate-300">
                Prazo: {formatDateTime(movement.data_prazo)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function movementIcon(type: CopyMovementInfo['tipo']) {
  if (type === 'CADASTRADO') {
    return <PackagePlus size={16} />;
  }
  if (type === 'DEVOLVIDO') {
    return <CheckCircle2 size={16} />;
  }
  return <Archive size={16} />;
}

function movementLabel(type: CopyMovementInfo['tipo']): string {
  if (type === 'CADASTRADO') {
    return 'Cadastrado';
  }
  if (type === 'DEVOLVIDO') {
    return 'Devolvido';
  }
  return 'Emprestado';
}

function HistoryPage({ notify }: { notify: (tone: ToastState['tone'], text: string) => void }) {
  const pathBookId = Number(window.location.pathname.match(/^\/historico\/livro\/(\d+)/)?.[1]) || undefined;
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [items, setItems] = useState<LoanHistoryInfo[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (nextOffset = offset) => {
    setLoading(true);
    try {
      const activeSearch = search.trim();
      const qs = activeSearch
        ? queryString({ bookId: pathBookId, search: activeSearch, limit: PAGE_SIZE, offset: nextOffset })
        : queryString({ bookId: pathBookId, status, limit: PAGE_SIZE, offset: nextOffset });
      const result = await apiPage<LoanHistoryInfo>(`/api/loans/history?${qs}`);
      setItems(result.rows);
      setHasMore(result.hasMore);
      setOffset(nextOffset);
    } catch {
      notify('error', 'Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, [notify, offset, pathBookId, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(0), 220);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <>
      <PageToolbar>
        <Field label="Busca"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Livro, leitor ou turma" /></Field>
        <Field label="Status">
          <Select disabled={Boolean(search.trim())} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="EMPRESTADO">Em aberto</option>
            <option value="DEVOLVIDO">Devolvidos</option>
          </Select>
        </Field>
        <LinkButton href="/export/loans-history"><FileDown size={16} />Exportar JSON</LinkButton>
      </PageToolbar>
      {loading && items.length === 0 ? <ListLoading /> : <HistoryList items={items} />}
      <div className="mt-4 flex items-center justify-between">
        <Button variant="secondary" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button>
        <span className="text-sm text-slate-400">Página {Math.floor(offset / PAGE_SIZE) + 1}</span>
        <Button variant="secondary" disabled={!hasMore} onClick={() => void load(offset + PAGE_SIZE)}>Próxima</Button>
      </div>
    </>
  );
}

function HistoryList({ items }: { items: LoanHistoryInfo[] }) {
  if (!items.length) {
    return <div className="text-sm text-slate-400">Nenhum histórico encontrado.</div>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <a className="font-semibold hover:text-blue-300" href={item.livro_id ? `/livros/${item.livro_id}` : '#'}>{item.livro_titulo}</a>
                <Badge tone={item.status === 'DEVOLVIDO' ? 'green' : 'yellow'}>{item.status === 'DEVOLVIDO' ? 'Devolvido' : 'Em aberto'}</Badge>
              </div>
              <p>Leitor: <strong>{item.leitor_nome}</strong> | Turma: {item.leitor_turma}</p>
              <p>Exemplar: {item.exemplar_codigo || '-'} | Emprestado em {formatDateTime(item.data_emprestimo)} | Prazo {formatDateTime(item.data_prazo)}</p>
            </div>
            <div className="text-sm text-slate-400">{item.status === 'DEVOLVIDO' ? `Devolvido em ${formatDateTime(item.data_devolucao)}` : 'Ainda não devolvido'}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function UsersPage({
  config,
  notify,
}: {
  config: AppConfig | null;
  notify: (tone: ToastState['tone'], text: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [turma, setTurma] = useState(params.get('turma') ?? '');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'new' | 'edit'; user?: UserInfo } | null>(() => params.get('modal') === 'new' ? { mode: 'new' } : null);

  const load = useCallback(async (nextOffset = offset) => {
    setLoading(true);
    try {
      const activeSearch = search.trim();
      const qs = queryString({ search: activeSearch, turma, limit: PAGE_SIZE, offset: nextOffset });
      const result = await apiPage<UserInfo>(`/api/users?${qs}`);
      setUsers(result.rows);
      setHasMore(result.hasMore);
      setOffset(nextOffset);
    } catch {
      notify('error', 'Erro ao carregar leitores.');
    } finally {
      setLoading(false);
    }
  }, [notify, offset, search, turma]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(0), 220);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const modal = params.get('modal');
    if (modal && modal !== 'new') {
      apiFetch<UserInfo>(`/api/users/${modal}`).then((user) => setDialog({ mode: 'edit', user })).catch(() => notify('error', 'Leitor não encontrado.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeUser = async (user: UserInfo) => {
    if (!window.confirm(`Excluir "${user.nome}"?`)) return;
    try {
      await apiText(`/api/users/remove/${user.id}`, { method: 'POST' });
      notify('success', 'Leitor removido.');
      await load(offset);
    } catch {
      notify('error', 'Erro ao remover leitor.');
    }
  };

  return (
    <>
      <PageToolbar>
        <Field label="Busca"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, turma ou contato" /></Field>
        <Field label="Turma">
          <ClassCombobox
            value={turma}
            includeAll
            allLabel="Todas"
            onChange={setTurma}
          />
        </Field>
        <Button onClick={() => setDialog({ mode: 'new' })}>Adicionar leitor</Button>
      </PageToolbar>
      <div className="mb-2 text-sm text-slate-300">
        {loading ? <Spinner label="Atualizando leitores" /> : users.length ? `Exibindo ${offset + 1}-${offset + users.length}${hasMore ? ' | há mais resultados' : ''}` : 'Nenhum leitor encontrado.'}
      </div>
      {loading && users.length === 0 ? <ListLoading /> : users.length === 0 ? (
        <EmptyState title="Nenhum leitor encontrado" detail="Ajuste a busca ou selecione outra turma." />
      ) : <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{user.nome}</h3>
                <p>Contato: {user.contato}</p>
                <p>Empréstimos: {user.emprestimos}/{config?.max_per_user ?? '-'} <Badge>{user.turma}</Badge></p>
              </div>
              <ActionMenu>
                <ActionItem onSelect={() => setDialog({ mode: 'edit', user })}>Editar</ActionItem>
                <ActionItem danger onSelect={() => void removeUser(user)}>Deletar</ActionItem>
              </ActionMenu>
            </div>
          </Card>
        ))}
      </div>}
      <div className="mt-4 flex items-center justify-between">
        <Button variant="secondary" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button>
        <span className="text-sm text-slate-400">Página {Math.floor(offset / PAGE_SIZE) + 1}</span>
        <Button variant="secondary" disabled={!hasMore} onClick={() => void load(offset + PAGE_SIZE)}>Próxima</Button>
      </div>
      <UserDialog
        open={Boolean(dialog)}
        mode={dialog?.mode ?? 'new'}
        user={dialog?.user}
        config={config}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          notify('success', 'Leitor salvo.');
          void load(offset);
        }}
        notify={notify}
      />
    </>
  );
}

function UserDialog({
  open,
  mode,
  user,
  config,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  mode: 'new' | 'edit';
  user?: UserInfo;
  config: AppConfig | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (tone: ToastState['tone'], text: string) => void;
}) {
  const [form, setForm] = useState<UserFormState>(emptyUserForm());

  useEffect(() => {
    setForm(user ? { nome: user.nome, contato: user.contato, turma: user.turma } : emptyUserForm());
  }, [open, user]);

  const save = async () => {
    try {
      if (mode === 'new') {
        await apiText('/api/users/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      } else if (user) {
        await apiText(`/api/users/edit/${user.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      onSaved();
    } catch {
      notify('error', 'Erro ao salvar leitor.');
    }
  };

  return (
    <Modal open={open} title={mode === 'new' ? 'Adicionar leitor' : 'Editar leitor'} onOpenChange={(next) => !next && onClose()}>
      <div className="grid gap-3">
        <Field label="Nome"><Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /></Field>
        <Field label="Contato"><Input value={form.contato} onChange={(event) => setForm({ ...form, contato: event.target.value })} /></Field>
        <Field label="Turma">
          <ClassCombobox
            value={form.turma}
            onChange={(turma) => setForm({ ...form, turma })}
            placeholder="Buscar turma"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function StatsPage() {
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch<StatsRow[]>('/api/status')
      .then((data) => setStats(data[0]))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);
  const rows = [
    ['Leitores', stats?.total_usuarios ?? 0],
    ['Leitores com empréstimos', stats?.usuarios_com_emprestimos ?? 0],
    ['Livros', stats?.total_livros ?? 0],
    ['Exemplares emprestados', stats?.livros_emprestados ?? 0],
    ['Exemplares atrasados', stats?.livros_atrasados ?? 0],
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href="/reports/books.pdf"><FileDown size={16} />PDF do acervo</LinkButton>
        <LinkButton href="/reports/overdue.pdf" variant="danger"><FileDown size={16} />PDF de atrasados</LinkButton>
      </div>
      {loading ? <ListLoading rows={3} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(([label, value]) => <Card key={label} className="bg-gradient-to-br from-[#1f2533] to-[#171720]"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></Card>)}
        </div>
      )}
    </>
  );
}

function LabelsPage({ config, notify }: { config: AppConfig | null; notify: (tone: ToastState['tone'], text: string) => void }) {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [tag, setTag] = useState(params.get('tag') ?? '');
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [copies, setCopies] = useState<BookCopyInfo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const activeSearch = search.trim();
  const filterQuery = activeSearch ? queryString({ search: activeSearch }) : queryString({ status, tag });

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await apiPage<BookInfo>(`/api/books?${queryString({ search: activeSearch, status: activeSearch ? '' : status, tag: activeSearch ? '' : tag, limit: 200, offset: 0 })}`);
        setBooks(result.rows);
        const ids = result.rows.map((book) => book.id).join(',');
        const nextCopies = ids ? await apiFetch<BookCopyInfo[]>(`/api/book-copies?bookIds=${encodeURIComponent(ids)}`) : [];
        setCopies(nextCopies);
        const visibleIds = new Set(nextCopies.map((copy) => copy.id));
        setSelected((current) => new Set(Array.from(current).filter((copyId) => visibleIds.has(copyId))));
        window.history.replaceState(null, '', `/etiquetas${filterQuery ? `?${filterQuery}` : ''}`);
      } catch {
        notify('error', 'Erro ao carregar etiquetas.');
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [activeSearch, filterQuery, notify, status, tag]);

  const toggle = (copyId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(copyId)) next.delete(copyId);
      else next.add(copyId);
      return next;
    });
  };

  const selectedUrl = () => `/labels/books?copyIds=${Array.from(selected).join(',')}`;
  const filteredUrl = () => `/labels/books${filterQuery ? `?${filterQuery}` : ''}`;

  const downloadSelected = () => {
    if (!selected.size) {
      notify('error', 'Selecione ao menos uma etiqueta.');
      return;
    }
    window.location.href = selectedUrl();
  };

  const downloadFiltered = () => {
    window.location.href = filteredUrl();
  };

  const toggleBook = (bookCopies: BookCopyInfo[]) => {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = bookCopies.every((copy) => next.has(copy.id));
      for (const copy of bookCopies) {
        if (allSelected) {
          next.delete(copy.id);
        } else {
          next.add(copy.id);
        }
      }
      return next;
    });
  };

  return (
    <>
      <PageToolbar>
        <LinkButton href="/" variant="secondary">Voltar ao acervo</LinkButton>
        <Field label="Busca"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título, autor, ISBN ou tag" /></Field>
        <Field label="Status">
          <Select disabled={Boolean(activeSearch)} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="0">Prateleira</option>
            <option value="1">Emprestados</option>
            <option value="2">Atrasados</option>
          </Select>
        </Field>
        <Field label="Tag">
          <Select disabled={Boolean(activeSearch)} value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">Todas</option>
            {config?.tags.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </Field>
        <Button onClick={downloadSelected}><FileDown size={16} />PDF selecionadas</Button>
        <Button variant="secondary" onClick={downloadFiltered}><QrCode size={16} />PDF dos filtros</Button>
        <Button variant="secondary" onClick={() => setSelected(new Set(copies.map((copy) => copy.id)))}>Selecionar visíveis</Button>
        <Button variant="secondary" onClick={() => setSelected(new Set())}>Limpar</Button>
      </PageToolbar>
      <p className="mb-2 text-sm text-slate-400">
        {selected.size} etiqueta(s) selecionada(s). {activeSearch ? 'Busca global ativa: status e tag estão ignorados.' : 'Use status e tag para gerar o PDF filtrado.'}
      </p>
      {loading ? <ListLoading /> : books.length === 0 ? (
        <EmptyState title="Nenhum livro para etiquetas" detail="Use a busca para encontrar os exemplares que receberão etiqueta." />
      ) : <div className="space-y-3">
        {books.map((book) => {
          const bookCopies = copies.filter((copy) => copy.livro_id === book.id);
          const allBookCopiesSelected = bookCopies.length > 0 && bookCopies.every((copy) => selected.has(copy.id));
          return (
            <Card key={book.id}>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{book.titulo}</h3>
                  <p className="text-sm text-slate-400">Autor: {book.autor} | ISBN: {book.isbn || '-'}</p>
                </div>
                {bookCopies.length > 1 && (
                  <Button variant="secondary" onClick={() => toggleBook(bookCopies)}>
                    {allBookCopiesSelected ? 'Limpar exemplares' : 'Selecionar todos'}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {bookCopies.map((copy) => (
                  <label key={copy.id} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-500/40 px-2 py-1 text-sm">
                    <input type="checkbox" checked={selected.has(copy.id)} onChange={() => toggle(copy.id)} />
                    {copy.codigo}
                    {copy.emprestimo_id ? <span className="text-amber-300">Emprestado</span> : <span className="text-emerald-300">Disponível</span>}
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
      </div>}
    </>
  );
}

function ConfigPage({
  config,
  notify,
  onConfigChanged,
}: {
  config: AppConfig | null;
  notify: (tone: ToastState['tone'], text: string) => void;
  onConfigChanged: (config: AppConfig) => void;
}) {
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setDraft({
        library_name: config.library_name,
        logo_data_url: config.logo_data_url,
        max_per_user: config.max_per_user,
        tags: [...config.tags],
        turmas: config.turmas.map((turma) => ({ ...turma })),
      });
    }
  }, [config]);

  const importJson = async (kind: 'books' | 'users', file: File | null) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const endpoint = kind === 'books' ? '/api/import/books' : '/api/import/users';
      const summary = await apiFetch<{ created: number; updated: number; skipped: number }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      notify('success', `Importação: ${summary.created} criado(s), ${summary.updated} atualizado(s), ${summary.skipped} ignorado(s).`);
    } catch {
      notify('error', 'Não foi possível importar esse JSON.');
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await apiFetch<AppConfig>('/api/config', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      onConfigChanged(updated);
      setDraft({
        library_name: updated.library_name,
        logo_data_url: updated.logo_data_url,
        max_per_user: updated.max_per_user,
        tags: [...updated.tags],
        turmas: updated.turmas.map((turma) => ({ ...turma })),
      });
      notify('success', 'Configurações salvas.');
    } catch {
      notify('error', 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => {
    if (!config) return;
    setDraft({
      library_name: config.library_name,
      logo_data_url: config.logo_data_url,
      max_per_user: config.max_per_user,
      tags: [...config.tags],
      turmas: config.turmas.map((turma) => ({ ...turma })),
    });
  };

  const updateTag = (index: number, value: string) => {
    setDraft((current) => current ? {
      ...current,
      tags: current.tags.map((tag, tagIndex) => tagIndex === index ? value : tag),
    } : current);
  };

  const updateClass = (index: number, patch: Partial<AppConfig['turmas'][number]>) => {
    setDraft((current) => current ? {
      ...current,
      turmas: current.turmas.map((turma, turmaIndex) => turmaIndex === index ? { ...turma, ...patch } : turma),
    } : current);
  };

  const dirty = Boolean(config && draft && JSON.stringify(config) !== JSON.stringify(draft));

  const uploadLogo = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      notify('error', 'Use uma imagem PNG ou JPG para o logo.');
      return;
    }

    if (file.size > 1_000_000) {
      notify('error', 'Use uma imagem de logo com até 1 MB.');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    setDraft((current) => current ? { ...current, logo_data_url: dataUrl } : current);
  };

  if (!draft) {
    return (
      <div className="grid gap-4">
        <Card>
          <Spinner label="Carregando configurações" />
        </Card>
        <ListLoading rows={2} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="border-blue-500/30 bg-gradient-to-br from-[#1f2533] to-[#171720]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Configuração local</h2>
            <p className="text-sm text-slate-400">Gerencie opções usadas nos cadastros, filtros e limites de empréstimo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!dirty || saving} onClick={resetDraft}><RefreshCw size={16} />Descartar</Button>
            <Button disabled={!dirty || saving} onClick={() => void save()}>{saving ? <Spinner label="Salvando" /> : 'Salvar alterações'}</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="grid gap-3">
            <Field label="Nome da biblioteca">
              <Input
                value={draft.library_name}
                onChange={(event) => setDraft({ ...draft, library_name: event.target.value })}
                placeholder="Nome que aparece nas etiquetas"
              />
            </Field>
            <Field label="Limite por leitor">
              <Input
                type="number"
                min={1}
                max={99}
                value={draft.max_per_user}
                onChange={(event) => setDraft({ ...draft, max_per_user: Number(event.target.value) || 1 })}
              />
            </Field>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/[0.03] p-3">
            <div className="mb-2 flex h-24 items-center justify-center rounded-md border border-dashed border-blue-500/40 bg-[#15151d]">
              {draft.logo_data_url ? (
                <img src={draft.logo_data_url} alt="Logo da biblioteca" className="max-h-20 max-w-full object-contain" />
              ) : (
                <span className="text-sm text-slate-500">Sem logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-blue-500/60 px-3 text-sm font-medium text-blue-100 hover:bg-blue-500/15">
                Enviar logo
                <input className="hidden" type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadLogo(event.target.files?.[0] ?? null)} />
              </label>
              <Button variant="ghost" disabled={!draft.logo_data_url} onClick={() => setDraft({ ...draft, logo_data_url: '' })}>Remover</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tags</h2>
              <p className="text-sm text-slate-400">{draft.tags.length} tag(s) cadastrada(s)</p>
            </div>
            <Button variant="secondary" onClick={() => setDraft({ ...draft, tags: [...draft.tags, 'Nova tag'] })}><Plus size={16} />Adicionar</Button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {draft.tags.map((tag, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <Input value={tag} onChange={(event) => updateTag(index, event.target.value)} />
                <Button
                  variant="ghost"
                  disabled={draft.tags.length <= 1}
                  onClick={() => setDraft({ ...draft, tags: draft.tags.filter((_, tagIndex) => tagIndex !== index) })}
                  title="Remover tag"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Turmas</h2>
              <p className="text-sm text-slate-400">{draft.turmas.length} turma(s) cadastrada(s)</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setDraft({ ...draft, turmas: [...draft.turmas, { nome: 'Nova turma', value: `TURMA-${draft.turmas.length + 1}` }] })}
            >
              <Plus size={16} />Adicionar
            </Button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {draft.turmas.map((turma, index) => (
              <div key={`${turma.value}-${index}`} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 md:grid-cols-[1.2fr_.8fr_auto]">
                <Input value={turma.nome} onChange={(event) => updateClass(index, { nome: event.target.value })} placeholder="Nome da turma" />
                <Input value={turma.value} onChange={(event) => updateClass(index, { value: event.target.value })} placeholder="Código" />
                <Button
                  variant="ghost"
                  disabled={draft.turmas.length <= 1}
                  onClick={() => setDraft({ ...draft, turmas: draft.turmas.filter((_, turmaIndex) => turmaIndex !== index) })}
                  title="Remover turma"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Importação e exportação</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/export/books">Exportar livros</LinkButton>
          <LinkButton href="/export/users">Exportar leitores</LinkButton>
          <LinkButton href="/export/loans-history">Exportar histórico</LinkButton>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-blue-500/60 px-3 text-sm font-medium text-blue-100 hover:bg-blue-500/15">
            Importar livros
            <input className="hidden" type="file" accept="application/json,.json" onChange={(event) => void importJson('books', event.target.files?.[0] ?? null)} />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-blue-500/60 px-3 text-sm font-medium text-blue-100 hover:bg-blue-500/15">
            Importar leitores
            <input className="hidden" type="file" accept="application/json,.json" onChange={(event) => void importJson('users', event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Atalhos</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/historico"><History size={16} />Histórico</LinkButton>
          <LinkButton href="/etiquetas"><Tags size={16} />Etiquetas QR</LinkButton>
          <LinkButton href="/" variant="primary"><Library size={16} />Acervo</LinkButton>
        </div>
      </Card>
    </div>
  );
}
