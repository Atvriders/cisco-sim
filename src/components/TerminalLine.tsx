interface Props {
  type: 'input' | 'output' | 'error' | 'info' | 'system' | 'success';
  text: string;
}

export default function TerminalLineComponent({ type, text }: Props) {
  return (
    <div className={`terminal-line ${type}`}>
      {text || '\u00a0'}
    </div>
  );
}
