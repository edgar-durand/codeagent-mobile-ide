import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettingsSnapshot,
  type SettingsStore,
} from '@codeam/ide-core';

interface Props {
  store?: SettingsStore | null;
  themes?: { id: string; label: string }[];
}

const DEFAULT_THEMES: { id: string; label: string }[] = [
  { id: 'vs-dark', label: 'Dark (Visual Studio)' },
  { id: 'vs-light', label: 'Light (Visual Studio)' },
  { id: 'hc-black', label: 'High Contrast Dark' },
];

function isSnapshot(v: unknown): v is Partial<EditorSettingsSnapshot> {
  return typeof v === 'object' && v !== null;
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
export function SettingsPanel({ store, themes = DEFAULT_THEMES }: Props) {
  const [settings, setSettings] = useState<EditorSettingsSnapshot>(DEFAULT_EDITOR_SETTINGS);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.get('editor').then((v) => {
      if (cancelled) return;
      if (isSnapshot(v)) setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...v });
    });
    const off = store.watch((key, value) => {
      if (key !== 'editor') return;
      if (isSnapshot(value)) setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
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
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Appearance">
          <Text style={styles.fieldLabel}>Color theme</Text>
          <View style={styles.themeRow}>
            {themes.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => update({ theme: t.id })}
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
        </Section>

        <Section title="Editor">
          <NumberField
            label="Font size"
            value={settings.fontSize}
            onChange={(v) => update({ fontSize: v })}
            min={8}
            max={32}
          />
          <NumberField
            label="Tab size"
            value={settings.tabSize}
            onChange={(v) => update({ tabSize: v })}
            min={1}
            max={8}
          />
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
    <Pressable onPress={() => onChange(!on)} style={styles.fieldRow}>
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
    minHeight: 28,
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
});
