import { useRef, useCallback, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { getTheme } from '../config/terminalThemes';
import '@xterm/xterm/css/xterm.css';

export function useTerminal(sessionId: string | null) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const accentColorRef = useRef<string>('#7c6af5');
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback(
    async (container: HTMLElement) => {
      // Cleanup previous
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }

      if (!sessionId || !window.electronAPI) return;

      const config = await window.electronAPI.config.get();
      const shell = config.terminal.defaultShell;

      const themeId = config.appearance?.terminalTheme ?? 'termimate-dark';
      const termTheme = getTheme(themeId);
      accentColorRef.current = termTheme.accent;

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

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Connect to PTY via IPC
      const cols = terminal.cols;
      const rows = terminal.rows;

      window.electronAPI.pty.create({
        sessionId,
        shell,
        cwd: '~',
        cols,
        rows,
      });

      // Terminal input → PTY
      const inputDisposable = terminal.onData((data) => {
        window.electronAPI.pty.write(sessionId, data);
      });

      // PTY output → Terminal
      const removeDataListener = window.electronAPI.pty.onData((sid, data) => {
        if (sid === sessionId) {
          terminal.write(data);
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        window.electronAPI.pty.resize(sessionId, terminal.cols, terminal.rows);
      });
      resizeObserver.observe(container);

      cleanupRef.current = () => {
        inputDisposable.dispose();
        removeDataListener();
        resizeObserver.disconnect();
      };
    },
    [sessionId],
  );

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (terminalRef.current) terminalRef.current.dispose();
    };
  }, []);

  return {
    attach,
    terminal: terminalRef.current,
    searchAddon: searchAddonRef.current,
    accentColor: accentColorRef.current,
  };
}


  const attach = useCallback(
    async (container: HTMLElement) => {

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (terminalRef.current) terminalRef.current.dispose();
    };
  }, []);

  return { attach, terminal: terminalRef.current, searchAddon: searchAddonRef.current };
}
