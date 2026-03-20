import { useEffect, useRef, useState, MutableRefObject } from 'react';
import type { CliMode } from '../sim/types';

interface Props {
  prompt: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onTab: (v: string) => string;
  onHelp: (v: string) => void;
  onUp: (v: string) => string;
  onDown: () => string;
  disabled?: boolean;
  onFocusRef?: MutableRefObject<(() => void) | null>;
  mode?: CliMode;
  commandHistory?: string[];
}

interface ReverseSearch {
  active: boolean;
  query: string;
  matchIndex: number;
}

export default function TerminalInput({ prompt, value, onChange, onSubmit, onTab, onHelp, onUp, onDown, disabled, onFocusRef, mode, commandHistory = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [reverseSearch, setReverseSearch] = useState<ReverseSearch>({ active: false, query: '', matchIndex: 0 });

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

  // Find reverse search matches (newest first = commandHistory[0] is most recent)
  const getReverseMatches = (query: string): string[] => {
    if (!query) return [];
    return commandHistory.filter(cmd => cmd.includes(query));
  };

  const currentMatch = reverseSearch.active
    ? getReverseMatches(reverseSearch.query)[reverseSearch.matchIndex] ?? ''
    : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+R: enter / cycle reverse search
    if (e.key === 'r' && e.ctrlKey) {
      e.preventDefault();
      if (!reverseSearch.active) {
        setReverseSearch({ active: true, query: '', matchIndex: 0 });
        onChange('');
      } else {
        // Cycle to next match
        const matches = getReverseMatches(reverseSearch.query);
        const nextIndex = reverseSearch.matchIndex + 1;
        if (nextIndex < matches.length) {
          setReverseSearch(prev => ({ ...prev, matchIndex: nextIndex }));
          onChange(matches[nextIndex]);
        }
      }
      return;
    }

    // Escape or Ctrl+C: cancel reverse search
    if (reverseSearch.active && (e.key === 'Escape' || (e.key === 'c' && e.ctrlKey))) {
      e.preventDefault();
      setReverseSearch({ active: false, query: '', matchIndex: 0 });
      onChange('');
      return;
    }

    // While in reverse search mode, handle input differently
    if (reverseSearch.active) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const match = currentMatch ?? '';
        setReverseSearch({ active: false, query: '', matchIndex: 0 });
        onChange('');
        if (match) {
          onSubmit(match);
        }
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        const newQuery = reverseSearch.query.slice(0, -1);
        const matches = getReverseMatches(newQuery);
        setReverseSearch({ active: true, query: newQuery, matchIndex: 0 });
        onChange(matches[0] ?? '');
        return;
      }
      // Printable character: append to query
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const newQuery = reverseSearch.query + e.key;
        const matches = getReverseMatches(newQuery);
        setReverseSearch({ active: true, query: newQuery, matchIndex: 0 });
        onChange(matches[0] ?? '');
        return;
      }
      return;
    }

    // Normal mode key handling
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
      // Show help without submitting — input stays intact
      onHelp(value);
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      onChange('');
      onSubmit('^C');
    } else if (e.key === 'z' && e.ctrlKey) {
      e.preventDefault();
      onChange('');
      onSubmit('end');
    } else if (e.key === 'a' && e.ctrlKey) {
      e.preventDefault();
      // Move cursor to start of line
      setTimeout(() => {
        inputRef.current?.setSelectionRange(0, 0);
      }, 0);
    } else if (e.key === 'e' && e.ctrlKey) {
      e.preventDefault();
      // Move cursor to end of line
      const len = value.length;
      setTimeout(() => {
        inputRef.current?.setSelectionRange(len, len);
      }, 0);
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

  const displayPrompt = reverseSearch.active
    ? `(reverse-i-search)\`${reverseSearch.query}\`: `
    : prompt;

  const promptSpanClassName = reverseSearch.active
    ? `${promptClassName} reverse-search-prompt`
    : promptClassName;

  return (
    <div
      className={rowClassName}
      onClick={() => inputRef.current?.focus()}
    >
      <span className={promptSpanClassName}>{displayPrompt}</span>
      <div className="terminal-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="terminal-input-field"
          value={value}
          onChange={e => {
            if (!reverseSearch.active) {
              onChange(e.target.value);
            }
          }}
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
