import type { SessionState } from '../sim/types';

interface Props {
  sessions: SessionState[];
  activeId: number;
  onSwitch: (id: number) => void;
  onNew: () => void;
  onClose: (id: number) => void;
}

function sessionLabel(index: number): string {
  if (index === 0) return 'CON 0';
  return `VTY ${index - 1}`;
}

export default function TabBar({ sessions, activeId, onSwitch, onNew, onClose }: Props) {
  return (
    <div className="tab-bar">
      {sessions.map((session, index) => {
        const isActive = session.id === activeId;
        const hasUnsaved = session.deviceState.unsavedChanges;
        const label = sessionLabel(index);
        return (
          <button
            key={session.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
          >
            <span className={`tab-indicator-dot ${isActive ? 'active' : ''}`} />
            {label}
            {hasUnsaved && <span className="tab-unsaved-dot" title="Unsaved changes">•</span>}
            {sessions.length > 1 && (
              <button
                className="tab-close"
                onClick={e => { e.stopPropagation(); onClose(session.id); }}
                title="Close"
              >×</button>
            )}
          </button>
        );
      })}
      {sessions.length < 5 && (
        <button className="tab-new" onClick={onNew} title="New Session">+</button>
      )}
    </div>
  );
}
