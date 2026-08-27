/**
 * Ticket F4, the market paging helper.
 *
 * `/market/items/` is a DRF ViewSet and paginates at 20. The old code read
 * `.results` and stopped, so item 21 onwards did not exist as far as the shop
 * was concerned. The fix walks `next` — and a paging loop is exactly the kind
 * of code that is fine until the day the catalogue crosses a page boundary, so
 * it gets its own tests rather than being covered by hand.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

let api;
let fetchAllPages;
let MarketView;
let purchaseErrorMessage;

beforeEach(async () => {
  ({ default: api } = await import('@/lib/api'));
  api.get.mockReset();
  api.post.mockReset();
  ({ fetchAllPages, purchaseErrorMessage, default: MarketView } = await import('./MarketView'));
});

const page = (results, next = null) => ({ data: { results, next } });

describe('fetchAllPages', () => {
  it('walks every page, not just the first', () => {
    api.get
      .mockResolvedValueOnce(page([1, 2], '/market/items/?page=2'))
      .mockResolvedValueOnce(page([3, 4], '/market/items/?page=3'))
      .mockResolvedValueOnce(page([5]));

    return expect(fetchAllPages('/market/items/')).resolves.toEqual([1, 2, 3, 4, 5]);
  });

  it('stops at the page that has no next', async () => {
    api.get.mockResolvedValue(page([1, 2]));
    await fetchAllPages('/market/items/');
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('accepts a bare array, which is what the admin endpoints return', async () => {
    // The admin panel's responses are unpaginated by design — turning DRF
    // pagination on there empties every table silently.
    api.get.mockResolvedValue({ data: [7, 8, 9] });
    await expect(fetchAllPages('/market/items/')).resolves.toEqual([7, 8, 9]);
  });

  it('returns nothing rather than throwing on a response with no results key', async () => {
    api.get.mockResolvedValue({ data: {} });
    await expect(fetchAllPages('/market/items/')).resolves.toEqual([]);
  });

  it('handles an empty catalogue', async () => {
    api.get.mockResolvedValue(page([]));
    await expect(fetchAllPages('/market/items/')).resolves.toEqual([]);
  });

  it('refuses to follow next forever', async () => {
    // A server that always reports a next page would otherwise spin until the
    // tab dies. The cap is 50.
    api.get.mockResolvedValue(page([1], '/market/items/?page=99'));
    const items = await fetchAllPages('/market/items/');
    expect(api.get).toHaveBeenCalledTimes(50);
    expect(items).toHaveLength(50);
  });

  it('follows the url the server gives, not one it builds itself', async () => {
    api.get
      .mockResolvedValueOnce(page([1], 'https://api.example.invalid/market/items/?cursor=abc'))
      .mockResolvedValueOnce(page([2]));

    await fetchAllPages('/market/items/');
    expect(api.get).toHaveBeenNthCalledWith(
      2, 'https://api.example.invalid/market/items/?cursor=abc',
    );
  });
});

/**
 * Ticket: the market carries real products now — books at Asaxiy, kits at
 * Estes, shirts at the AMNH shop. Fuel is what a child earns from lessons and
 * it buys none of them, so a product with an `external_url` must not offer the
 * fuel button at all: it links out to the shop that actually sells it.
 *
 * The server refuses the trade as well (apps/market/tests.py). This is the half
 * a child sees, and the half that decides whether they understand that a real
 * product costs real money somewhere else.
 */
const REAL_PRODUCT = {
  slug: 'asaxiy-carl-sagan-cosmos',
  title_en: 'Cosmos — Carl Sagan',
  title_uz: 'Kosmos — Karl Sagan',
  title_ru: 'Космос — Карл Саган',
  description_en: 'The book behind the television series.',
  description_uz: '',
  description_ru: '',
  item_type: 'book',
  price: 0,
  cost_fuel: 0,
  external_url: 'https://asaxiy.uz/product/carl-sagan-cosmos',
  merchant: 'Asaxiy',
  external_price: null,
  currency: '',
  is_external: true,
};

const VIRTUAL_ITEM = {
  slug: 'falcon-9-model',
  title_en: 'Falcon 9 Model',
  title_uz: 'Falcon 9 modeli',
  title_ru: 'Модель Falcon 9',
  description_en: 'A model for your hangar.',
  description_uz: '',
  description_ru: '',
  item_type: 'spaceship',
  price: 45000,
  cost_fuel: 300,
  external_url: '',
  merchant: '',
  external_price: null,
  currency: '',
  is_external: false,
};

const catalogue = (...items) => ({ data: { results: items, next: null } });

describe('a real product sends the child to the shop that sells it', () => {
  it('offers a link to the merchant page, not a purchase button', async () => {
    api.get.mockResolvedValue(catalogue(REAL_PRODUCT));
    render(<MarketView />);

    const link = await screen.findByRole('link', { name: /asaxiy/i });
    expect(link).toHaveAttribute('href', REAL_PRODUCT.external_url);
    // A new tab, because the child is leaving us for somebody else's checkout.
    expect(link).toHaveAttribute('target', '_blank');
    // noopener keeps that page away from window.opener; noreferrer keeps our
    // URL out of the shop's logs.
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('spends no fuel when the link is used', async () => {
    api.get.mockResolvedValue(catalogue(REAL_PRODUCT));
    render(<MarketView />);

    await userEvent.click(await screen.findByRole('link', { name: /asaxiy/i }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('says the product is real and names the shop', async () => {
    api.get.mockResolvedValue(catalogue(REAL_PRODUCT));
    render(<MarketView />);

    expect(await screen.findByText(/real product/i)).toBeInTheDocument();
    expect(screen.getByText(/asaxiy/i)).toBeInTheDocument();
  });

  it('sends the child to the shop for the price rather than printing a made-up one', async () => {
    api.get.mockResolvedValue(catalogue(REAL_PRODUCT));
    render(<MarketView />);

    expect(await screen.findByText(/price is at the shop/i)).toBeInTheDocument();
    // price is 0 on these rows because nobody has checked it. "0 sum" on a book
    // is worse than saying nothing.
    expect(screen.queryByText(/0 sum/i)).toBeNull();
  });

  it('shows the shop price once somebody has checked it, in the shop currency', async () => {
    api.get.mockResolvedValue(catalogue({
      ...REAL_PRODUCT, external_price: '59.99', currency: 'USD',
    }));
    render(<MarketView />);

    expect(await screen.findByText(/\$\s?59\.99/)).toBeInTheDocument();
  });

  it('ignores a price with no currency, which could be read as either', async () => {
    api.get.mockResolvedValue(catalogue({ ...REAL_PRODUCT, external_price: '59.99', currency: '' }));
    render(<MarketView />);

    expect(await screen.findByText(/price is at the shop/i)).toBeInTheDocument();
    expect(screen.queryByText(/59\.99/)).toBeNull();
  });

  it('leaves the fuel purchase exactly as it was for a virtual item', async () => {
    const { useAuthStore } = await import('@/store/useAuthStore');
    useAuthStore.setState({ isAuthenticated: true });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    api.get.mockResolvedValue(catalogue(VIRTUAL_ITEM));
    api.post.mockResolvedValue({ data: {} });
    render(<MarketView />);

    const button = await screen.findByRole('button', { name: /to cart/i });
    await userEvent.click(button);

    expect(api.post).toHaveBeenCalledWith('/market/purchase/', { item_slug: 'falcon-9-model' });
    expect(screen.queryByRole('link', { name: /open at the shop/i })).toBeNull();

    useAuthStore.setState({ isAuthenticated: false });
  });
});

/**
 * A refused purchase has to read in the reader's language.
 *
 * The server refuses a real product with an English sentence — correct for an
 * API client, wrong for a child reading the shop in Uzbek. The response carries
 * `external_url` and `merchant` so the page can say it properly instead of
 * echoing our English back.
 */
describe('purchaseErrorMessage', () => {
  const t = (_ns, key) => `t:${key}`;

  it('says it in the reader language when the item is sold elsewhere', () => {
    const message = purchaseErrorMessage(
      {
        detail: '"Cosmos" is a real product sold by Asaxiy for money.',
        external_url: 'https://asaxiy.uz/product/carl-sagan-cosmos',
        merchant: 'Asaxiy',
      },
      t,
    );

    expect(message).toBe('t:realProductNote (Asaxiy)');
    expect(message).not.toContain('real product sold by');
  });

  it('leaves the shop out when the server did not name one', () => {
    expect(
      purchaseErrorMessage({ external_url: 'https://estesrockets.com/' }, t),
    ).toBe('t:realProductNote');
  });

  it('still shows what the server said for every other refusal', () => {
    expect(
      purchaseErrorMessage({ detail: 'Not enough fuel. Need 500, have 20.' }, t),
    ).toBe('Not enough fuel. Need 500, have 20.');
  });

  it('falls back when the request never reached the server', () => {
    expect(purchaseErrorMessage(undefined, t)).toBe('t:purchaseFailed');
  });
});
