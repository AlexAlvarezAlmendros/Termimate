import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [savedAnthropic, setSavedAnthropic] = useState(false);
  const [savedOpenai, setSavedOpenai] = useState(false);

  useEffect(() => {
    if (!isOpen || !window.electronAPI) return;

    async function loadKeys() {
      const ak = await window.electronAPI.config.getApiKey('anthropic');
      const ok = await window.electronAPI.config.getApiKey('openai');
      if (ak) {
        setAnthropicKey(ak);
        setSavedAnthropic(true);
      }
      if (ok) {
        setOpenaiKey(ok);
        setSavedOpenai(true);
      }
    }

    loadKeys();
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
            <div>
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
