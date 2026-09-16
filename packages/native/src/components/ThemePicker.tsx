import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MarketplaceThemeRef, MonacoTheme } from '@codeam/ide-core';

export interface ThemePickerProps {
  themeChoices: readonly { id: string; label: string }[];
  activeTheme: string;
  onThemeChange: (themeId: string) => void;
  marketplaceThemes: readonly MarketplaceThemeRef[];
  customThemes: readonly MonacoTheme[];
  busy: boolean;
  importOpen: boolean;
  importInput: string;
  importError: string | null;
  allowThemeImport: boolean;
  onInstallMarketplaceTheme: (ref: MarketplaceThemeRef) => void;
  onRemoveCustomTheme: (name: string) => void;
  onImportInputChange: (value: string) => void;
  onImportTheme: () => void;
  onOpenImport: () => void;
  onCloseImport: () => void;
}

export function ThemePicker({
  themeChoices,
  activeTheme,
  onThemeChange,
  marketplaceThemes,
  customThemes,
  busy,
  importOpen,
  importInput,
  importError,
  allowThemeImport,
  onInstallMarketplaceTheme,
  onRemoveCustomTheme,
  onImportInputChange,
  onImportTheme,
  onOpenImport,
  onCloseImport,
}: ThemePickerProps) {
  return (
    <>
      <Text style={styles.fieldLabel}>Color theme</Text>
      <View style={styles.themeRow}>
        {themeChoices.map((t) => (
          <Pressable
            key={t.id}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: activeTheme === t.id, disabled: busy }}
            accessibilityLabel={`Color theme ${t.label}`}
            onPress={() => onThemeChange(t.id)}
            style={[styles.themeChip, activeTheme === t.id && styles.themeChipActive]}
          >
            <Text
              style={[styles.themeChipText, activeTheme === t.id && styles.themeChipTextActive]}
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
            const active = activeTheme === m.name;
            const installed = customThemes.some((t) => t.name === m.name);
            return (
              <Pressable
                key={m.name}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: busy }}
                accessibilityLabel={`${installed ? 'Apply' : 'Install'} ${m.name}`}
                onPress={() => void onInstallMarketplaceTheme(m)}
                style={[styles.marketplaceRow, active && styles.marketplaceRowActive]}
              >
                <Text
                  style={[styles.marketplaceName, active && styles.marketplaceNameActive]}
                  numberOfLines={1}
                >
                  {m.name}
                </Text>
                <Text style={styles.marketplaceState}>
                  {active ? 'active' : installed ? 'installed' : 'install'}
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
                style={{ minHeight: 44, justifyContent: 'center' }}
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
              onChangeText={onImportInputChange}
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
              <Pressable onPress={onCloseImport} style={styles.importBtnCancel}>
                <Text style={styles.importBtnCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onOpenImport} style={styles.importTrigger}>
            <Text style={styles.importTriggerText}>+ Import VS Code theme…</Text>
          </Pressable>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 12, color: '#d1d5db' },
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
