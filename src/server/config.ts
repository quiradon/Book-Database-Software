import fs from 'node:fs';
import path from 'node:path';

export interface ClassConfig {
  nome: string;
  value: string;
}

export interface AppConfig {
  max_per_user: number;
  tags: string[];
  turmas: ClassConfig[];
}

const DEFAULT_CONFIG: AppConfig = {
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

  return {
    max_per_user:
      typeof config.max_per_user === 'number' && config.max_per_user > 0
        ? config.max_per_user
        : DEFAULT_CONFIG.max_per_user,
    tags: Array.isArray(config.tags) ? config.tags : DEFAULT_CONFIG.tags,
    turmas: Array.isArray(config.turmas) ? config.turmas : DEFAULT_CONFIG.turmas,
  };
}
