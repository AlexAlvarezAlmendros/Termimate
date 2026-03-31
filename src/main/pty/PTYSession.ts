import * as pty from 'node-pty';
import { homedir } from 'os';
import type { PTYConfig } from '../../shared/types/session.types';

type DataCallback = (data: string) => void;
type ExitCallback = (exitCode: number, signal?: number) => void;

export class PTYSession {
  private process: pty.IPty;
  private dataCallbacks: DataCallback[] = [];
  private exitCallbacks: ExitCallback[] = [];

  constructor(config: PTYConfig) {
    const cwd = !config.cwd || config.cwd === '~' ? homedir() : config.cwd;

    this.process = pty.spawn(config.shell, [], {
      name: 'xterm-256color',
      cols: config.cols,
      rows: config.rows,
      cwd,
      env: config.env as Record<string, string> | undefined,
    });

    this.process.onData((data) => {
      for (const cb of this.dataCallbacks) {
        cb(data);
      }
    });

    this.process.onExit(({ exitCode, signal }) => {
      for (const cb of this.exitCallbacks) {
        cb(exitCode, signal);
      }
    });
  }

  write(data: string): void {
    this.process.write(data);
  }

  resize(cols: number, rows: number): void {
    this.process.resize(cols, rows);
  }

  destroy(): void {
    this.process.kill();
  }

  onData(callback: DataCallback): void {
    this.dataCallbacks.push(callback);
  }

  onExit(callback: ExitCallback): void {
    this.exitCallbacks.push(callback);
  }

  get pid(): number {
    return this.process.pid;
  }
}
