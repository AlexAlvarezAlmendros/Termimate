import { useEffect, useState } from 'react';
import type { ConfirmRequest } from '../../../../shared/types/agent.types';

export function ConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    const remove = window.electronAPI.agent.onConfirmRequest((req) => {
      setRequest(req);
    });

    return remove;
  }, []);

  const respond = async (approved: boolean) => {
    if (!request || responding) return;
    setResponding(true);
    try {
      await window.electronAPI.agent.confirmResponse(request.requestId, approved);
    } finally {
      setRequest(null);
      setResponding(false);
    }
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/10 bg-error/5">
          <div className="w-8 h-8 rounded-full bg-error/15 flex items-center justify-center text-error flex-shrink-0">
            <WarningIcon />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Allow command execution?</p>
            <p className="text-xs text-outline">The AI wants to run the following command</p>
          </div>
        </div>

        {/* Command preview */}
        <div className="px-5 py-4">
          <pre className="font-mono text-sm text-on-surface bg-surface-container-high rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all border border-outline-variant/10">
            {request.command}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant/10">
          <button
            onClick={() => respond(false)}
            disabled={responding}
            className="px-5 py-2 text-sm font-semibold text-error border border-error/30 rounded-lg hover:bg-error/10 disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={() => respond(true)}
            disabled={responding}
            className="px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
