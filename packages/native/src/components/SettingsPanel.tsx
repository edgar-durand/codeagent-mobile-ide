import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_THEME_CHOICES,
  MARKETPLACE_THEMES,
  parseJsonc,
  vscodeThemeToMonaco,
  type EditorSettingsSnapshot,
  type MarketplaceThemeRef,
  type MonacoTheme,
  type SettingsStore,
} from '@codeam/ide-core';
import { useIDETheme } from '../theme';
import { downloadMarketplaceJson, isVSCodeColorTheme } from '../utils/marketplaceDownload';

/**
 * Storage key for user-imported themes — kept byte-identical to the
 * web SettingsPanel so a sync'd `SettingsStore` round-trips between
 * platforms.
 */
export const CUSTOM_THEMES_STORE_KEY = 'editor.customThemes';

interface Props {
  store?: SettingsStore | null;
  themes?: { id: string; label: string }[];
  allowThemeImport?: boolean;
  marketplaceThemes?: readonly MarketplaceThemeRef[];
}

function isSnapshot(v: unknown): v is Partial<EditorSettingsSnapshot> {
  return typeof v === 'object' && v !== null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * React Native settings panel. Same single `editor` key in the
 * supplied SettingsStore as the web version — settings round-trip
 * cleanly between platforms when the consumer wires a sync'd
 * store.
 *
 * RN doesn't have a native picker that fits the dark theme without
 * pulling another dep, so the theme picker is a horizontal pill
 * row (taps to cycle).
 */
export function SettingsPanel({
  store,
  themes = [...DEFAULT_THEME_CHOICES],
  allowThemeImport = true,
  marketplaceThemes = MARKETPLACE_THEMES,
}: Props) {
  const [settings, setSettings] = useState<EditorSettingsSnapshot>(DEFAULT_EDITOR_SETTINGS);
  const [customThemes, setCustomThemes] = useState<MonacoTheme[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const downloads = useRef(new Set<AbortController>());
  const ideTheme = useIDETheme();

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void Promise.all([store.get('editor'), store.get(CUSTOM_THEMES_STORE_KEY)])
      .then(([editor, custom]) => {
        if (cancelled) return;
        if (isSnapshot(editor)) setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...editor });
        if (Array.isArray(custom)) setCustomThemes(custom as MonacoTheme[]);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStoreError(errorMessage(error, 'Could not load settings.'));
      });
    let off: () => void = () => undefined;
    try {
      off = store.watch((key, value) => {
        if (key === 'editor' && isSnapshot(value)) {
          setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
        } else if (key === CUSTOM_THEMES_STORE_KEY && Array.isArray(value)) {
          setCustomThemes(value as MonacoTheme[]);
        }
      });
    } catch (error) {
      setStoreError(errorMessage(error, 'Could not watch settings for changes.'));
    }
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  useEffect(
    () => () => {
      downloads.current.forEach((controller) => controller.abort());
      downloads.current.clear();
    },
    [],
  );

  const update = async (patch: Partial<EditorSettingsSnapshot>) => {
    const next = { ...settings, ...patch };
    setStoreError(null);
    if (!store) {
      setSettings(next);
      return true;
    }
    setBusy(true);
    try {
      await store.set('editor', next);
      setSettings(next);
      return true;
    } catch (error) {
      setStoreError(errorMessage(error, 'Could not save settings.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const installMarketplaceTheme = async (ref: MarketplaceThemeRef) => {
    setImportError(null);
    setBusy(true);
    const controller = new AbortController();
    downloads.current.add(controller);
    try {
      const raw = await downloadMarketplaceJson(ref.url, isVSCodeColorTheme, controller.signal);
      const theme = vscodeThemeToMonaco({ ...raw, name: ref.name }, ref.name);
      const next = [...customThemes.filter((t) => t.name !== theme.name), theme];
      if (store) {
        await store.set(CUSTOM_THEMES_STORE_KEY, next);
        if (!(await update({ theme: theme.name }))) {
          await store.set(CUSTOM_THEMES_STORE_KEY, customThemes);
          return;
        }
      } else {
        setSettings((current) => ({ ...current, theme: theme.name }));
      }
      setCustomThemes(next);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Failed to install theme');
    } finally {
      downloads.current.delete(controller);
      setBusy(false);
    }
  };

  const onImportTheme = async () => {
    setImportError(null);
    const trimmed = importInput.trim();
    if (!trimmed) {
      setImportError('Paste a VS Code color-theme JSON.');
      return;
    }
    try {
      const raw = parseJsonc<unknown>(trimmed);
      if (!isVSCodeColorTheme(raw)) {
        setImportError('Not a VS Code color theme — no colors or tokenColors.');
        return;
      }
      const theme = vscodeThemeToMonaco(raw, `imported-${Date.now()}`);
      const next = [...customThemes.filter((t) => t.name !== theme.name), theme];
      setBusy(true);
      if (store) {
        await store.set(CUSTOM_THEMES_STORE_KEY, next);
        if (!(await update({ theme: theme.name }))) {
          await store.set(CUSTOM_THEMES_STORE_KEY, customThemes);
          return;
        }
      } else {
        setSettings((current) => ({ ...current, theme: theme.name }));
      }
      setCustomThemes(next);
      setImportInput('');
      setImportOpen(false);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON');
    } finally {
      setBusy(false);
    }
  };

  const onRemoveCustomTheme = (name: string) => {
    Alert.alert('Remove theme?', `Remove “${name}” from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const next = customThemes.filter((t) => t.name !== name);
            setBusy(true);
            setStoreError(null);
            try {
              if (store) await store.set(CUSTOM_THEMES_STORE_KEY, next);
              if (settings.theme === name && !(await update({ theme: 'vs-dark' }))) {
                if (store) await store.set(CUSTOM_THEMES_STORE_KEY, customThemes);
                return;
              }
              setCustomThemes(next);
            } catch (error) {
              setStoreError(errorMessage(error, 'Could not remove the theme.'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const themeChoices = [...themes, ...customThemes.map((t) => ({ id: t.name, label: t.name }))];

  return (
    <View style={[styles.container, { backgroundColor: ideTheme.colors.surface }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {storeError && (
          <Text
            accessibilityRole="alert"
            style={[styles.importError, { color: ideTheme.colors.danger }]}
          >
            {storeError}
          </Text>
        )}
        <Section title="Appearance">
          <Text style={styles.fieldLabel}>Color theme</Text>
          <View style={styles.themeRow}>
            {themeChoices.map((t) => (
              <Pressable
                key={t.id}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ checked: settings.theme === t.id, disabled: busy }}
                accessibilityLabel={`Color theme ${t.label}`}
                onPress={() => void update({ theme: t.id })}
                style={[styles.themeChip, settings.theme === t.id && styles.themeChipActive]}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    settings.theme === t.id && styles.themeChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {marketplaceThemes.length > 0 && (
            <View style={styles.importedList}>
              <Text style={styles.importedLabel}>Popular themes (marketplace)</Text>
              {marketplaceThemes.map((m) => {
                const active = settings.theme === m.name;
                const installed = customThemes.some((t) => t.name === m.name);
                return (
                  <Pressable
                    key={m.name}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: busy }}
                    accessibilityLabel={`${installed ? 'Apply' : 'Install'} ${m.name}`}
                    onPress={() => void installMarketplaceTheme(m)}
                    style={[styles.marketplaceRow, active && styles.marketplaceRowActive]}
                  >
                    <Text
                      style={[styles.marketplaceName, active && styles.marketplaceNameActive]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    <Text style={styles.marketplaceState}>
                      {active ? '● active' : installed ? '✓ installed' : 'install'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {customThemes.length > 0 && (
            <View style={styles.importedList}>
              <Text style={styles.importedLabel}>Imported themes</Text>
              {customThemes.map((t) => (
                <View key={t.name} style={styles.importedRow}>
                  <Text style={styles.importedName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Pressable
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${t.name}`}
                    onPress={() => onRemoveCustomTheme(t.name)}
                    style={{ minHeight: ideTheme.minimumTouchSize, justifyContent: 'center' }}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {allowThemeImport &&
            (importOpen ? (
              <View style={styles.importBox}>
                <TextInput
                  value={importInput}
                  onChangeText={setImportInput}
                  placeholder="Paste a *-color-theme.json"
                  placeholderTextColor="#6b7280"
                  multiline
                  style={styles.importInput}
                />
                {importError && <Text style={styles.importError}>{importError}</Text>}
                <View style={styles.importBtnRow}>
                  <Pressable
                    disabled={busy}
                    accessibilityRole="button"
                    onPress={() => void onImportTheme()}
                    style={styles.importBtnPrimary}
                  >
                    <Text style={styles.importBtnPrimaryText}>Import</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setImportOpen(false);
                      setImportInput('');
                      setImportError(null);
                    }}
                    style={styles.importBtnCancel}
                  >
                    <Text style={styles.importBtnCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setImportOpen(true)}
                style={styles.importTrigger}
              >
                <Text style={styles.importTriggerText}>+ Import VS Code theme…</Text>
              </Pressable>
            ))}
        </Section>

        <Section title="Editor">
          <NumberField
            label="Font size"
            value={settings.fontSize}
            onChange={(v) => void update({ fontSize: v })}
            min={8}
            max={32}
          />
          <NumberField
            label="Tab size"
            value={settings.tabSize}
            onChange={(v) => void update({ tabSize: v })}
            min={1}
            max={8}
          />
          <Toggle
            label="Word wrap"
            on={settings.wordWrap}
            onChange={(v) => void update({ wordWrap: v })}
          />
          <Toggle
            label="Minimap"
            on={settings.minimap}
            onChange={(v) => void update({ minimap: v })}
          />
          <Toggle
            label="Line numbers"
            on={settings.lineNumbers}
            onChange={(v) => void update({ lineNumbers: v })}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={setText}
        onEndEditing={() => {
          const n = parseInt(text, 10);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          else setText(String(value));
        }}
        keyboardType="number-pad"
        style={styles.numberInput}
      />
    </View>
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
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={styles.fieldRow}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.switchThumb, on && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  titleRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
  },
  content: { padding: 12, gap: 16 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6b7280',
  },
  sectionBody: { gap: 10, paddingLeft: 4 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  fieldLabel: { fontSize: 12, color: '#d1d5db' },
  numberInput: {
    width: 64,
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#e5e7eb',
    fontSize: 12,
    textAlign: 'right',
  },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 4 },
  themeChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: 'rgba(17,24,39,0.7)',
  },
  themeChipActive: { backgroundColor: 'rgba(167,139,250,0.25)', borderColor: '#a78bfa' },
  themeChipText: { fontSize: 11, color: '#9ca3af' },
  themeChipTextActive: { color: '#ede9fe' },
  switch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#374151',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: '#a78bfa' },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  switchThumbOn: { transform: [{ translateX: 16 }] },
  importedList: { marginTop: 8, paddingLeft: 4, gap: 4 },
  importedLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6b7280',
  },
  importedRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importedName: { flex: 1, fontSize: 11, color: '#d1d5db' },
  removeText: { fontSize: 11, color: '#f87171' },
  importBox: { marginTop: 8, gap: 6, paddingLeft: 4 },
  importInput: {
    minHeight: 96,
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#e5e7eb',
    fontSize: 11,
    fontFamily: 'Menlo',
    textAlignVertical: 'top',
  },
  importError: { fontSize: 11, color: '#fda4af' },
  importBtnRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  importBtnPrimary: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  importBtnPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  importBtnCancel: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  importBtnCancelText: { color: '#9ca3af', fontSize: 11 },
  importTrigger: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  importTriggerText: { color: '#d1d5db', fontSize: 11 },
  marketplaceRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  marketplaceRowActive: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderColor: '#a78bfa',
  },
  marketplaceName: { flex: 1, color: '#d1d5db', fontSize: 11 },
  marketplaceNameActive: { color: '#ede9fe' },
  marketplaceState: { color: '#6b7280', fontSize: 10, marginLeft: 8 },
});
