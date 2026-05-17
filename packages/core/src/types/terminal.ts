/**
 * Terminal adapter contract.
 *
 * The host renders an xterm.js-style display; the provider is responsible
 * for spawning a remote shell and bridging stdin/stdout. A `TerminalSession`
 * is opaque to the UI — the provider returns it from `open()` and the host
 * passes it back on every read / write / resize / close call so the
 * provider knows which shell to talk to (when the host can have multiple
 * terminals open at once).
 */

export interface TerminalEvent {
  type: 'data' | 'exit';
  /** UTF-8 chunk for 'data' events. */
  data?: string;
  /** Process exit code for 'exit' events. */
  exitCode?: number;
}

export interface TerminalSession {
  /** Opaque id the provider uses to dispatch read / write / close calls. */
  id: string;
}

export interface TerminalProvider {
  open(opts: { cols: number; rows: number; cwd?: string }): Promise<TerminalSession>;
  /** Forward keystrokes / pastes to the shell stdin. */
  write(session: TerminalSession, data: string): Promise<void>;
  /** Resize the underlying pty when the UI dimensions change. */
  resize(session: TerminalSession, cols: number, rows: number): Promise<void>;
  /**
   * Subscribe to data / exit events. Returns an unsubscribe function the
   * host calls on cleanup. The contract follows the same pattern the
   * shared-subscriber pool in @codeagent/api uses — the provider keeps a
   * single connection alive and the UI registers/deregisters handlers.
   */
  subscribe(session: TerminalSession, handler: (event: TerminalEvent) => void): () => void;
  close(session: TerminalSession): Promise<void>;
}
