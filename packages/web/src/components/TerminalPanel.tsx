import { useEffect, useRef, useState } from 'react';
import type { TerminalProvider, TerminalSession } from '@codeam/ide-core';

interface Props {
  provider: TerminalProvider;
  /** Initial working directory for the spawned shell. */
  cwd?: string;
  /** Approximate row count for the initial PTY size. The component
   * doesn't auto-resize the PTY based on its rendered height — that's
   * a Phase 3 concern when xterm.js is integrated for real. */
  rows?: number;
  cols?: number;
}

/**
 * Minimal terminal panel for Phase 2. Backed by the supplied
 * {@link TerminalProvider} — opens a shell on mount, subscribes to
 * data events, renders raw output in a `<pre>` and forwards stdin
 * via the input box at the bottom.
 *
 * This is intentionally not xterm.js yet — adding xterm.js adds a
 * significant peer dep that not every consumer wants to ship.
 * Phase 3 will introduce an optional xterm.js renderer slot so
 * power users can drop it in. Cursor positioning, colour escapes,
 * and ctrl-key sequences are passed through verbatim in the
 * meantime — adequate for read-mostly use cases (build logs, test
 * output, git diff) but not a full interactive shell.
 */
export function TerminalPanel({ provider, cwd, rows = 24, cols = 80 }: Props) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [output, setOutput] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLPreElement | null>(null);
  const providerRef = useRef(provider);
  providerRef.current = provider;

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;
    let openedSession: TerminalSession | null = null;
    void providerRef.current
      .open({ cols, rows, cwd })
      .then((s) => {
        if (!active) {
          void providerRef.current.close(s);
          return;
        }
        openedSession = s;
        setSession(s);
        unsub = providerRef.current.subscribe(s, (ev) => {
          if (ev.type === 'data' && typeof ev.data === 'string') {
            setOutput((prev) => prev + ev.data);
          } else if (ev.type === 'exit') {
            setExitCode(ev.exitCode ?? 0);
          }
        });
      })
      .catch(() => {
        if (active) setExitCode(-1);
      });
    return () => {
      active = false;
      if (unsub) unsub();
      if (openedSession) void providerRef.current.close(openedSession);
    };
  }, [cols, rows, cwd]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  const submit = () => {
    if (!session) return;
    const line = `${input}\n`;
    setInput('');
    void providerRef.current.write(session, line);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 min-w-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Terminal
          </span>
          {exitCode !== null ? (
            <span
              className={[
                'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                exitCode === 0
                  ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10'
                  : 'border-rose-500/40 text-rose-200 bg-rose-500/10',
              ].join(' ')}
            >
              exit {exitCode}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-gray-500">running</span>
          )}
        </div>
      </div>
      <pre
        ref={scrollRef}
        className="flex-1 overflow-auto px-3 py-2 font-mono text-[12px] text-gray-200 whitespace-pre-wrap"
      >
        {output || (session === null ? 'Starting…' : '')}
      </pre>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 px-3 py-2 border-t border-gray-800/60"
      >
        <span className="text-emerald-400 font-mono text-[12px]">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={session === null || exitCode !== null}
          placeholder={session === null ? 'starting…' : exitCode !== null ? '(exited)' : 'type a command'}
          className="flex-1 bg-transparent font-mono text-[12px] text-gray-200 focus:outline-none placeholder:text-gray-500"
        />
      </form>
    </div>
  );
}
