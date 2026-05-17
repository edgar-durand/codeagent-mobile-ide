import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettingsSnapshot, type SettingsStore } from '@codeam/ide-core';

interface Props {
  /** Persistence layer. When omitted, the panel renders in
   * uncontrolled-demo mode (changes live in component state only). */
  store?: SettingsStore | null;
  /** Theme list shown in the picker. Each entry's `id` is what
   * gets persisted; `label` is the human-readable name. */
  themes?: { id: string; label: string }[];
}

const DEFAULT_THEMES: { id: string; label: string }[] = [
  { id: 'vs-dark', label: 'Dark (Visual Studio)' },
  { id: 'vs-light', label: 'Light (Visual Studio)' },
  { id: 'hc-black', label: 'High Contrast Dark' },
];

function isEditorSnapshot(v: unknown): v is Partial<EditorSettingsSnapshot> {
  return typeof v === 'object' && v !== null;
}

/**
 * Minimal settings panel: theme, editor font size, tab size, word
 * wrap, minimap, line numbers. Reads / writes through the supplied
 * {@link SettingsStore} under the single key `editor`. If no store
 * is supplied the panel still renders and the changes live in
 * component state — useful for demos and storybook.
 *
 * VS Code's full settings UI (tabs, JSON view, schema-aware search,
 * etc.) is out of scope for this minor — Phase 3 will extend this.
 */
export function SettingsPanel({ store, themes = DEFAULT_THEMES }: Props) {
  const [settings, setSettings] = useState<EditorSettingsSnapshot>(DEFAULT_EDITOR_SETTINGS);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.get('editor').then((value) => {
      if (cancelled) return;
      if (isEditorSnapshot(value)) {
        setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
      }
    });
    const off = store.watch((key, value) => {
      if (key !== 'editor') return;
      if (isEditorSnapshot(value)) {
        setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  const update = (patch: Partial<EditorSettingsSnapshot>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (store) void store.set('editor', next);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 min-w-0">
      <div className="px-3 py-2 border-b border-gray-800/60">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-4">
        <Section title="Appearance">
          <Field label="Color theme">
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value })}
              className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:border-violet-500/50"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Editor">
          <Field label="Font size">
            <input
              type="number"
              min={8}
              max={32}
              value={settings.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) || DEFAULT_EDITOR_SETTINGS.fontSize })}
              className="w-20 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:border-violet-500/50"
            />
          </Field>
          <Field label="Tab size">
            <input
              type="number"
              min={1}
              max={8}
              value={settings.tabSize}
              onChange={(e) => update({ tabSize: Number(e.target.value) || DEFAULT_EDITOR_SETTINGS.tabSize })}
              className="w-20 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:border-violet-500/50"
            />
          </Field>
          <Toggle
            label="Word wrap"
            on={settings.wordWrap}
            onChange={(v) => update({ wordWrap: v })}
          />
          <Toggle
            label="Minimap"
            on={settings.minimap}
            onChange={(v) => update({ minimap: v })}
          />
          <Toggle
            label="Line numbers"
            on={settings.lineNumbers}
            onChange={(v) => update({ lineNumbers: v })}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      <div className="flex flex-col gap-2 pl-1">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12px] text-gray-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 text-[12px] text-gray-300 hover:text-gray-100 transition-colors"
    >
      <span>{label}</span>
      <span
        className={[
          'inline-block w-9 h-5 rounded-full p-0.5 transition-colors',
          on ? 'bg-violet-500' : 'bg-gray-700',
        ].join(' ')}
        aria-hidden="true"
      >
        <span
          className={[
            'block w-4 h-4 rounded-full bg-white transition-transform',
            on ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
    </button>
  );
}
