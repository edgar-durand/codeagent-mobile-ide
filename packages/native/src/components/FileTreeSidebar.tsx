import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Optional `react-native-svg` import. The vast majority of VS Code
// icon themes (Material Icon Theme, vscode-icons, etc.) ship pure
// SVG assets, and RN's <Image> can't render SVGs natively. We
// load `SvgUri` lazily so consumers who don't have the peer dep
// installed still get the JS bundle (the URI branch then falls
// back to <Image> and the icon shows as blank rather than throws).
type SvgUriProps = {
  uri: string;
  width: number | string;
  height: number | string;
};
let SvgUriComponent: ComponentType<SvgUriProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  SvgUriComponent = (require('react-native-svg') as { SvgUri: ComponentType<SvgUriProps> }).SvgUri;
} catch {
  /* peer dep not installed — SVG icons will not render */
}
import type {
  FileIconRef,
  FileIconResolver,
  FileTreeEntry,
  FileTreeProvider,
} from '@codeam/ide-core';

interface Props {
  provider: FileTreeProvider;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  reloadKey?: string | number;
  /**
   * Optional icon theme. When supplied, each row renders an icon
   * from the resolver instead of the default Ionicons fallback.
   * `uri` icons render via `<Image>` so the consumer is responsible
   * for hosting the asset somewhere fetchable; `emoji` glyphs work
   * offline.
   */
  iconResolver?: FileIconResolver | null;
}

function IconCell({ icon }: { icon: FileIconRef }) {
  if (icon.kind === 'uri') {
    // VS Code icon themes overwhelmingly use SVG (Material Icon Theme
    // and vscode-icons are 100 % SVG). RN's `<Image>` decodes via
    // ImageIO on iOS / BitmapFactory on Android — neither knows how
    // to rasterise SVG, so the image silently fails to load and the
    // tree shows the default Ionicons fallback for every row. When
    // `react-native-svg` is available we route SVG URIs through
    // `SvgUri`, which renders the actual icon. Non-SVG URIs (PNG /
    // WebP / data: raster) still go through `<Image>`.
    const isSvg = /\.svg(\?|#|$)/i.test(icon.uri) || icon.uri.startsWith('data:image/svg');
    if (isSvg && SvgUriComponent) {
      return (
        <View style={{ width: 14, height: 14, marginRight: 4 }}>
          <SvgUriComponent uri={icon.uri} width={14} height={14} />
        </View>
      );
    }
    return (
      <Image
        source={{ uri: icon.uri }}
        style={{ width: 14, height: 14, marginRight: 4 }}
        resizeMode="contain"
      />
    );
  }
  if (icon.kind === 'emoji') {
    return <Text style={{ fontSize: 12, marginRight: 4 }}>{icon.char}</Text>;
  }
  return null;
}

interface FlatRow {
  kind: 'file' | 'folder';
  fullPath: string;
  name: string;
  depth: number;
  isOpen?: boolean;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
}

function buildTree(files: FileTreeEntry[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', isFile: false, children: new Map() };
  for (const f of files) {
    const parts = f.path.split('/').filter((p): p is string => p.length > 0);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');
      let next = cursor.children.get(part);
      if (!next) {
        next = { name: part, fullPath, isFile: isLast, children: new Map() };
        cursor.children.set(part, next);
      }
      cursor = next;
    }
  }
  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

// Flatten the tree into a single linear list driven by the expanded
// set. Doing the tree → flat conversion ahead of render lets us hand
// the result to FlatList for cheap virtualisation, which matters on
// repos with thousands of files.
function flattenTree(node: TreeNode, expanded: Set<string>, depth: number, out: FlatRow[]): void {
  for (const child of sortedChildren(node)) {
    if (child.isFile) {
      out.push({ kind: 'file', fullPath: child.fullPath, name: child.name, depth });
    } else {
      const isOpen = expanded.has(child.fullPath);
      out.push({ kind: 'folder', fullPath: child.fullPath, name: child.name, depth, isOpen });
      if (isOpen) flattenTree(child, expanded, depth + 1, out);
    }
  }
}

/**
 * VS Code-style file explorer for React Native. Mirrors the web
 * surface — same provider contract, same query → flat-list flow when
 * a query is active. Virtualised via FlatList (the doc's "FlashList
 * on native" recommendation requires the consumer pull in
 * @shopify/flash-list which we don't want to force; FlatList is
 * adequate up to several thousand entries).
 */
export function FileTreeSidebar({
  provider,
  selectedPath,
  onSelect,
  reloadKey,
  iconResolver,
}: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [files, setFiles] = useState<FileTreeEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const fetchKey = `${reloadKey ?? ''}|${debouncedQuery}`;
  const [committedKey, setCommittedKey] = useState<string | null>(null);
  const loading = committedKey !== fetchKey;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const providerRef = useRef(provider);
  providerRef.current = provider;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    providerRef.current
      .list(debouncedQuery || undefined)
      .then((payload) => {
        if (cancelled) return;
        setFiles(payload.files);
        setTruncated(payload.truncated);
        setCommittedKey(fetchKey);
      })
      .catch(() => {
        if (cancelled) return;
        setFiles([]);
        setTruncated(false);
        setCommittedKey(fetchKey);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, reloadKey, fetchKey]);

  const rows = useMemo<FlatRow[]>(() => {
    if (debouncedQuery.length > 0) {
      // Flat list of matches when filtering.
      return files.slice(0, 500).map<FlatRow>((f) => ({
        kind: 'file',
        fullPath: f.path,
        name: f.path,
        depth: 0,
      }));
    }
    const tree = buildTree(files);
    const out: FlatRow[] = [];
    flattenTree(tree, expanded, 0, out);
    return out;
  }, [files, expanded, debouncedQuery]);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search files…"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {truncated ? (
          <Text style={styles.truncatedNote}>
            {files.length} files (truncated — refine search)
          </Text>
        ) : null}
      </View>
      {loading && files.length === 0 ? (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color="#a78bfa" />
          <Text style={styles.placeholderText}>Loading workspace…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {query ? 'No files match.' : 'No files found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.kind}:${r.fullPath}`}
          renderItem={({ item }) => {
            const isSelected = item.kind === 'file' && selectedPath === item.fullPath;
            return (
              <Pressable
                onPress={() => {
                  if (item.kind === 'file') onSelect(item.fullPath);
                  else toggleFolder(item.fullPath);
                }}
                style={({ pressed }) => [
                  styles.row,
                  isSelected && styles.rowSelected,
                  pressed && styles.rowPressed,
                  { paddingLeft: 8 + item.depth * 12 },
                ]}
              >
                {item.kind === 'folder' ? (
                  <>
                    <Ionicons
                      name={item.isOpen ? 'chevron-down' : 'chevron-forward'}
                      size={11}
                      color="#6b7280"
                      style={styles.chevron}
                    />
                    {iconResolver
                      ? (() => {
                          const ref = iconResolver.forFolder(item.name, !!item.isOpen);
                          return ref.kind !== 'none' ? <IconCell icon={ref} /> : null;
                        })()
                      : null}
                  </>
                ) : iconResolver ? (
                  (() => {
                    const ref = iconResolver.forFile(item.name);
                    return ref.kind !== 'none' ? (
                      <IconCell icon={ref} />
                    ) : (
                      <Ionicons
                        name="document-outline"
                        size={11}
                        color="#6b7280"
                        style={styles.chevron}
                      />
                    );
                  })()
                ) : (
                  <Ionicons
                    name="document-outline"
                    size={11}
                    color="#6b7280"
                    style={styles.chevron}
                  />
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.rowText,
                    item.kind === 'folder' && styles.rowTextFolder,
                    isSelected && styles.rowTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  searchRow: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  searchInput: {
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#e5e7eb',
  },
  truncatedNote: { marginTop: 4, fontSize: 10, color: '#fcd34d' },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  placeholderText: { color: '#6b7280', fontSize: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  rowSelected: { backgroundColor: 'rgba(167,139,250,0.18)' },
  rowPressed: { backgroundColor: 'rgba(75,85,99,0.4)' },
  chevron: { width: 14, textAlign: 'center' },
  rowText: { color: '#d1d5db', fontSize: 12, flexShrink: 1 },
  rowTextFolder: { fontWeight: '600', color: '#e5e7eb' },
  rowTextSelected: { color: '#ede9fe' },
});
