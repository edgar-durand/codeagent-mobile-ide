import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { FileFetcher, FileViewerRequest } from '@codeam/ide-core';

/**
 * Surface-agnostic context the FileViewerHost subscribes to. Consumer code
 * mounts a `<FileViewerProvider>` near the root, passes in the `FileFetcher`
 * for the active workspace, and then anywhere inside the subtree can call
 * `useFileViewer().open({ path, op })` to pop the editor modal.
 *
 * The provider is intentionally thin: it tracks the currently-requested
 * file plus an open / close API. Mounting `<FileViewerHost />` somewhere in
 * the tree wires the modal renderer to this context — without the host the
 * provider is a no-op state holder, which makes it cheap to leave mounted
 * even on screens that never trigger a file open.
 */

export interface FileViewerContextValue {
  /** Currently-requested file, or `null` when the modal is closed. */
  request: FileViewerRequest | null;
  /**
   * The fetcher the host uses to read/write. Memoised by the provider so
   * the host's `useEffect([request, fetcher])` only re-fires when the
   * underlying adapter identity actually changes.
   */
  fetcher: FileFetcher | null;
  open: (request: FileViewerRequest) => void;
  close: () => void;
}

const FileViewerContext = createContext<FileViewerContextValue | null>(null);

export function FileViewerProvider({
  fetcher,
  children,
}: {
  fetcher: FileFetcher | null;
  children: ReactNode;
}) {
  const [request, setRequest] = useState<FileViewerRequest | null>(null);
  const open = useCallback((r: FileViewerRequest) => setRequest(r), []);
  const close = useCallback(() => setRequest(null), []);
  const value = useMemo<FileViewerContextValue>(
    () => ({ request, fetcher, open, close }),
    [request, fetcher, open, close],
  );
  return <FileViewerContext.Provider value={value}>{children}</FileViewerContext.Provider>;
}

export function useFileViewer(): FileViewerContextValue {
  const v = useContext(FileViewerContext);
  if (!v) {
    // Allow callers to depend on the hook even when no provider is mounted —
    // returns a no-op surface so a screen that lazy-mounts the IDE doesn't
    // crash on cold render. Matches the original codeagent-mobile shim.
    return {
      request: null,
      fetcher: null,
      open: () => {
        /* no-op outside provider */
      },
      close: () => {
        /* no-op */
      },
    };
  }
  return v;
}
