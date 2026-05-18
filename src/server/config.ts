import fs from 'node:fs';
import path from 'node:path';

export interface ClassConfig {
  nome: string;
  value: string;
}

export interface AppConfig {
  library_name: string;
  logo_data_url: string;
  max_per_user: number;
  tags: string[];
  turmas: ClassConfig[];
}

const DEFAULT_CONFIG: AppConfig = {
  library_name: 'Arkanu Book DB',
  logo_data_url: '',
  max_per_user: 2,
  tags: [
    'Enem-Concursos',
    'Petrolina',
    'Direito',
    'Politica',
    'Meio Ambiente',
    'Diversos',
    'Dicionários',
    'Enciclopédias',
    'Sequenciais',
    'Contos',
    'Romance',
    'Infanto-Juvenil',
    'HQs',
    'Espiritualidade',
    'Poesia',
    'Empreendedorismo',
    'Cronica',
    'Educação',
    'Nutrição',
    'Ficção',
    'Informatica',
    'Literatura',
    'Cordel',
    'Biologia',
    'Historia',
    'Geografia',
    'Filosofia',
    'Sociologia',
    'Artes',
    'Matemática',
    'Física',
    'Química',
    'Espanhol',
    'Inglês',
    'Português',
    'Revistas',
    'Biografias',
    'Autoajuda',
    'Administração',
    'Potiguar',
    'Nordestino',
    'Acervo Secreto',
    'Norte Rio Grandense',
  ],
  turmas: [
    { nome: '1A - Nutrição', value: '1A-ND' },
    { nome: '1A - Meio Ambiente', value: '1A-MA' },
    { nome: '1B - Nutrição', value: '1B-ND' },
    { nome: '1B - Meio Ambiente', value: '1B-MA' },
    { nome: '2A - Nutrição', value: '2A-ND' },
    { nome: '2A - Meio Ambiente', value: '2A-MA' },
    { nome: '2B - Nutrição', value: '2B-ND' },
    { nome: '2B - Meio Ambiente', value: '2B-MA' },
    { nome: '3A - Nutrição', value: '3A-ND' },
    { nome: '3A - Meio Ambiente', value: '3A-MA' },
    { nome: '3B - Nutrição', value: '3B-ND' },
    { nome: '3B - Meio Ambiente', value: '3B-MA' },
  ],
};

function configPath(projectRoot: string): string {
  return path.join(projectRoot, 'configs.json');
}

export function ensureConfig(projectRoot: string): void {
  const target = configPath(projectRoot);
  const legacyConfig = path.join(projectRoot, 'config.json');

  if (fs.existsSync(target)) {
    return;
  }

  if (fs.existsSync(legacyConfig)) {
    fs.copyFileSync(legacyConfig, target);
    return;
  }

  fs.writeFileSync(target, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, {
    encoding: 'utf8',
  });
}

export function loadConfig(projectRoot: string): AppConfig {
  ensureConfig(projectRoot);
  const raw = fs.readFileSync(configPath(projectRoot), { encoding: 'utf8' });
  const config = JSON.parse(raw) as Partial<AppConfig>;

  return normalizeConfig(config);
}

export function saveConfig(projectRoot: string, input: Partial<AppConfig>): AppConfig {
  ensureConfig(projectRoot);
  const current = loadConfig(projectRoot);
  const next = normalizeConfig({
    ...current,
    ...input,
  });

  fs.writeFileSync(configPath(projectRoot), `${JSON.stringify(next, null, 2)}\n`, {
    encoding: 'utf8',
  });

  return next;
}

function normalizeConfig(config: Partial<AppConfig>): AppConfig {
  return {
    library_name: normalizeLibraryName(config.library_name),
    logo_data_url: normalizeLogoDataUrl(config.logo_data_url),
    max_per_user:
      typeof config.max_per_user === 'number' && config.max_per_user > 0
        ? config.max_per_user
        : DEFAULT_CONFIG.max_per_user,
    tags: normalizeTags(config.tags),
    turmas: normalizeClasses(config.turmas),
  };
}

function normalizeLibraryName(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_CONFIG.library_name;
  }

  const trimmed = value.trim();
  return trimmed || DEFAULT_CONFIG.library_name;
}

function normalizeLogoDataUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (!/^data:image\/(png|jpeg|jpg);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return '';
  }

  return trimmed.length <= 2_000_000 ? trimmed : '';
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return DEFAULT_CONFIG.tags;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }

    const value = tag.trim();
    const key = value.toLocaleLowerCase('pt-BR');

    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized.length > 0 ? normalized : DEFAULT_CONFIG.tags;
}

function normalizeClasses(classes: unknown): ClassConfig[] {
  if (!Array.isArray(classes)) {
    return DEFAULT_CONFIG.turmas;
  }

  const seen = new Set<string>();
  const normalized: ClassConfig[] = [];

  for (const item of classes) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const raw = item as Partial<ClassConfig>;
    const nome = typeof raw.nome === 'string' ? raw.nome.trim() : '';
    const preferredValue = typeof raw.value === 'string' ? raw.value.trim() : '';

    if (!nome) {
      continue;
    }

    let value = preferredValue || slugifyClassValue(nome);
    let suffix = 2;

    while (seen.has(value.toLocaleLowerCase('pt-BR'))) {
      value = `${preferredValue || slugifyClassValue(nome)}-${suffix}`;
      suffix += 1;
    }

    seen.add(value.toLocaleLowerCase('pt-BR'));
    normalized.push({ nome, value });
  }

  return normalized.length > 0 ? normalized : DEFAULT_CONFIG.turmas;
}

function slugifyClassValue(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();

  return slug || 'TURMA';
}
