import { useState, useEffect } from 'react';

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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [savedAnthropic, setSavedAnthropic] = useState(false);
  const [savedOpenai, setSavedOpenai] = useState(false);
  const [savedGemini, setSavedGemini] = useState(false);
  const [defaultShell, setDefaultShell] = useState('powershell.exe');
  const [customShell, setCustomShell] = useState('');
  const [savedShell, setSavedShell] = useState(false);
  const [fontFamily, setFontFamily] = useState('Fira Code, monospace');
  const [fontSize, setFontSize] = useState(14);
  const [scrollback, setScrollback] = useState(5000);
  const [bufferLines, setBufferLines] = useState(200);
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
      setSavedShell(true);
      setFontFamily(cfg.appearance?.terminalFontFamily ?? 'Fira Code, monospace');
      setFontSize(cfg.appearance?.terminalFontSize ?? 14);
      setScrollback(cfg.terminal?.scrollback ?? 5000);
      setBufferLines(cfg.agent?.outputBufferLines ?? 200);
      setSavedAppearance(true);
    }

    load();
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleSaveShell = async () => {
    if (!window.electronAPI) return;
    const shell = defaultShell === '__custom__' ? customShell.trim() : defaultShell;
    if (!shell) return;
    await window.electronAPI.config.set({ terminal: { defaultShell: shell, scrollback } });
    setSavedShell(true);
  };

  const handleSaveAppearance = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.config.set({
      appearance: { theme: 'dark', terminalFontFamily: fontFamily, terminalFontSize: fontSize },
      terminal: {
        defaultShell: defaultShell === '__custom__' ? customShell.trim() : defaultShell,
        scrollback,
      },
      agent: { defaultProviderId: '', outputBufferLines: bufferLines },
    });
    setSavedAppearance(true);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.slice(0, 4) + '...' + key.slice(-4);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-surface-container-high rounded-xl border border-outline-variant/10 w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <h2 className="text-lg font-headline font-bold text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface transition-colors text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* API Keys */}
          <section>
            <h3 className="text-sm font-headline font-bold text-on-surface mb-3 uppercase tracking-wider">
              API Keys
            </h3>

            {/* Anthropic */}
            <div className="mb-4">
              <label className="block text-xs text-outline mb-1">Anthropic API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => {
                    setAnthropicKey(e.target.value);
                    setSavedAnthropic(false);
                  }}
                  placeholder="sk-ant-..."
                  className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                <button
                  onClick={handleSaveAnthropic}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    savedAnthropic
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-primary text-on-primary hover:brightness-110'
                  }`}
                >
                  {savedAnthropic ? 'Saved' : 'Save'}
                </button>
              </div>
              {savedAnthropic && anthropicKey && (
                <p className="text-[10px] text-outline mt-1">
                  Current: {maskKey(anthropicKey)}
                </p>
              )}
            </div>

            {/* OpenAI */}
            <div className="mb-4">
              <label className="block text-xs text-outline mb-1">OpenAI API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => {
                    setOpenaiKey(e.target.value);
                    setSavedOpenai(false);
                  }}
                  placeholder="sk-..."
                  className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                <button
                  onClick={handleSaveOpenai}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    savedOpenai
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-primary text-on-primary hover:brightness-110'
                  }`}
                >
                  {savedOpenai ? 'Saved' : 'Save'}
                </button>
              </div>
              {savedOpenai && openaiKey && (
                <p className="text-[10px] text-outline mt-1">
                  Current: {maskKey(openaiKey)}
                </p>
              )}
            </div>

            {/* Gemini */}
            <div>
              <label className="block text-xs text-outline mb-1">Google Gemini API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => { setGeminiKey(e.target.value); setSavedGemini(false); }}
                  placeholder="AIza..."
                  className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                <button
                  onClick={handleSaveGemini}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    savedGemini
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-primary text-on-primary hover:brightness-110'
                  }`}
                >
                  {savedGemini ? 'Saved' : 'Save'}
                </button>
              </div>
              {savedGemini && geminiKey && (
                <p className="text-[10px] text-outline mt-1">
                  Current: {maskKey(geminiKey)}
                </p>
              )}
            </div>
          </section>

          {/* Terminal */}
          <section>
            <h3 className="text-sm font-headline font-bold text-on-surface mb-3 uppercase tracking-wider">
              Terminal
            </h3>
            <div>
              <label className="block text-xs text-outline mb-1">Default Shell</label>
              <div className="flex gap-2">
                <select
                  value={defaultShell}
                  onChange={(e) => { setDefaultShell(e.target.value); setSavedShell(false); }}
                  className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
                >
                  {SHELL_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                  <option value="__custom__">Custom path...</option>
                </select>
                {defaultShell !== '__custom__' && (
                  <button
                    onClick={handleSaveShell}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      savedShell
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-primary text-on-primary hover:brightness-110'
                    }`}
                  >
                    {savedShell ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
              {defaultShell === '__custom__' && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customShell}
                    onChange={(e) => { setCustomShell(e.target.value); setSavedShell(false); }}
                    placeholder="/usr/bin/fish or C:\custom\shell.exe"
                    className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/50 focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleSaveShell}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      savedShell
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-primary text-on-primary hover:brightness-110'
                    }`}
                  >
                    {savedShell ? 'Saved' : 'Save'}
                  </button>
                </div>
              )}
              {savedShell && !isCustomShell && (
                <p className="text-[10px] text-outline mt-1">
                  Active: {SHELL_OPTIONS.find((s) => s.value === defaultShell)?.label ?? defaultShell}
                </p>
              )}
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h3 className="text-sm font-headline font-bold text-on-surface mb-3 uppercase tracking-wider">
              Appearance
            </h3>

            {/* Font Family */}
            <div className="mb-4">
              <label className="block text-xs text-outline mb-1">Terminal Font</label>
              <select
                value={fontFamily}
                onChange={(e) => { setFontFamily(e.target.value); setSavedAppearance(false); }}
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0]}</option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div className="mb-4">
              <label className="block text-xs text-outline mb-1">Font Size: {fontSize}px</label>
              <input
                type="range"
                min={10}
                max={24}
                value={fontSize}
                onChange={(e) => { setFontSize(Number(e.target.value)); setSavedAppearance(false); }}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-outline/40">
                <span>10px</span>
                <span>24px</span>
              </div>
            </div>

            {/* Scrollback */}
            <div className="mb-4">
              <label className="block text-xs text-outline mb-1">Scrollback Buffer Lines</label>
              <input
                type="number"
                min={1000}
                max={100000}
                step={1000}
                value={scrollback}
                onChange={(e) => { setScrollback(Number(e.target.value)); setSavedAppearance(false); }}
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
              />
              <p className="text-[10px] text-outline/50 mt-1">Number of lines to keep in terminal buffer (1000-100000)</p>
            </div>

            {/* Agent Buffer Lines */}
            <div className="mb-4">
              <label className="block text-xs text-outline mb-1">Agent Output Buffer Lines</label>
              <input
                type="number"
                min={50}
                max={1000}
                step={50}
                value={bufferLines}
                onChange={(e) => { setBufferLines(Number(e.target.value)); setSavedAppearance(false); }}
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
              />
              <p className="text-[10px] text-outline/50 mt-1">Terminal output lines the AI agent can read (50-1000)</p>
            </div>

            <button
              onClick={handleSaveAppearance}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                savedAppearance
                  ? 'bg-secondary/20 text-secondary'
                  : 'bg-primary text-on-primary hover:brightness-110'
              }`}
            >
              {savedAppearance ? 'Saved' : 'Save Appearance'}
            </button>
          </section>

          {/* Info */}
          <section className="bg-surface-container rounded-lg p-4 border border-outline-variant/5">
            <p className="text-xs text-outline leading-relaxed">
              API keys are stored encrypted locally on your machine. They are never sent to any
              third-party service other than the respective AI provider.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
