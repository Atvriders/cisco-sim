import { useEffect, useRef, useState, MutableRefObject } from 'react';
import type { CliMode } from '../sim/types';

interface Props {
  prompt: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onTab: (v: string) => string;
  onUp: (v: string) => string;
  onDown: () => string;
  disabled?: boolean;
  onFocusRef?: MutableRefObject<(() => void) | null>;
  mode?: CliMode;
}

export default function TerminalInput({ prompt, value, onChange, onSubmit, onTab, onUp, onDown, disabled, onFocusRef, mode }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  // Expose focus trigger to parent
  useEffect(() => {
    if (onFocusRef) {
      onFocusRef.current = () => {
        if (!disabled) {
          inputRef.current?.focus();
        }
      };
    }
  }, [onFocusRef, disabled]);

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
      // Show the ? appended then submit immediately - real Cisco behavior
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

  // Determine if in config mode (amber) or exec mode (green)
  const isConfigMode = mode && mode !== 'user-exec' && mode !== 'priv-exec';
  const rowClassName = [
    'terminal-input-row',
    isFocused ? 'focused' : '',
    isConfigMode ? 'config-mode' : '',
  ].filter(Boolean).join(' ');

  const promptClassName = [
    'terminal-prompt',
    isConfigMode ? 'config-mode' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rowClassName}
      onClick={() => inputRef.current?.focus()}
    >
      <span className={promptClassName}>{prompt}</span>
      <div className="terminal-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="terminal-input-field"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {isFocused && !disabled && <span className="block-cursor">▋</span>}
      </div>
    </div>
  );
}
