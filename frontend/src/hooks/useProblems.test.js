/**
 * 28 Aug 2026, found by opening /learn/problems against a running server: the
 * page said "20 problems" and the database held 30.
 *
 * `/courses/problems/` is paginated at 20. The hook read `data.results` and
 * stopped, so the last ten problems of the Masalalar set were not merely
 * unreachable — the page did not know they existed and said so in its own
 * heading. This is the "assume a list endpoint is unpaginated" trap named in
 * CONTRIBUTING's frontend lane, and the set had already been cut from a
 * dishonest 145 to an honest 30; showing 20 of those quietly undid a third of
 * what was left.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

let api;
let useProblems;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  ({ useProblems } = await import('./useProblems'));
});

const rows = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, number: from + i }));

describe('useProblems', () => {
  it('follows the pages so the whole set is reachable', async () => {
    api.get
      .mockResolvedValueOnce({
        data: { count: 30, next: '/courses/problems/?page=2&sphere=problems', results: rows(1, 20) },
      })
      .mockResolvedValueOnce({ data: { count: 30, next: null, results: rows(21, 30) } });

    const { result } = renderHook(() => useProblems());
    await waitFor(() => expect(result.current.state).toBe('ready'));

    expect(result.current.problems).toHaveLength(30);
    expect(result.current.problems.at(-1).number).toBe(30);
  });

  it('still works when the endpoint answers with a bare array', async () => {
    // Two contracts the admin panel depends on say responses stay bare arrays,
    // so the hook has to keep coping with both shapes.
    api.get.mockResolvedValue({ data: rows(1, 30) });

    const { result } = renderHook(() => useProblems());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.problems).toHaveLength(30);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('keeps the pages it did get when a later one fails', async () => {
    // Twenty problems beats an error screen; the alternative is that one bad
    // request hides a set that mostly loaded.
    api.get
      .mockResolvedValueOnce({
        data: { count: 30, next: '/courses/problems/?page=2', results: rows(1, 20) },
      })
      .mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useProblems());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.problems).toHaveLength(20);
  });

  it('says so when the very first page fails', async () => {
    api.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useProblems());
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.problems).toEqual([]);
  });

  it('stops rather than following pages for ever', async () => {
    // A server that always answers with a `next` must not spin the browser.
    api.get.mockResolvedValue({
      data: { count: 9999, next: '/courses/problems/?page=2', results: rows(1, 20) },
    });

    const { result } = renderHook(() => useProblems());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(api.get.mock.calls.length).toBeLessThanOrEqual(25);
  });
});
