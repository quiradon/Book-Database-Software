import {
  Archive,
  BarChart3,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
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
  Smartphone,
  Tags,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActionItem, ActionMenu, Badge, Button, Card, Input, LinkButton, Modal, SearchableSelect, Select } from './ui';
import type { SearchableSelectOption } from './ui';
import { apiFetch, apiPage, apiText, daysOverdue, formatDate, formatDateTime, queryString } from './lib';
import type { AppConfig, BookCopyInfo, BookInfo, CopyMovementInfo, LoanHistoryInfo, StatsRow, UserInfo } from './types';

const PAGE_SIZE = 60;
const MOBILE_TOKEN_STORAGE_KEY = 'book-db-mobile-token';

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

interface MobileAccessStatus {
  active: boolean;
  provider: 'cloudflared';
  publicUrl: string | null;
  mobileUrl: string | null;
  qrCodeDataUrl: string | null;
  startedAt: number | null;
  expiresAt: number | null;
}

interface MobileSessionStatus extends MobileAccessStatus {
  libraryName: string;
  logoDataUrl: string;
}

interface ScannerControls {
  stop: () => void;
}

interface ScannerResult {
  getText: () => string;
}

interface NativeBarcodeDetector {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

interface NativeBarcodeDetectorConstructor {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
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
    if (route === '/mobile') {
      return <MobileScannerPage notify={notify} />;
    }
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
    if (route === '/mobile-access') {
      return <MobileAccessPage notify={notify} />;
    }
    if (route === '/historico' || route.startsWith('/historico/livro/')) {
      return <HistoryPage notify={notify} />;
    }
    if (route.startsWith('/livros/')) {
      return <BookDetailPage notify={notify} />;
    }
    return <BooksPage overdueMode={route === '/atrasados'} config={config} notify={notify} />;
  }, [config, notify, route]);

  if (route === '/mobile') {
    return (
      <div className="min-h-screen bg-[#101018] text-slate-100">
        {toast && (
          <div
            className={`fixed bottom-4 left-4 right-4 z-[80] rounded-lg border px-4 py-3 text-sm shadow-xl ${
              toast.tone === 'success'
                ? 'border-emerald-500/50 bg-emerald-950 text-emerald-100'
                : 'border-rose-500/50 bg-rose-950 text-rose-100'
            }`}
          >
            {toast.text}
          </div>
        )}
        {page}
      </div>
    );
  }

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
    { href: '/mobile-access', label: 'Acesso Mobile', icon: Smartphone, active: activeRoute === '/mobile-access' },
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

function readStoredMobileToken(): string {
  try {
    return window.localStorage.getItem(MOBILE_TOKEN_STORAGE_KEY) ?? '';
  } catch (_error) {
    return '';
  }
}

function writeStoredMobileToken(token: string): void {
  try {
    window.localStorage.setItem(MOBILE_TOKEN_STORAGE_KEY, token);
  } catch (_error) {
    // Storage can be blocked by browser privacy settings; the URL token still works.
  }
}

function clearStoredMobileToken(): void {
  try {
    window.localStorage.removeItem(MOBILE_TOKEN_STORAGE_KEY);
  } catch (_error) {
    // Ignore storage failures.
  }
}

async function startNativeQrScanner(
  video: HTMLVideoElement,
  onResult: (value: string) => void,
): Promise<ScannerControls | null> {
  const BarcodeDetector = (window as typeof window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
  if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  const supportedFormats = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : ['qr_code'];
  if (!supportedFormats.includes('qr_code')) {
    return null;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
  });
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  let stopped = false;
  let timeoutId = 0;

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const stop = () => {
    stopped = true;
    window.clearTimeout(timeoutId);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  const scan = async () => {
    if (stopped) {
      return;
    }

    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const result = await detector.detect(video);
        const value = result[0]?.rawValue?.trim();
        if (value) {
          stop();
          onResult(value);
          return;
        }
      }
    } catch (_error) {
      // Keep scanning; transient decode errors are expected frame by frame.
    }

    timeoutId = window.setTimeout(scan, 45);
  };

  timeoutId = window.setTimeout(scan, 80);

  return { stop };
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

function MobileAccessPage({ notify }: { notify: (tone: ToastState['tone'], text: string) => void }) {
  const [status, setStatus] = useState<MobileAccessStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(() => {
    apiFetch<MobileAccessStatus>('/api/mobile/access')
      .then(setStatus)
      .catch(() => notify('error', 'Erro ao carregar acesso mobile.'));
  }, [notify]);

  useEffect(() => {
    loadStatus();
    const interval = window.setInterval(loadStatus, 8000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  const start = async () => {
    setLoading(true);
    try {
      const nextStatus = await apiFetch<MobileAccessStatus>('/api/mobile/access/start', { method: 'POST' });
      setStatus(nextStatus);
      notify('success', 'Acesso mobile iniciado.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Erro ao iniciar túnel mobile.');
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    setLoading(true);
    try {
      const nextStatus = await apiFetch<MobileAccessStatus>('/api/mobile/access/stop', { method: 'POST' });
      setStatus(nextStatus);
      notify('success', 'Acesso mobile encerrado.');
    } catch {
      notify('error', 'Erro ao encerrar acesso mobile.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!status?.mobileUrl) {
      return;
    }

    await navigator.clipboard.writeText(status.mobileUrl);
    notify('success', 'Link copiado.');
  };

  return (
    <div className="grid gap-4">
      <PageToolbar>
        <div className="min-w-64 flex-1">
          <p className="text-sm text-slate-400">Túnel temporário para operação pelo celular</p>
          <h1 className="text-xl font-semibold">Acesso Mobile</h1>
        </div>
        {status?.active ? (
          <Button variant="danger" onClick={() => void stop()} disabled={loading}>
            Encerrar acesso
          </Button>
        ) : (
          <Button onClick={() => void start()} disabled={loading}>
            <Smartphone size={16} />
            Iniciar acesso
          </Button>
        )}
      </PageToolbar>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="grid place-items-center gap-3">
          {loading ? (
            <div className="grid h-72 place-items-center">
              <Spinner label="Preparando túnel" />
            </div>
          ) : status?.active && status.qrCodeDataUrl ? (
            <>
              <img src={status.qrCodeDataUrl} className="h-72 w-72 rounded-md bg-white p-3" alt="QR Code do acesso mobile" />
              <Badge tone="green">Ativo</Badge>
            </>
          ) : (
            <div className="grid h-72 place-items-center text-center text-slate-400">
              <div>
                <Smartphone className="mx-auto mb-3 text-blue-200" size={42} />
                <p>Nenhum acesso mobile ativo.</p>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold">Sessão temporária</h2>
              <p className="mt-1 text-sm text-slate-400">
                O QR Code abre uma tela mobile limitada para ler etiquetas, emprestar exemplares e registrar devoluções.
              </p>
            </div>

            {status?.active ? (
              <div className="grid gap-3">
                <div className="rounded-md border border-white/12 bg-black/20 p-3">
                  <p className="text-xs uppercase text-slate-500">Link público</p>
                  <a className="break-all text-sm text-blue-200 hover:text-blue-100" href={status.mobileUrl ?? '#'} target="_blank" rel="noreferrer">
                    {status.mobileUrl}
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void copyLink()}>
                    <Copy size={16} />
                    Copiar link
                  </Button>
                  <LinkButton href={status.mobileUrl ?? '#'} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    Abrir
                  </LinkButton>
                </div>
                <div className="grid gap-1 text-sm text-slate-300">
                  <span>Provedor: Cloudflare Quick Tunnel</span>
                  <span>Iniciado em {formatDateTime(status.startedAt)}</span>
                  <span>Expira em {formatDateTime(status.expiresAt)}</span>
                  <span>O mesmo QR Code pode ser usado por vários celulares da equipe.</span>
                </div>
              </div>
            ) : (
              <EmptyState title="Acesso desligado" detail="Inicie uma sessão para gerar o QR Code que será escaneado pelo celular." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MobileScannerPage({ notify }: { notify: (tone: ToastState['tone'], text: string) => void }) {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? readStoredMobileToken());
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const scanInFlightRef = useRef(false);
  const [session, setSession] = useState<MobileSessionStatus | null>(null);
  const [validating, setValidating] = useState(true);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [manualPayload, setManualPayload] = useState('');
  const [copy, setCopy] = useState<BookCopyInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const [classSearch, setClassSearch] = useState('');
  const [classes, setClasses] = useState<AppConfig['turmas']>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [readerId, setReaderId] = useState('');
  const [readerLabel, setReaderLabel] = useState('');
  const [days, setDays] = useState('15');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }

    writeStoredMobileToken(token);

    apiFetch<MobileSessionStatus>(`/api/mobile/session?${queryString({ token })}`)
      .then(setSession)
      .catch(() => {
        clearStoredMobileToken();
        setToken('');
        setSession(null);
      })
      .finally(() => setValidating(false));
  }, [token]);

  useEffect(() => {
    if (session?.active) {
      void import('@zxing/browser');
    }
  }, [session?.active]);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScannerRunning(false);
    setScannerLoading(false);
  }, []);

  const resolvePayload = useCallback(async (payload: string) => {
    const normalizedPayload = payload.trim();
    if (!normalizedPayload || scanInFlightRef.current) {
      return;
    }

    if (!token) {
      notify('error', 'Sessão mobile inválida.');
      return;
    }

    scanInFlightRef.current = true;
    setResolving(true);
    try {
      const resolved = await apiFetch<BookCopyInfo>('/api/mobile/copies/resolve', {
        method: 'POST',
        body: JSON.stringify({ token, payload: normalizedPayload }),
      });
      setCopy(resolved);
      setReaderId('');
      setReaderLabel('');
      setManualPayload('');
      notify('success', 'Etiqueta lida.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'QR Code inválido.');
    } finally {
      setResolving(false);
      scanInFlightRef.current = false;
    }
  }, [notify, token]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current || scannerRunning || scannerLoading || resolving) {
      return;
    }

    setScannerError('');
    setScannerLoading(true);

    try {
      const handleResult = (value: string) => {
        controlsRef.current?.stop();
        controlsRef.current = null;
        setScannerLoading(false);
        setScannerRunning(false);
        void resolvePayload(value);
      };
      const nativeControls = await startNativeQrScanner(videoRef.current, handleResult);
      if (nativeControls) {
        controlsRef.current = nativeControls;
        setScannerLoading(false);
        setScannerRunning(true);
        return;
      }

      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 45,
        delayBetweenScanSuccess: 120,
        tryPlayVideoTimeout: 3500,
      });
      const onDecode = (result: ScannerResult | undefined, _error: unknown, controls: ScannerControls) => {
        if (!result || scanInFlightRef.current) {
          return;
        }

        controls.stop();
        controlsRef.current = null;
        setScannerRunning(false);
        void resolvePayload(result.getText());
      };

      controlsRef.current = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 960 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        },
        videoRef.current,
        onDecode,
      );
      setScannerLoading(false);
      setScannerRunning(true);
    } catch {
      setScannerLoading(false);
      setScannerRunning(false);
      setScannerError('Não foi possível abrir a câmera neste navegador.');
    }
  }, [resolvePayload, resolving, scannerLoading, scannerRunning]);

  useEffect(() => stopScanner, [stopScanner]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setClassesLoading(true);
      apiFetch<AppConfig['turmas']>(`/api/mobile/classes?${queryString({ token, search: classSearch.trim(), limit: 30 })}`)
        .then(setClasses)
        .catch(() => setClasses([]))
        .finally(() => setClassesLoading(false));
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [classSearch, token]);

  useEffect(() => {
    if (!token || !copy || copy.emprestimo_id) {
      setUsers([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      setUsersLoading(true);
      apiFetch<UserInfo[]>(`/api/mobile/users?${queryString({ token, search: userSearch.trim(), turma: classFilter, limit: 20 })}`)
        .then(setUsers)
        .catch(() => setUsers([]))
        .finally(() => setUsersLoading(false));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [classFilter, copy, token, userSearch]);

  const classOptions = useMemo<SearchableSelectOption[]>(() => [
    { value: '', label: 'Todas as turmas', description: 'Sem filtro' },
    ...classes.map((item) => ({ value: item.value, label: item.nome, description: item.value })),
  ], [classes]);
  const selectedClass = classes.find((item) => item.value === classFilter);
  const userOptions = users.map((user) => ({
    value: String(user.id),
    label: user.nome,
    description: `${user.turma} | ${user.emprestimos} empréstimo(s)`,
  }));

  const returnCopy = async () => {
    if (!copy) {
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch<BookCopyInfo>(`/api/mobile/copies/${copy.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setCopy(updated);
      notify('success', 'Devolução registrada.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Erro ao devolver exemplar.');
    } finally {
      setSaving(false);
    }
  };

  const loanCopy = async () => {
    if (!copy || !readerId) {
      notify('error', 'Selecione um leitor.');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch<BookCopyInfo>(`/api/mobile/copies/${copy.id}/loan`, {
        method: 'POST',
        body: JSON.stringify({ token, leitor_id: Number(readerId), dias: Number(days) }),
      });
      setCopy(updated);
      notify('success', 'Empréstimo registrado.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Erro ao emprestar exemplar.');
    } finally {
      setSaving(false);
    }
  };

  if (validating) {
    return <div className="grid min-h-screen place-items-center p-4"><Spinner label="Validando sessão" /></div>;
  }

  if (!token || !session?.active) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <Card className="max-w-md text-center">
          <Smartphone className="mx-auto mb-3 text-rose-200" size={42} />
          <h1 className="text-xl font-semibold">Sessão indisponível</h1>
          <p className="mt-2 text-sm text-slate-400">Gere um novo QR Code na tela de Acesso Mobile do computador.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-xl content-start gap-3 bg-[#101018] p-3 pb-6">
      <header className="sticky top-0 z-20 -mx-3 flex items-center gap-3 border-b border-white/10 bg-[#101018]/95 px-3 py-3 backdrop-blur">
        {session.logoDataUrl ? (
          <img src={session.logoDataUrl} className="h-11 w-11 rounded-md object-cover" alt="" />
        ) : (
          <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-600 font-semibold">QR</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">Operação mobile</p>
          <h1 className="truncate text-lg font-semibold">{session.libraryName}</h1>
        </div>
        <Badge tone={scannerRunning ? 'green' : 'slate'}>{scannerRunning ? 'Lendo' : 'Pronto'}</Badge>
      </header>

      <section className="overflow-hidden rounded-lg border border-blue-500/40 bg-[#161621] shadow-lg">
        <div className="relative overflow-hidden bg-black">
          <video ref={videoRef} className="aspect-[3/4] max-h-[58vh] w-full object-cover sm:aspect-[4/3]" muted playsInline />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-44 w-44 rounded-2xl border-2 border-blue-300/90 shadow-[0_0_0_999px_rgba(0,0,0,0.24)]" />
          </div>
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-black/65 px-3 py-1 text-xs text-slate-100">
              {scannerRunning ? 'Aponte para o QR da etiqueta' : scannerLoading ? 'Abrindo câmera...' : 'Câmera pronta'}
            </span>
            {(resolving || scannerLoading) && <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          </div>
        </div>

        <div className="grid gap-3 p-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button className="h-11" onClick={() => void startScanner()} disabled={scannerRunning || scannerLoading || resolving}>
              <Camera size={17} />
              {scannerRunning ? 'Lendo etiqueta' : scannerLoading ? 'Abrindo...' : 'Escanear etiqueta'}
            </Button>
            <Button className="h-11 px-4" variant="secondary" onClick={stopScanner} disabled={!scannerRunning && !scannerLoading}>
              Parar
            </Button>
          </div>

          {scannerError && <p className="rounded-md border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">{scannerError}</p>}
          {resolving && <Spinner label="Identificando exemplar" />}

          <details className="rounded-md border border-white/10 bg-black/20 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-200">Digitar ID manualmente</summary>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <Input
                value={manualPayload}
                onChange={(event) => setManualPayload(event.target.value.replace(/\D/g, ''))}
                placeholder="ID do exemplar"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <Button variant="secondary" onClick={() => void resolvePayload(manualPayload)} disabled={!manualPayload.trim() || resolving}>
                Buscar
              </Button>
            </div>
          </details>
        </div>
      </section>

      {copy ? (
        <section className="grid gap-3 rounded-lg border border-white/12 bg-[#1b1b25] p-4 shadow-sm">
          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs uppercase text-slate-500">Exemplar {copy.codigo}</p>
                <h2 className="text-lg font-semibold leading-tight">{copy.titulo}</h2>
              </div>
              {copyBadge(copy)}
            </div>
            <div className="grid gap-1 text-sm text-slate-400">
              <span>Autor: {copy.autor || '-'}</span>
              <span>ISBN: {copy.isbn || '-'}</span>
              {copy.emprestimo_id && (
                <span className="rounded-md border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-amber-100">
                  Com {copy.leitor_nome} ({copy.leitor_turma}) até {formatDate(copy.data_prazo)}
                </span>
              )}
            </div>
          </div>

          {copy.emprestimo_id ? (
            <Button className="h-11" variant="danger" onClick={() => void returnCopy()} disabled={saving}>
              Registrar devolução
            </Button>
          ) : (
            <div className="grid gap-3 rounded-md border border-blue-500/20 bg-black/15 p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <Field label="Turma">
                  <SearchableSelect
                    value={classFilter}
                    selectedLabel={classFilter ? selectedClass?.nome ?? classFilter : 'Todas as turmas'}
                    options={classOptions}
                    onChange={(value) => {
                      setClassFilter(value);
                      setReaderId('');
                      setReaderLabel('');
                    }}
                    onSearchChange={setClassSearch}
                    loading={classesLoading}
                    allowClear
                  />
                </Field>
                <Field label="Prazo">
                  <Select value={days} onChange={(event) => setDays(event.target.value)}>
                    <option value="7">7 dias</option>
                    <option value="15">15 dias</option>
                    <option value="30">30 dias</option>
                    <option value="45">45 dias</option>
                  </Select>
                </Field>
              </div>
              <Field label="Leitor">
                <SearchableSelect
                  value={readerId}
                  selectedLabel={readerLabel}
                  options={userOptions}
                  onChange={(value, option) => {
                    setReaderId(value);
                    setReaderLabel(option?.label ?? '');
                  }}
                  onSearchChange={setUserSearch}
                  placeholder="Buscar aluno"
                  emptyText="Nenhum aluno encontrado."
                  loading={usersLoading}
                />
              </Field>
              <Button className="h-11" onClick={() => void loanCopy()} disabled={saving || !readerId}>
                Registrar empréstimo
              </Button>
            </div>
          )}

          <Button
            className="h-10"
            variant="ghost"
            onClick={() => {
              setCopy(null);
              setManualPayload('');
              setReaderId('');
              setReaderLabel('');
              void startScanner();
            }}
          >
            <Camera size={16} />
            Ler próximo exemplar
          </Button>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-white/14 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
          Escaneie uma etiqueta para ver o exemplar e registrar empréstimo ou devolução.
        </div>
      )}
    </div>
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
    async (nextOffset: number) => {
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
    [notify, overdueMode, search, status, tag],
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

  const load = useCallback(async (nextOffset: number) => {
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
  }, [notify, pathBookId, search, status]);

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

  const load = useCallback(async (nextOffset: number) => {
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
  }, [notify, search, turma]);

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
  const [importingDatabase, setImportingDatabase] = useState(false);

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

  const importDatabase = async (file: File | null) => {
    if (!file || importingDatabase) {
      return;
    }

    const confirmed = window.confirm(
      'Importar este banco vai substituir o acervo atual. Um backup do banco atual sera salvo antes da troca. Continuar?',
    );

    if (!confirmed) {
      return;
    }

    setImportingDatabase(true);
    try {
      await apiFetch<{ backupPath: string | null; databasePath: string; sizeBytes: number }>('/api/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/vnd.sqlite3' },
        body: await file.arrayBuffer(),
      });
      notify('success', 'Banco importado. Recarregando o acervo.');
      window.setTimeout(() => window.location.assign('/'), 700);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Não foi possível importar esse banco.');
    } finally {
      setImportingDatabase(false);
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
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/export/database" variant="primary"><FileDown size={16} />Exportar banco .db</LinkButton>
            <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-blue-500/60 px-3 text-sm font-medium text-blue-100 hover:bg-blue-500/15">
              <PackagePlus size={16} />
              {importingDatabase ? 'Importando banco' : 'Importar banco .db'}
              <input
                className="hidden"
                type="file"
                accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = '';
                  void importDatabase(file);
                }}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <LinkButton href="/export/books">Exportar livros</LinkButton>
            <LinkButton href="/export/users">Exportar leitores</LinkButton>
            <LinkButton href="/export/loans-history">Exportar histórico</LinkButton>
            <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-blue-500/60 px-3 text-sm font-medium text-blue-100 hover:bg-blue-500/15">
              Importar livros
              <input
                className="hidden"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = '';
                  void importJson('books', file);
                }}
              />
            </label>
            <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-blue-500/60 px-3 text-sm font-medium text-blue-100 hover:bg-blue-500/15">
              Importar leitores
              <input
                className="hidden"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = '';
                  void importJson('users', file);
                }}
              />
            </label>
          </div>
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
