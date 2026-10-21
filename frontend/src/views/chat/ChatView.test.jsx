/**
 * The room was fetched whole every five seconds.
 *
 * Audit, 21 Oct 2026. Every open chat tab asked for the last fifty messages
 * every five seconds whether anything had changed, hidden or not — a class of
 * thirty was six requests a second for nothing. And each answer replaced the
 * list, which scrolled the reader back to the bottom mid-sentence. The tab now
 * asks only for what is newer than its last message, and nothing while hidden.
 */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let ChatView;
let useAuthStore;

const message = (id, content) => ({
  id, user_id: 2, username: 'bek', first_name: 'Bek', avatar_url: null, content,
  created_at: '2026-10-22T10:00:00Z',
});

let roomReplies;

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Element.prototype.scrollIntoView = vi.fn();
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  roomReplies = [[message(1, 'salom'), message(2, 'qalaysan')]];
  api.get.mockImplementation((url, config) => {
    if (url === '/chat/rooms/') return Promise.resolve({ data: [{ slug: 'general', name: 'General' }] });
    if (url === '/chat/settings/') return Promise.resolve({ data: { report_reasons: [], can_post: true } });
    if (url === '/chat/rooms/general/messages/') {
      const next = config?.params?.after ? roomReplies.shift() ?? [] : roomReplies.shift() ?? [];
      return Promise.resolve({ data: next });
    }
    return Promise.resolve({ data: [] });
  });
  ({ default: ChatView } = await import('./ChatView'));
  ({ useAuthStore } = await import('@/store/useAuthStore'));
  useAuthStore.setState({ user: { username: 'aziz', email_verified: true }, isAuthenticated: true });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

const roomCalls = () => api.get.mock.calls.filter(([url]) => url === '/chat/rooms/general/messages/');

function show() {
  render(
    <MemoryRouter>
      <ChatView />
    </MemoryRouter>,
  );
}

describe('polling the room', () => {
  it('asks only for what is newer than the last message it has', async () => {
    roomReplies.push([message(3, 'yaxshi')]);
    show();
    await screen.findByText('qalaysan');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(roomCalls().at(-1)[1]).toEqual({ params: { after: 2 } });
    expect(await screen.findByText('yaxshi')).toBeInTheDocument();
    expect(screen.getByText('salom')).toBeInTheDocument();
  });

  it('asks for nothing while the tab is hidden', async () => {
    show();
    await screen.findByText('qalaysan');
    const before = roomCalls().length;

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await act(() => vi.advanceTimersByTimeAsync(15000));

    expect(roomCalls().length).toBe(before);
  });
});
