import { useRef, useCallback, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

export function useTerminal(sessionId: string | null) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback(
    (container: HTMLElement) => {
      // Cleanup previous
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }

      if (!sessionId || !window.electronAPI) return;

      const terminal = new Terminal({
        theme: {
          background: '#0e0e0e',
          foreground: '#e5e2e1',
          cursor: '#98cbff',
          cursorAccent: '#0e0e0e',
          selectionBackground: 'rgba(152, 203, 255, 0.3)',
          black: '#131313',
          red: '#ffb4ab',
          green: '#5dff3b',
          yellow: '#ffba43',
          blue: '#98cbff',
          magenta: '#d19000',
          cyan: '#00a3ff',
          white: '#e5e2e1',
          brightBlack: '#3f4852',
          brightRed: '#ffdad6',
          brightGreen: '#79ff59',
          brightYellow: '#ffddaf',
          brightBlue: '#cfe5ff',
          brightMagenta: '#ffba43',
          brightCyan: '#98cbff',
          brightWhite: '#ffffff',
        },
        fontFamily: 'Fira Code, monospace',
        fontSize: 14,
        cursorBlink: true,
        allowProposedApi: true,
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

      // Connect to PTY via IPC
      const cols = terminal.cols;
      const rows = terminal.rows;

      window.electronAPI.pty.create({
        sessionId,
        shell: navigator.platform.startsWith('Win') ? 'powershell.exe' : '/bin/bash',
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

  return { attach, terminal: terminalRef.current };
}
