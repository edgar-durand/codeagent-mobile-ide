import { describe, expect, it } from 'vitest';
import {
  acceptBoth,
  acceptCurrent,
  acceptIncoming,
  applyConflictResolutionAll,
  detectConflicts,
  hasConflictMarkers,
} from './conflicts';

const FIX_SIMPLE = `line a
<<<<<<< HEAD
ours line 1
ours line 2
=======
theirs line 1
theirs line 2
>>>>>>> feature/foo
line z`;

const FIX_TWO_HUNKS = `prefix
<<<<<<< HEAD
A
=======
B
>>>>>>> branch
middle
<<<<<<< HEAD
C
=======
D
>>>>>>> branch
suffix`;

const FIX_NO_CONFLICT = `nothing special
here at all
even with a lone <<<<<<< inline
that should not match`;

const FIX_UNTERMINATED = `start
<<<<<<< HEAD
incomplete content
end (no separator)`;

const FIX_DIFF3 = `before
<<<<<<< HEAD
ours
||||||| base
common base
=======
theirs
>>>>>>> branch
after`;

describe('detectConflicts', () => {
  it('finds a single hunk with correct labels and bodies', () => {
    const h = detectConflicts(FIX_SIMPLE);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      currentLabel: 'HEAD',
      incomingLabel: 'feature/foo',
      currentLines: ['ours line 1', 'ours line 2'],
      incomingLines: ['theirs line 1', 'theirs line 2'],
    });
  });

  it('finds multiple sequential hunks', () => {
    expect(detectConflicts(FIX_TWO_HUNKS)).toHaveLength(2);
  });

  it('returns [] for content without conflicts', () => {
    expect(detectConflicts(FIX_NO_CONFLICT)).toEqual([]);
  });

  it('skips unterminated blocks rather than throwing', () => {
    expect(detectConflicts(FIX_UNTERMINATED)).toEqual([]);
  });

  it('skips diff3-style merges (out of scope for v1)', () => {
    expect(detectConflicts(FIX_DIFF3)).toEqual([]);
  });
});

describe('resolvers', () => {
  it('acceptCurrent keeps the "ours" body', () => {
    const out = acceptCurrent(FIX_SIMPLE, detectConflicts(FIX_SIMPLE)[0]!);
    expect(out).toBe(`line a
ours line 1
ours line 2
line z`);
  });

  it('acceptIncoming keeps the "theirs" body', () => {
    const out = acceptIncoming(FIX_SIMPLE, detectConflicts(FIX_SIMPLE)[0]!);
    expect(out).toBe(`line a
theirs line 1
theirs line 2
line z`);
  });

  it('acceptBoth concatenates ours then theirs', () => {
    const out = acceptBoth(FIX_SIMPLE, detectConflicts(FIX_SIMPLE)[0]!);
    expect(out).toBe(`line a
ours line 1
ours line 2
theirs line 1
theirs line 2
line z`);
  });

  it('applyConflictResolutionAll resolves every hunk in one pass', () => {
    const out = applyConflictResolutionAll(FIX_TWO_HUNKS, 'current');
    expect(out).toBe(`prefix
A
middle
C
suffix`);
  });
});

describe('hasConflictMarkers', () => {
  it('returns true when at least one start marker exists', () => {
    expect(hasConflictMarkers(FIX_SIMPLE)).toBe(true);
  });
  it('returns false when no start marker exists', () => {
    expect(hasConflictMarkers(FIX_NO_CONFLICT)).toBe(false);
  });
  it('returns false for content without the substring', () => {
    expect(hasConflictMarkers('plain old file content')).toBe(false);
  });
});
