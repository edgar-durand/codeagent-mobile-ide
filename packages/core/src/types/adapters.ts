import type { FileFetcher } from './file-viewer';
import type { GitProvider } from './git';
import type { FileTreeProvider } from './file-tree';
import type { SearchProvider } from './search';
import type { TerminalProvider } from './terminal';

/**
 * Convenience aggregate the consumer passes to the IDE root component once
 * they have all the adapters wired. Each individual field is optional so
 * a minimal integration can ship the FileViewer alone without standing up
 * a Git or terminal provider yet.
 */
export interface IdeAdapters {
  fileFetcher?: FileFetcher | null;
  git?: GitProvider | null;
  fileTree?: FileTreeProvider | null;
  search?: SearchProvider | null;
  terminal?: TerminalProvider | null;
}
