import { useEffect, useRef } from 'react';

interface Props {
  prompt: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onTab: (v: string) => string;
  onUp: (v: string) => string;
  onDown: () => string;
  disabled?: boolean;
}

export default function TerminalInput({ prompt, value, onChange, onSubmit, onTab, onUp, onDown, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = value;
      onSubmit(v);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const completed = onTab(value);
      onChange(completed);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newVal = onUp(value);
      onChange(newVal);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newVal = onDown();
      onChange(newVal);
    } else if (e.key === '?') {
      e.preventDefault();
      onSubmit(value + '?');
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      onChange('');
      onSubmit('^C');
    } else if (e.key === 'z' && e.ctrlKey) {
      e.preventDefault();
      onChange('');
      onSubmit('end');
    }
  };

  return (
    <div className="terminal-input-row" onClick={() => inputRef.current?.focus()}>
      <span className="terminal-prompt">{prompt}</span>
      <input
        ref={inputRef}
        type="text"
        className="terminal-input-field"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
