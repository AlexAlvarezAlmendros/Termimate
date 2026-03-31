interface TerminalTabProps {
  name: string;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export function TerminalTab({ name, isActive, onClick, onClose }: TerminalTabProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-surface-container-high text-primary'
          : 'text-outline hover:bg-surface-container-high/50'
      }`}
    >
      <span className="text-xs font-mono">{name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="text-outline/50 hover:text-error text-xs ml-1"
      >
        x
      </button>
    </div>
  );
}
