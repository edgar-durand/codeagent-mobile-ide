import { useEffect, useMemo, useState } from 'react';
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
 * Styling: this component uses Tailwind CSS classes matching the rest of
 * the @codeam/ide-web package. Themes / colour customisation are tracked
 * in the Phase 2 settings panel work — see `docs/roadmap/phase-2-features.md`.
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
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-stretch justify-stretch" role="dialog" aria-modal>
      <div className="flex-1 flex flex-col bg-[#0d1117] text-gray-200 font-['-apple-system',BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1f2433] bg-[#161b22]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">{request.path}</span>
            {dirty && <span className="text-amber-400 text-lg ml-1">●</span>}
          </div>
          <div className="flex items-center gap-2.5">
            {savedAt && !dirty && <span className="text-emerald-400 text-[11px]">Saved</span>}
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!canSave}
              className="bg-violet-400 text-white border-0 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
              style={{ opacity: canSave ? 1 : 0.5 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={close} className="bg-transparent text-[#bcb6cc] border-0 text-lg cursor-pointer p-1" aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        {error && <div className="bg-rose-500/20 border-b border-rose-500/40 px-3 py-2 text-rose-200 text-[11px]">{error}</div>}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center text-[#bcb6cc] text-xs">Fetching {request.path}…</div>
          ) : !fetcher ? (
            <div className="h-full flex items-center justify-center text-[#bcb6cc] text-xs">
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
        <div className="flex justify-between px-3 py-2 bg-[#161b22] border-t border-[#1f2433] text-[#8b8794] text-[11px]">
          <span>{fetcher ? 'Connected · powered by Monaco' : 'Read-only'}</span>
          <span>{language.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
