import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
// xterm.js base styles. Consumers don't need to import this
// separately — tsup bundles it into the dist as a side-effect.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- TypeScript doesn't ship CSS module declarations
import '@xterm/xterm/css/xterm.css';
import type { TerminalProvider, TerminalSession } from '@codeam/ide-core';

// Cap on how many historical commands the "Recent" strip remembers
// per session. Past this we drop the oldest so the chip row stays
// scannable — same heuristic VS Code uses for its recently-used
// commands list.
const HISTORY_CAP = 50;

interface Props {
  provider: TerminalProvider;
  cwd?: string;
  /** Initial rows / cols passed to the provider's `open` call.
   * Defaults match VS Code's integrated terminal. The PTY is
   * resized via `provider.resize` whenever the host container's
   * dimensions change (xterm-addon-fit handles the math). */
  rows?: number;
  cols?: number;
  /** Optional title (e.g. "bash · main") shown in the header. */
  title?: string;
}

/**
 * xterm.js-backed terminal panel wired through a
 * {@link TerminalProvider}. The provider owns the PTY (shell spawn
 * via node-pty in the codeam-cli, integrated terminal API in IDE
 * plugins) — this component is purely the renderer + stdin bridge.
 *
 * Behaviour:
 *   - Opens a session on mount; subscribes for data + exit events.
 *   - All keystrokes flow through `provider.write` so multi-byte
 *     sequences (arrow keys, IME composition, paste) work without
 *     custom handling.
 *   - ResizeObserver on the host container drives `provider.resize`
 *     so the PTY rows/cols stay in sync with the actual rendered
 *     pixel dimensions — programs like `top`, `vim`, `less` lay out
 *     correctly.
 */
export function TerminalPanel({ provider, cwd, rows = 24, cols = 80, title }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const providerRef = useRef(provider);
  providerRef.current = provider;

  // Warp-inspired "blocks" history: every line the user submits
  // (Enter / Return) gets buffered as a chip strip above the live
  // xterm view. Click to rerun, hover to copy. Stays in sync with
  // the live stream — when a chip is reran, we replay the bytes
  // through the same `provider.write` path the user would.
  const [history, setHistory] = useState<string[]>([]);
  const bufferRef = useRef<string>('');

  const pushHistory = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const without = prev.filter((c) => c !== trimmed);
      return [trimmed, ...without].slice(0, HISTORY_CAP);
    });
  }, []);

  const rerun = useCallback((cmd: string) => {
    const session = sessionRef.current;
    if (!session) return;
    void providerRef.current.write(session, cmd + '\r');
    pushHistory(cmd);
  }, [pushHistory]);

  const copyToClipboard = useCallback((text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
  }, []);

  const clearTerminal = useCallback(() => {
    termRef.current?.clear();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#0d1117',
        foreground: '#e5e7eb',
        cursor: '#a78bfa',
        selectionBackground: 'rgba(167,139,250,0.3)',
        black: '#0d1117',
        red: '#fb7185',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#a78bfa',
        cyan: '#22d3ee',
        white: '#e5e7eb',
        brightBlack: '#374151',
        brightRed: '#fda4af',
        brightGreen: '#6ee7b7',
        brightYellow: '#fcd34d',
        brightBlue: '#93c5fd',
        brightMagenta: '#c4b5fd',
        brightCyan: '#67e8f9',
        brightWhite: '#f3f4f6',
      },
      scrollback: 5000,
      convertEol: false,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let active = true;
    let unsub: (() => void) | null = null;
    let openedSession: TerminalSession | null = null;

    void providerRef.current
      .open({ cols: term.cols, rows: term.rows, cwd })
      .then((session) => {
        if (!active) {
          void providerRef.current.close(session);
          return;
        }
        openedSession = session;
        sessionRef.current = session;
        unsub = providerRef.current.subscribe(session, (ev) => {
          if (!termRef.current) return;
          if (ev.type === 'data' && typeof ev.data === 'string') {
            termRef.current.write(ev.data);
          } else if (ev.type === 'exit') {
            setExitCode(ev.exitCode ?? 0);
          }
        });
      })
      .catch((e) => {
        if (active) {
          term.writeln(`\x1b[31mTerminal error: ${e instanceof Error ? e.message : String(e)}\x1b[0m`);
          setExitCode(-1);
        }
      });

    const onData = term.onData((data) => {
      const session = sessionRef.current;
      if (!session) return;
      void providerRef.current.write(session, data);
      // Track the running input buffer so we can capture a
      // "command" snapshot every time the user hits Enter — the
      // result becomes a clickable chip in the "Recent" strip.
      for (const ch of data) {
        if (ch === '\r' || ch === '\n') {
          if (bufferRef.current.trim().length > 0) pushHistory(bufferRef.current);
          bufferRef.current = '';
        } else if (ch === '\x7f' || ch === '\b') {
          bufferRef.current = bufferRef.current.slice(0, -1);
        } else if (ch >= ' ') {
          bufferRef.current += ch;
        }
      }
    });

    // Fit on container resize so the PTY matches the rendered size.
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        const session = sessionRef.current;
        if (session) {
          void providerRef.current.resize(session, term.cols, term.rows);
        }
      } catch {
        /* fit may throw before the container is laid out — ignore */
      }
    });
    ro.observe(containerRef.current);

    return () => {
      active = false;
      ro.disconnect();
      onData.dispose();
      if (unsub) unsub();
      if (openedSession) void providerRef.current.close(openedSession);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      sessionRef.current = null;
    };
    // We deliberately only run this effect once per cwd/cols/rows
    // change; provider identity is mirrored through `providerRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, cols, rows]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Terminal
          </span>
          {title ? <span className="text-[11px] font-mono text-gray-500">{title}</span> : null}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearTerminal}
            className="text-[10px] uppercase tracking-wider font-bold text-gray-500 hover:text-gray-200 transition-colors"
            title="Clear"
          >
            Clear
          </button>
        </div>
      </div>
      {history.length > 0 ? (
        // Warp-inspired "blocks" strip: each chip is a previously
        // submitted command; click to rerun, hover for a copy
        // affordance. Capped at HISTORY_CAP entries.
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0d1117] border-b border-gray-800/40 overflow-x-auto">
          <span className="text-[9px] uppercase tracking-wider font-bold text-gray-500 shrink-0">
            Recent
          </span>
          {history.map((cmd, i) => (
            <div
              key={cmd + i}
              className="group inline-flex items-center gap-1 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 rounded px-1.5 py-0.5 max-w-[200px]"
            >
              <button
                type="button"
                onClick={() => rerun(cmd)}
                className="font-mono text-[11px] text-gray-300 hover:text-white truncate"
                title={`Re-run: ${cmd}`}
              >
                {cmd}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(cmd)}
                className="text-[10px] text-gray-500 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy"
                aria-label="Copy command"
              >
                ⧉
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div ref={containerRef} className="flex-1 min-h-0 px-2 py-1" />
    </div>
  );
}
