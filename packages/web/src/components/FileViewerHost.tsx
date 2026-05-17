import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { detectLanguage } from '@codeam/ide-core';
import { useFileViewer } from './FileViewerContext';

/**
 * DOM-side FileViewer host. Same contract as the native version: mount it
 * once inside a `<FileViewerProvider>` subtree, and `useFileViewer().open()`
 * pops the editor overlay. Uses `@monaco-editor/react` so the heavy Monaco
 * loader is dynamic-import'd lazily — the package doesn't pull Monaco into
 * the consumer's main bundle until the editor actually opens.
 *
 * Styling: this v0.1.0 ships with inline styles (no Tailwind, no CSS files
 * to import). Themes / colour customisation are tracked in the Phase 2
 * settings panel work — see `docs/roadmap/phase-2-features.md`.
 */
export function FileViewerHost() {
  const { request, fetcher, close } = useFileViewer();
  const [content, setContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!request || !fetcher) return;
    setContent(null);
    setOriginalContent(null);
    setError(null);
    setSavedAt(null);
    setLoading(true);
    let cancelled = false;
    fetcher
      .read(request.path)
      .then((result) => {
        if (cancelled) return;
        if (!result || result.error) {
          setError(result?.error ?? 'Could not read file.');
          return;
        }
        const c = result.content ?? '';
        setContent(c);
        setOriginalContent(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Read failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request, fetcher]);

  const language = useMemo(() => (request ? detectLanguage(request.path) : 'plaintext'), [request]);
  const dirty = content !== originalContent && originalContent !== null;
  const canSave = fetcher !== null && fetcher.canWrite && content !== null && dirty && !saving;

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void onSave();
    });
  };

  const onSave = async () => {
    if (!fetcher || content === null || !request) return;
    setSaving(true);
    setError(null);
    try {
      const result = await fetcher.write(request.path, content);
      if (!result || result.error) {
        setError(result?.error ?? 'Save failed.');
        return;
      }
      setOriginalContent(content);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  return (
    <div style={styles.backdrop} role="dialog" aria-modal>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={{ ...styles.fileName }}>{request.path}</span>
            {dirty && <span style={styles.dirty}>●</span>}
          </div>
          <div style={styles.headerRight}>
            {savedAt && !dirty && <span style={styles.savedHint}>Saved</span>}
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!canSave}
              style={{ ...styles.saveBtn, opacity: canSave ? 1 : 0.5 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={close} style={styles.closeBtn} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        {error && <div style={styles.errorBar}>{error}</div>}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.placeholder}>Fetching {request.path}…</div>
          ) : !fetcher ? (
            <div style={styles.placeholder}>
              No active session. Pair an IDE plugin or CLI first.
            </div>
          ) : (
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={content ?? ''}
              onChange={(v) => setContent(v ?? '')}
              onMount={onMount}
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                fontSize: 13,
                tabSize: 2,
                automaticLayout: true,
                bracketPairColorization: { enabled: true },
                smoothScrolling: true,
                readOnly: fetcher === null || !fetcher.canWrite,
              }}
            />
          )}
        </div>
        <div style={styles.footer}>
          <span>{fetcher ? 'Connected · powered by Monaco' : 'Read-only'}</span>
          <span>{language.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0d1117',
    color: '#e5e7eb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid #1f2433',
    background: '#161b22',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  fileName: {
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dirty: { color: '#fbbf24', fontSize: 18, marginLeft: 4 },
  savedHint: { color: '#34d399', fontSize: 11 },
  saveBtn: {
    background: '#a78bfa',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  closeBtn: {
    background: 'transparent',
    color: '#bcb6cc',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  errorBar: {
    background: 'rgba(239,68,68,0.18)',
    borderBottom: '1px solid rgba(239,68,68,0.45)',
    padding: '8px 12px',
    color: '#fecaca',
    fontSize: 11,
  },
  body: { flex: 1, minHeight: 0 },
  placeholder: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#bcb6cc',
    fontSize: 12,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#161b22',
    borderTop: '1px solid #1f2433',
    color: '#8b8794',
    fontSize: 11,
  },
};
