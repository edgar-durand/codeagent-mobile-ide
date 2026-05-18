import { useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_THEME_CHOICES,
  vscodeThemeToMonaco,
  type EditorSettingsSnapshot,
  type MonacoTheme,
  type SettingsStore,
  type VSCodeColorTheme,
} from '@codeam/ide-core';

/**
 * Storage key for user-imported themes. Read by `useMonacoThemes`
 * on InlineEditor mount so any imported theme survives reloads.
 * Stored as `MonacoTheme[]` — VS Code-format imports are converted
 * to Monaco shape at import time, not at register time.
 */
export const CUSTOM_THEMES_STORE_KEY = 'editor.customThemes';

interface Props {
  /** Persistence layer. When omitted, the panel renders in
   * uncontrolled-demo mode (changes live in component state only). */
  store?: SettingsStore | null;
  /** Theme list shown in the picker. Each entry's `id` is what
   * gets persisted; `label` is the human-readable name. Defaults to
   * `DEFAULT_THEME_CHOICES` from core. */
  themes?: { id: string; label: string }[];
  /**
   * When set to false, the marketplace-theme importer button is
   * hidden. Useful in embedded contexts where you don't want users
   * pasting arbitrary JSON.
   */
  allowThemeImport?: boolean;
}

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
export function SettingsPanel({
  store,
  themes = [...DEFAULT_THEME_CHOICES],
  allowThemeImport = true,
}: Props) {
  const [settings, setSettings] = useState<EditorSettingsSnapshot>(DEFAULT_EDITOR_SETTINGS);
  const [customThemes, setCustomThemes] = useState<MonacoTheme[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInput, setImportInput] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.get('editor').then((value) => {
      if (cancelled) return;
      if (isEditorSnapshot(value)) {
        setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
      }
    });
    void store.get(CUSTOM_THEMES_STORE_KEY).then((value) => {
      if (cancelled) return;
      if (Array.isArray(value)) {
        setCustomThemes(value as MonacoTheme[]);
      }
    });
    const off = store.watch((key, value) => {
      if (key === 'editor' && isEditorSnapshot(value)) {
        setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
      } else if (key === CUSTOM_THEMES_STORE_KEY && Array.isArray(value)) {
        setCustomThemes(value as MonacoTheme[]);
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

  const onImportTheme = () => {
    setImportError(null);
    try {
      const trimmed = importInput.trim();
      if (!trimmed) {
        setImportError('Paste a VS Code color-theme JSON to import.');
        return;
      }
      const raw = JSON.parse(trimmed) as VSCodeColorTheme;
      // Validate the bare minimum a marketplace theme always carries.
      // Themes without `tokenColors` AND `colors` are useless and
      // almost certainly the wrong JSON file (e.g. the user pasted a
      // package.json by mistake).
      if (
        (!raw.tokenColors || raw.tokenColors.length === 0) &&
        (!raw.colors || Object.keys(raw.colors).length === 0)
      ) {
        setImportError('JSON does not look like a VS Code color theme (no colors or tokenColors).');
        return;
      }
      const fallbackName = `imported-${Date.now()}`;
      const theme = vscodeThemeToMonaco(raw, fallbackName);
      // Replace by name so re-importing the same theme updates in
      // place rather than producing duplicate picker entries.
      const next = [...customThemes.filter((t) => t.name !== theme.name), theme];
      setCustomThemes(next);
      if (store) void store.set(CUSTOM_THEMES_STORE_KEY, next);
      // Auto-select the freshly imported theme.
      update({ theme: theme.name });
      setImportInput('');
      setImportOpen(false);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const onRemoveCustomTheme = (name: string) => {
    const next = customThemes.filter((t) => t.name !== name);
    setCustomThemes(next);
    if (store) void store.set(CUSTOM_THEMES_STORE_KEY, next);
    if (settings.theme === name) update({ theme: 'vs-dark' });
  };

  const themeChoices = [
    ...themes,
    ...customThemes.map((t) => ({ id: t.name, label: t.name })),
  ];

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
              {themeChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          {customThemes.length > 0 && (
            <div className="flex flex-col gap-1 pl-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                Imported themes
              </span>
              {customThemes.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between text-[11px] text-gray-300"
                >
                  <span className="truncate">{t.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCustomTheme(t.name)}
                    className="text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {allowThemeImport &&
            (importOpen ? (
              <div className="flex flex-col gap-2 pl-1">
                <textarea
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="Paste the contents of a VS Code *-color-theme.json"
                  rows={6}
                  className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[11px] text-gray-200 font-mono focus:outline-none focus:border-violet-500/50"
                />
                {importError && (
                  <span className="text-[11px] text-rose-300">{importError}</span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onImportTheme}
                    className="text-[11px] px-2 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white"
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportOpen(false);
                      setImportInput('');
                      setImportError(null);
                    }}
                    className="text-[11px] px-2 py-1 rounded text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
                <span className="text-[10px] text-gray-500">
                  Tip: download a marketplace theme as a `.vsix`, rename to `.zip`,
                  extract, and paste the contents of `themes/&lt;name&gt;.json`.
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="self-start text-[11px] px-2 py-1 rounded border border-gray-700/60 text-gray-300 hover:bg-gray-800/60"
              >
                + Import VS Code theme…
              </button>
            ))}
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
      {/* Inline-style transform so the toggle slides reliably even
          when the consumer's Tailwind purge doesn't ship our
          translate-x-* classes — bit me before with `top-1/2`. */}
      <span
        className="relative inline-block w-9 h-5 rounded-full transition-colors"
        style={{ backgroundColor: on ? '#8b5cf6' : '#374151', padding: 2 }}
        aria-hidden="true"
      >
        <span
          className="block w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}
