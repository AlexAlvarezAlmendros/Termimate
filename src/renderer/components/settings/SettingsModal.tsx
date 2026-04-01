import { useState, useEffect } from 'react';
import { TERMINAL_THEMES } from '../../config/terminalThemes';

const SHELL_OPTIONS = [
  { label: 'PowerShell (Windows)', value: 'powershell.exe' },
  { label: 'PowerShell Core (pwsh)', value: 'pwsh.exe' },
  { label: 'Command Prompt', value: 'cmd.exe' },
  { label: 'Git Bash', value: 'bash.exe' },
  { label: 'Bash', value: '/bin/bash' },
  { label: 'Zsh', value: '/bin/zsh' },
  { label: 'Fish', value: '/usr/bin/fish' },
];

const FONT_OPTIONS = [
  'Fira Code, monospace',
  'JetBrains Mono, monospace',
  'Cascadia Code, monospace',
  'Source Code Pro, monospace',
  'Consolas, monospace',
  'Monaco, monospace',
  'monospace',
];

type Section = 'keys' | 'terminal' | 'appearance' | 'about';

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: 'keys',
    label: 'API Keys',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
      </svg>
    ),
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
  },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('keys');

  // API Keys state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [savedAnthropic, setSavedAnthropic] = useState(false);
  const [savedOpenai, setSavedOpenai] = useState(false);
  const [savedGemini, setSavedGemini] = useState(false);

  // Terminal state
  const [defaultShell, setDefaultShell] = useState('powershell.exe');
  const [customShell, setCustomShell] = useState('');
  const [scrollback, setScrollback] = useState(5000);
  const [bufferLines, setBufferLines] = useState(200);
  const [savedTerminal, setSavedTerminal] = useState(false);

  // Appearance state
  const [fontFamily, setFontFamily] = useState('Fira Code, monospace');
  const [fontSize, setFontSize] = useState(14);
  const [terminalTheme, setTerminalTheme] = useState('termimate-dark');
  const [cursorStyle, setCursorStyle] = useState<'block' | 'underline' | 'bar'>('block');
  const [cursorBlink, setCursorBlink] = useState(true);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [savedAppearance, setSavedAppearance] = useState(false);

  const isCustomShell = !SHELL_OPTIONS.some((s) => s.value === defaultShell);

  useEffect(() => {
    if (!isOpen || !window.electronAPI) return;
    async function load() {
      const [ak, ok, gk, cfg] = await Promise.all([
        window.electronAPI.config.getApiKey('anthropic'),
        window.electronAPI.config.getApiKey('openai'),
        window.electronAPI.config.getApiKey('gemini'),
        window.electronAPI.config.get(),
      ]);
      if (ak) { setAnthropicKey(ak); setSavedAnthropic(true); }
      if (ok) { setOpenaiKey(ok); setSavedOpenai(true); }
      if (gk) { setGeminiKey(gk); setSavedGemini(true); }
      const shell = cfg.terminal.defaultShell;
      if (SHELL_OPTIONS.some((s) => s.value === shell)) {
        setDefaultShell(shell);
      } else {
        setDefaultShell('__custom__');
        setCustomShell(shell);
      }
      setScrollback(cfg.terminal?.scrollback ?? 5000);
      setBufferLines(cfg.agent?.outputBufferLines ?? 200);
      setSavedTerminal(true);
      setFontFamily(cfg.appearance?.terminalFontFamily ?? 'Fira Code, monospace');
      setFontSize(cfg.appearance?.terminalFontSize ?? 14);
      setTerminalTheme(cfg.appearance?.terminalTheme ?? 'termimate-dark');
      setCursorStyle(cfg.appearance?.cursorStyle ?? 'block');
      setCursorBlink(cfg.appearance?.cursorBlink ?? true);
      setLineHeight(cfg.appearance?.lineHeight ?? 1.2);
      setLetterSpacing(cfg.appearance?.letterSpacing ?? 0);
      setSavedAppearance(true);
    }
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const maskKey = (key: string) => key.length <= 8 ? key : key.slice(0, 4) + '...' + key.slice(-4);

  const handleSaveAnthropic = async () => {
    if (!window.electronAPI || !anthropicKey.trim()) return;
    await window.electronAPI.config.setApiKey('anthropic', anthropicKey.trim());
    setSavedAnthropic(true);
  };
  const handleSaveOpenai = async () => {
    if (!window.electronAPI || !openaiKey.trim()) return;
    await window.electronAPI.config.setApiKey('openai', openaiKey.trim());
    setSavedOpenai(true);
  };
  const handleSaveGemini = async () => {
    if (!window.electronAPI || !geminiKey.trim()) return;
    await window.electronAPI.config.setApiKey('gemini', geminiKey.trim());
    setSavedGemini(true);
  };

  const handleSaveTerminal = async () => {
    if (!window.electronAPI) return;
    const shell = defaultShell === '__custom__' ? customShell.trim() : defaultShell;
    if (!shell) return;
    await window.electronAPI.config.set({
      terminal: { defaultShell: shell, scrollback },
      agent: { defaultProviderId: '', outputBufferLines: bufferLines },
    });
    setSavedTerminal(true);
  };

  const handleSaveAppearance = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.config.set({
      appearance: {
        theme: 'dark',
        terminalFontFamily: fontFamily,
        terminalFontSize: fontSize,
        terminalTheme,
        cursorStyle,
        cursorBlink,
        lineHeight,
        letterSpacing,
      },
    });
    setSavedAppearance(true);
    window.dispatchEvent(new CustomEvent('termimate:configUpdated'));
  };

  const renderKeys = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-on-surface mb-1">API Keys</h3>
        <p className="text-xs text-outline/70">Keys are stored encrypted locally. Never shared with third parties.</p>
      </div>
      {[
        { label: 'Anthropic', placeholder: 'sk-ant-...', value: anthropicKey, set: setAnthropicKey, saved: savedAnthropic, setSaved: setSavedAnthropic, onSave: handleSaveAnthropic },
        { label: 'OpenAI', placeholder: 'sk-...', value: openaiKey, set: setOpenaiKey, saved: savedOpenai, setSaved: setSavedOpenai, onSave: handleSaveOpenai },
        { label: 'Google Gemini', placeholder: 'AIza...', value: geminiKey, set: setGeminiKey, saved: savedGemini, setSaved: setSavedGemini, onSave: handleSaveGemini },
      ].map(({ label, placeholder, value, set, saved, setSaved, onSave }) => (
        <div key={label}>
          <label className="block text-xs font-medium text-outline mb-1.5">{label}</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => { set(e.target.value); setSaved(false); }}
              placeholder={placeholder}
              className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/30 focus:ring-1 focus:ring-primary/50 focus:outline-none"
            />
            <button
              onClick={onSave}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${saved ? 'bg-secondary/20 text-secondary' : 'bg-primary text-on-primary hover:brightness-110'}`}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          {saved && value && <p className="text-[10px] text-outline/50 mt-1">Active: {maskKey(value)}</p>}
        </div>
      ))}
    </div>
  );

  const renderTerminal = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-on-surface mb-1">Terminal</h3>
        <p className="text-xs text-outline/70">Shell and buffer configuration.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-outline mb-1.5">Default Shell</label>
        <select
          value={defaultShell}
          onChange={(e) => { setDefaultShell(e.target.value); setSavedTerminal(false); }}
          className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
        >
          {SHELL_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
          <option value="__custom__">Custom path...</option>
        </select>
        {defaultShell === '__custom__' && (
          <input
            type="text"
            value={customShell}
            onChange={(e) => { setCustomShell(e.target.value); setSavedTerminal(false); }}
            placeholder="/usr/bin/fish or C:\custom\shell.exe"
            className="mt-2 w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/30 font-mono focus:ring-1 focus:ring-primary/50 focus:outline-none"
          />
        )}
        {savedTerminal && !isCustomShell && (
          <p className="text-[10px] text-outline/50 mt-1">
            Active: {SHELL_OPTIONS.find((s) => s.value === defaultShell)?.label ?? defaultShell}
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-outline mb-1.5">
          Scrollback Buffer — <span className="text-primary">{scrollback.toLocaleString()} lines</span>
        </label>
        <input
          type="range" min={1000} max={100000} step={1000} value={scrollback}
          onChange={(e) => { setScrollback(Number(e.target.value)); setSavedTerminal(false); }}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-outline/40 mt-0.5"><span>1 000</span><span>100 000</span></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-outline mb-1.5">
          Agent Read Buffer — <span className="text-primary">{bufferLines} lines</span>
        </label>
        <input
          type="range" min={50} max={1000} step={50} value={bufferLines}
          onChange={(e) => { setBufferLines(Number(e.target.value)); setSavedTerminal(false); }}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-outline/40 mt-0.5"><span>50</span><span>1 000</span></div>
        <p className="text-[10px] text-outline/40 mt-1">How many recent terminal lines the AI agent can see.</p>
      </div>
      <button
        onClick={handleSaveTerminal}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${savedTerminal ? 'bg-secondary/20 text-secondary' : 'bg-primary text-on-primary hover:brightness-110'}`}
      >
        {savedTerminal ? '✓ Saved' : 'Save Terminal'}
      </button>
    </div>
  );

  const renderAppearance = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-on-surface mb-1">Appearance</h3>
        <p className="text-xs text-outline/70">Terminal theme, font and cursor settings.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-outline mb-2">Color Theme</label>
        <div className="grid grid-cols-2 gap-2">
          {TERMINAL_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTerminalTheme(t.id); setSavedAppearance(false); }}
              className="text-left rounded-lg p-2.5 border transition-all"
              style={{
                background: t.xterm.background as string,
                borderColor: terminalTheme === t.id ? t.accent : 'rgba(255,255,255,0.07)',
                boxShadow: terminalTheme === t.id ? `0 0 0 1px ${t.accent}` : 'none',
              }}
            >
              <div className="flex gap-1 mb-1.5">
                {[t.xterm.red, t.xterm.green, t.xterm.yellow, t.xterm.blue, t.xterm.magenta, t.xterm.cyan].map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ background: c as string }} />
                ))}
              </div>
              <p className="text-xs font-semibold" style={{ color: t.xterm.foreground as string }}>{t.name}</p>
              <p className="text-[10px]" style={{ color: `${t.xterm.foreground as string}55` }}>{t.description}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-outline mb-1.5">Font Family</label>
          <select
            value={fontFamily}
            onChange={(e) => { setFontFamily(e.target.value); setSavedAppearance(false); }}
            className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f.split(',')[0]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-outline mb-1.5">Size — <span className="text-primary">{fontSize}px</span></label>
          <input
            type="range" min={10} max={24} value={fontSize}
            onChange={(e) => { setFontSize(Number(e.target.value)); setSavedAppearance(false); }}
            className="w-full accent-primary mt-2"
          />
          <div className="flex justify-between text-[10px] text-outline/40"><span>10</span><span>24</span></div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-outline mb-2">Cursor Style</label>
        <div className="flex gap-2">
          {(['block', 'underline', 'bar'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setCursorStyle(s); setSavedAppearance(false); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                cursorStyle === s
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-surface-container-highest border-outline-variant/20 text-outline hover:text-on-surface'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-on-surface">Blinking Cursor</p>
          <p className="text-[10px] text-outline/50">Animated cursor blink</p>
        </div>
        <button
          onClick={() => { setCursorBlink((v) => !v); setSavedAppearance(false); }}
          className={`relative w-10 h-5 rounded-full transition-colors ${cursorBlink ? 'bg-primary' : 'bg-outline/30'}`}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: cursorBlink ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-outline mb-1.5">Line Height — <span className="text-primary">{lineHeight.toFixed(1)}</span></label>
          <input
            type="range" min={1.0} max={2.0} step={0.1} value={lineHeight}
            onChange={(e) => { setLineHeight(Number(e.target.value)); setSavedAppearance(false); }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-outline/40"><span>1.0</span><span>2.0</span></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-outline mb-1.5">Letter Spacing — <span className="text-primary">{letterSpacing}px</span></label>
          <input
            type="range" min={-1} max={4} step={0.5} value={letterSpacing}
            onChange={(e) => { setLetterSpacing(Number(e.target.value)); setSavedAppearance(false); }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-outline/40"><span>-1px</span><span>4px</span></div>
        </div>
      </div>
      <button
        onClick={handleSaveAppearance}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${savedAppearance ? 'bg-secondary/20 text-secondary' : 'bg-primary text-on-primary hover:brightness-110'}`}
      >
        {savedAppearance ? '✓ Saved' : 'Save Appearance'}
      </button>
    </div>
  );

  const renderAbout = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-on-surface mb-1">About Termimate</h3>
        <p className="text-xs text-outline/70">Your AI-powered terminal companion.</p>
      </div>
      <div className="bg-surface-container rounded-xl border border-outline-variant/10 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Termimate</p>
            <p className="text-xs text-outline">AI Terminal Agent</p>
          </div>
        </div>
        <div className="border-t border-outline-variant/10 pt-3 space-y-1.5 text-xs text-outline/70 leading-relaxed">
          <p>API keys are stored encrypted on your machine using the OS keychain (safeStorage).</p>
          <p>They are only sent directly to the respective AI provider — never to any third-party server.</p>
          <p>All terminal sessions run locally via node-pty.</p>
        </div>
      </div>
    </div>
  );

  const sectionContent: Record<Section, React.ReactNode> = {
    keys: renderKeys(),
    terminal: renderTerminal(),
    appearance: renderAppearance(),
    about: renderAbout(),
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-high rounded-2xl border border-outline-variant/10 shadow-2xl flex overflow-hidden w-190 h-140">

        {/* Left sidebar */}
        <aside className="w-48 shrink-0 bg-surface-container border-r border-outline-variant/10 flex flex-col">
          <div className="px-4 py-4 border-b border-outline-variant/10">
            <p className="text-xs font-bold text-outline uppercase tracking-widest">Settings</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  activeSection === item.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-outline hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className={activeSection === item.id ? 'text-primary' : 'text-outline/60'}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-3">
            <p className="text-[10px] text-outline/30 text-center">Termimate</p>
          </div>
        </aside>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
            <div className="flex items-center gap-2 text-outline/60">
              {NAV_ITEMS.find((n) => n.id === activeSection)?.icon}
              <span className="text-sm font-semibold text-on-surface">
                {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-highest transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {sectionContent[activeSection]}
          </div>
        </div>

      </div>
    </div>
  );
}
