import crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import QRCode from 'qrcode';

const SESSION_TTL_MS = 14 * 60 * 60 * 1000;
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export interface MobileAccessSession {
  active: true;
  provider: 'cloudflared';
  publicUrl: string;
  mobileUrl: string;
  qrCodeDataUrl: string;
  token: string;
  startedAt: number;
  expiresAt: number;
}

export interface MobileAccessStatus {
  active: boolean;
  provider: 'cloudflared';
  publicUrl: string | null;
  mobileUrl: string | null;
  qrCodeDataUrl: string | null;
  startedAt: number | null;
  expiresAt: number | null;
}

export class MobileAccessService {
  private tunnelProcess: ChildProcessWithoutNullStreams | null = null;
  private session: MobileAccessSession | null = null;

  constructor(private readonly port: number) {}

  async start(): Promise<MobileAccessSession> {
    const current = this.getActiveSession();
    if (current) {
      return current;
    }

    await this.stop();

    const token = crypto.randomBytes(32).toString('hex');
    const tunnelProcess = spawn('cloudflared', [
      'tunnel',
      '--url',
      `http://localhost:${this.port}`,
      '--no-autoupdate',
    ], {
      windowsHide: true,
    });

    this.tunnelProcess = tunnelProcess;

    const publicUrl = await waitForTunnelUrl(tunnelProcess);
    const mobileUrl = `${publicUrl}/mobile?token=${encodeURIComponent(token)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(mobileUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
    });
    const startedAt = Date.now();

    this.session = {
      active: true,
      provider: 'cloudflared',
      publicUrl,
      mobileUrl,
      qrCodeDataUrl,
      token,
      startedAt,
      expiresAt: startedAt + SESSION_TTL_MS,
    };

    tunnelProcess.once('exit', () => {
      if (this.tunnelProcess === tunnelProcess) {
        this.tunnelProcess = null;
        this.session = null;
      }
    });

    return this.session;
  }

  async stop(): Promise<void> {
    const tunnelProcess = this.tunnelProcess;
    this.tunnelProcess = null;
    this.session = null;

    if (!tunnelProcess) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!tunnelProcess.killed) {
          tunnelProcess.kill('SIGKILL');
        }
        resolve();
      }, 1500);

      tunnelProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      tunnelProcess.kill();
    });
  }

  status(): MobileAccessStatus {
    const session = this.getActiveSession();

    return {
      active: Boolean(session),
      provider: 'cloudflared',
      publicUrl: session?.publicUrl ?? null,
      mobileUrl: session?.mobileUrl ?? null,
      qrCodeDataUrl: session?.qrCodeDataUrl ?? null,
      startedAt: session?.startedAt ?? null,
      expiresAt: session?.expiresAt ?? null,
    };
  }

  validateToken(token: string | undefined): boolean {
    const session = this.getActiveSession();
    if (!session || !token || session.token.length !== token.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(session.token), Buffer.from(token));
  }

  isTunnelHost(hostHeader: string | string[] | undefined): boolean {
    const session = this.session;
    if (!session || !hostHeader || Array.isArray(hostHeader)) {
      return false;
    }

    try {
      const matches = normalizeHost(hostHeader) === normalizeHost(new URL(session.publicUrl).host);
      if (matches && session.expiresAt <= Date.now()) {
        void this.stop();
      }

      return matches;
    } catch (_error) {
      return false;
    }
  }

  isAllowedTunnelPath(pathname: string): boolean {
    return (
      pathname === '/mobile'
      || pathname.startsWith('/api/mobile/')
      || pathname.startsWith('/ui/')
      || pathname.startsWith('/assets/')
    );
  }

  private getActiveSession(): MobileAccessSession | null {
    if (!this.session) {
      return null;
    }

    if (this.session.expiresAt <= Date.now()) {
      void this.stop();
      return null;
    }

    return this.session;
  }
}

function waitForTunnelUrl(tunnelProcess: ChildProcessWithoutNullStreams): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      cleanup();
      tunnelProcess.kill();
      reject(new Error('Tempo esgotado ao iniciar o túnel Cloudflare.'));
    }, 30000);

    const onData = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      const match = output.match(TUNNEL_URL_PATTERN);
      if (match) {
        cleanup();
        resolve(match[0]);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(new Error(`Não foi possível executar cloudflared: ${error.message}`));
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`cloudflared encerrou antes de criar o túnel. Código: ${code ?? 'desconhecido'}`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      tunnelProcess.stdout.off('data', onData);
      tunnelProcess.stderr.off('data', onData);
      tunnelProcess.off('error', onError);
      tunnelProcess.off('exit', onExit);
    };

    tunnelProcess.stdout.on('data', onData);
    tunnelProcess.stderr.on('data', onData);
    tunnelProcess.once('error', onError);
    tunnelProcess.once('exit', onExit);
  });
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '');
}
