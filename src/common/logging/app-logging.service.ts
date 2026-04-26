import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/** Lower number = more verbose (checked first). */
const LEVEL_WEIGHT: Record<string, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  warn: 3,
  error: 4,
};

const DEFAULT_LEVEL = 'log';
const DEFAULT_MAX_KB = 1024;

@Injectable()
export class AppLoggingService implements LoggerService {
  private readonly minWeight: number;
  private readonly isProd: boolean;
  private readonly logFilePath: string;
  private readonly maxBytes: number;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || DEFAULT_LEVEL).toLowerCase();
    this.minWeight = LEVEL_WEIGHT[envLevel] ?? LEVEL_WEIGHT[DEFAULT_LEVEL];
    this.isProd = process.env.NODE_ENV === 'production';
    const dir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.logFilePath = process.env.LOG_FILE || path.join(dir, 'app.log');
    const kb = Number(process.env.LOG_MAX_FILE_SIZE ?? DEFAULT_MAX_KB);
    this.maxBytes =
      Number.isFinite(kb) && kb > 0 ? Math.floor(kb) * 1024 : DEFAULT_MAX_KB * 1024;

    fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
  }

  private shouldEmit(method: keyof typeof LEVEL_WEIGHT): boolean {
    const w = LEVEL_WEIGHT[method];
    if (w === undefined) return true;
    return w >= this.minWeight;
  }

  private formatLine(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ): string {
    const context =
      optionalParams.length > 0 ? String(optionalParams[0]) : undefined;
    const rest = optionalParams.slice(1);

    if (this.isProd) {
      return (
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          message: typeof message === 'string' ? message : String(message),
          context: context ?? undefined,
          extra:
            rest.length > 0
              ? rest.map((x) =>
                  typeof x === 'object' ? x : String(x),
                )
              : undefined,
        }) + '\n'
      );
    }

    const ctx = context ? ` [${context}]` : '';
    const tail = rest.length ? ` ${rest.map(String).join(' ')}` : '';
    const msg =
      typeof message === 'object' && message !== null
        ? JSON.stringify(message)
        : String(message);
    return `${new Date().toISOString()} ${level.toUpperCase()}${ctx} ${msg}${tail}\n`;
  }

  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) return;
      const { size } = fs.statSync(this.logFilePath);
      if (size < this.maxBytes) return;

      const dir = path.dirname(this.logFilePath);
      const base = path.basename(this.logFilePath, path.extname(this.logFilePath));
      const ext = path.extname(this.logFilePath) || '.log';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotated = path.join(dir, `${base}-${stamp}${ext}`);
      fs.renameSync(this.logFilePath, rotated);
    } catch {
      // avoid throwing from logger
    }
  }

  private writeFile(line: string): void {
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.logFilePath, line, 'utf8');
    } catch {
      // avoid throwing from logger
    }
  }

  private emit(
    method: keyof typeof LEVEL_WEIGHT,
    message: unknown,
    ...optionalParams: unknown[]
  ): void {
    if (!this.shouldEmit(method)) return;

    let line: string;
    try {
      line = this.formatLine(method, message, optionalParams);
    } catch {
      line = `${new Date().toISOString()} ${method} <failed to format message>\n`;
    }
    const out =
      method === 'error' || method === 'warn' ? process.stderr : process.stdout;
    out.write(line);
    this.writeFile(line);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('log', message, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', message, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', message, ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('verbose', message, ...optionalParams);
  }
}
