import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { FileFetcher, FileViewerRequest } from '@codeam/ide-core';

/**
 * Web equivalent of the native FileViewer context. Same surface as
 * `@codeam/ide-native` so consumers writing cross-platform code can swap
 * the import path without touching call sites. See the native package
 * docs for the full rationale behind the design.
 */

export interface FileViewerContextValue {
  request: FileViewerRequest | null;
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
