import { useRef, useCallback, useEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { getTheme } from '../config/terminalThemes';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  container: HTMLElement;
  cleanup: () => void;
}

/**
 * Manages one xterm Terminal instance per session.
 * Instances are created once and kept alive across tab switches so PTY
 * processes and their scrollback history are never lost when switching tabs.
 * On app restart, saved scrollback is replayed from the database before
 * connecting the fresh PTY process.
 */
export function useTerminalManager() {
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map());
  const [accentColor, setAccentColor] = useState<string>('#7c6af5');
  const [bgColor, setBgColor] = useState<string>('#0d0d0f');

  const focusSession = useCallback((sessionId: string) => {
    const inst = instancesRef.current.get(sessionId);
    if (!inst) return;
    inst.fitAddon.fit();
    inst.terminal.focus();
    window.electronAPI?.pty.resize(sessionId, inst.terminal.cols, inst.terminal.rows);
  }, []);

  const initSession = useCallback(
    async (sessionId: string, container: HTMLElement) => {
      // Already initialized — just refocus
      if (instancesRef.current.has(sessionId)) {
        focusSession(sessionId);
        return;
      }

      if (!window.electronAPI) return;

      const config = await window.electronAPI.config.get();
      const shell = config.terminal.defaultShell;

      const themeId = config.appearance?.terminalTheme ?? 'termimate-dark';
      const termTheme = getTheme(themeId);
      setAccentColor(termTheme.accent);
      setBgColor(termTheme.xterm.background as string);
      container.style.background = termTheme.xterm.background as string;

      const terminal = new Terminal({
        theme: termTheme.xterm,
        fontFamily: config.appearance?.terminalFontFamily ?? 'Fira Code, monospace',
        fontSize: config.appearance?.terminalFontSize ?? 14,
        lineHeight: config.appearance?.lineHeight ?? 1.2,
        letterSpacing: config.appearance?.letterSpacing ?? 0,
        cursorBlink: config.appearance?.cursorBlink ?? true,
        cursorStyle: (config.appearance?.cursorStyle as 'block' | 'underline' | 'bar') ?? 'block',
        scrollback: config.terminal?.scrollback ?? 5000,
        allowProposedApi: true,
        macOptionIsMeta: true,
        rightClickSelectsWord: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);

      terminal.open(container);
      fitAddon.fit();

      // Replay persisted scrollback from previous session (app restart)
      const savedScrollback = await window.electronAPI.pty.getScrollback(sessionId);
      if (savedScrollback) {
        terminal.write(savedScrollback);

        // xterm processes writes asynchronously; wait a tick so the buffer is settled.
        await new Promise<void>((r) => setTimeout(r, 0));

        // Scan the visible viewport from the bottom to find the last row that
        // actually has content.  The raw byte stream often leaves the cursor at
        // an arbitrary position (e.g. \x1b[5;1H) that is well above the last
        // visible content, creating a large empty gap before the new prompt.
        const buf = terminal.buffer.active;
        let lastContentRow = -1;
        for (let y = terminal.rows - 1; y >= 0; y--) {
          const line = buf.getLine(buf.baseY + y);
          if (line && line.translateToString(true).trim().length > 0) {
            lastContentRow = y;
            break;
          }
        }

        if (lastContentRow >= 0 && lastContentRow < terminal.rows - 1) {
          // Jump cursor to the line immediately after the last content so
          // the new shell prompt has no empty-row gap above it.
          terminal.write(`\x1b[${lastContentRow + 2};1H`);
        }

        terminal.write('\r\n');
      }

      // Spawn the PTY process and wait for it to be ready before attaching listeners
      await window.electronAPI.pty.create({
        sessionId,
        shell,
        cwd: '~',
        cols: terminal.cols,
        rows: terminal.rows,
      });

      // Terminal input → PTY
      const inputDisposable = terminal.onData((data) => {
        window.electronAPI.pty.write(sessionId, data);
      });

      // PTY output → terminal (each session registers its own listener)
      const removeDataListener = window.electronAPI.pty.onData((sid, data) => {
        if (sid === sessionId) {
          terminal.write(data);
        }
      });

      // Auto-resize when the container changes size
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        window.electronAPI?.pty.resize(sessionId, terminal.cols, terminal.rows);
      });
      resizeObserver.observe(container);

      instancesRef.current.set(sessionId, {
        terminal,
        fitAddon,
        searchAddon,
        container,
        cleanup: () => {
          inputDisposable.dispose();
          removeDataListener();
          resizeObserver.disconnect();
          terminal.dispose();
        },
      });

      terminal.focus();
    },
    [focusSession],
  );

  const destroySession = useCallback((sessionId: string) => {
    const inst = instancesRef.current.get(sessionId);
    if (inst) {
      inst.cleanup();
      instancesRef.current.delete(sessionId);
    }
  }, []);

  const getSearchAddon = useCallback((sessionId: string | null): SearchAddon | null => {
    if (!sessionId) return null;
    return instancesRef.current.get(sessionId)?.searchAddon ?? null;
  }, []);

  // Re-apply appearance settings for all open terminals when the user saves Settings
  useEffect(() => {
    const handleConfigUpdate = async () => {
      if (!window.electronAPI) return;
      const config = await window.electronAPI.config.get();
      const themeId = config.appearance?.terminalTheme ?? 'termimate-dark';
      const termTheme = getTheme(themeId);
      setAccentColor(termTheme.accent);
      setBgColor(termTheme.xterm.background as string);

      for (const [, inst] of instancesRef.current) {
        inst.container.style.background = termTheme.xterm.background as string;
        inst.terminal.options.theme = termTheme.xterm;
        inst.terminal.options.fontFamily =
          config.appearance?.terminalFontFamily ?? 'Fira Code, monospace';
        inst.terminal.options.fontSize = config.appearance?.terminalFontSize ?? 14;
        inst.terminal.options.lineHeight = config.appearance?.lineHeight ?? 1.2;
        inst.terminal.options.letterSpacing = config.appearance?.letterSpacing ?? 0;
        inst.terminal.options.cursorBlink = config.appearance?.cursorBlink ?? true;
        inst.terminal.options.cursorStyle =
          (config.appearance?.cursorStyle as 'block' | 'underline' | 'bar') ?? 'block';
        inst.fitAddon.fit();
      }
    };
    window.addEventListener('termimate:configUpdated', handleConfigUpdate);
    return () => window.removeEventListener('termimate:configUpdated', handleConfigUpdate);
  }, []);

  // Dispose everything on unmount
  useEffect(() => {
    return () => {
      for (const [, inst] of instancesRef.current) {
        inst.cleanup();
      }
      instancesRef.current.clear();
    };
  }, []);

  const copyContent = useCallback((sessionId: string | null): boolean => {
    if (!sessionId) return false;
    const inst = instancesRef.current.get(sessionId);
    if (!inst) return false;
    const buf = inst.terminal.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buf.length; i++) {
      lines.push(buf.getLine(i)?.translateToString(false) ?? '');
    }
    // Strip trailing empty lines
    let end = lines.length;
    while (end > 0 && lines[end - 1].trim() === '') end--;
    navigator.clipboard.writeText(lines.slice(0, end).join('\n'));
    return true;
  }, []);

  return { initSession, focusSession, destroySession, getSearchAddon, copyContent, accentColor, bgColor };
}
