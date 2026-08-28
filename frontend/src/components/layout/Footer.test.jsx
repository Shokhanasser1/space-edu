/**
 * Every link in the footer has to go somewhere real.
 *
 * This file exists because the footer has now got the same thing wrong twice.
 *
 * 1. Commit 38b428c: all five legal links were `<Link to="#">`. React Router
 *    reads "#" as a relative path, so on /store every one of them rendered
 *    href="/store" — pointer cursor, hover colour, and clicking re-navigated to
 *    the shop. They were turned into plain labels, because none of the five
 *    pages had been written.
 * 2. The four social links and the two icon buttons beside the site
 *    description were plain `href="#"`, which is not a link either: it scrolls
 *    to the top and nothing else. Four of them named accounts — Instagram, X,
 *    YouTube — that this project has never been shown to have.
 *
 * The rule underneath both, and what these tests pin: a footer link either
 * arrives somewhere that exists, or it is not a link. On a site used by
 * 10-to-18-year-olds a "Contact Us" or a "Privacy Policy" that looks clickable
 * and leads nowhere is worse than plain text — it implies there is something
 * there to reach.
 *
 * The route list is read out of App.jsx rather than copied, so a link to a page
 * somebody later deletes fails here instead of in a child's browser.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Footer from './Footer';

const SRC = resolve(__dirname, '../..');
const PUBLIC_DIR = resolve(SRC, '../public');

/**
 * Comments stripped, the same way liveDataHonesty.test.jsx does it: this file
 * checks what the footer *ships*, and the footer's own comments quote the
 * `<Link to="#">` they exist to warn about.
 */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FOOTER_SOURCE = stripComments(readFileSync(resolve(__dirname, 'Footer.jsx'), 'utf8'));

/**
 * Every literal path App.jsx routes. Parameterised routes and the catch-all
 * are dropped: the footer only ever links to fixed pages, and `*` matches
 * everything, which would make this check vacuous.
 */
const ROUTES = new Set(
  [...readFileSync(resolve(SRC, 'App.jsx'), 'utf8').matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !path.includes(':') && path !== '*'),
);

/** Two pages, neither the site root, so a link that resolves relatively moves. */
const CURRENT_PAGE = '/market';
const OTHER_PAGE = '/calendar';

function footerLinks(at = CURRENT_PAGE) {
  render(
    <MemoryRouter initialEntries={[at]}>
      <Footer />
    </MemoryRouter>,
  );
  return [...document.querySelectorAll('footer a')].map((a) => ({
    href: a.getAttribute('href'),
    text: (a.textContent || a.getAttribute('aria-label') || '').trim(),
    target: a.getAttribute('target'),
    rel: a.getAttribute('rel'),
  }));
}

describe('the links in the footer', () => {
  it('renders some, so the rest of this file is not vacuous', () => {
    expect(ROUTES.size).toBeGreaterThan(10);
    expect(footerLinks().length).toBeGreaterThan(0);
  });

  it('has none that points at nothing', () => {
    for (const link of footerLinks()) {
      expect(link.href, `"${link.text}" has no destination`).toBeTruthy();
      expect(link.href, `"${link.text}" links to "#", which goes nowhere`).not.toBe('#');
      expect(link.href, `"${link.text}" is a bare fragment`).not.toMatch(/^#/);
    }
  });

  it('has none whose destination depends on where you happen to be', () => {
    // The exact shape of 38b428c: <Link to="#"> is a *relative* path, so it
    // resolved against the current location and rendered an href back to it.
    // The tell is that the same link points somewhere else on another page —
    // a real destination does not move.
    const here = footerLinks();
    cleanup();
    const there = footerLinks(OTHER_PAGE);

    expect(there.map((l) => l.href)).toEqual(here.map((l) => l.href));
    for (const link of there) {
      expect(link.href, `"${link.text}" points back at the current page`).not.toBe(OTHER_PAGE);
    }
  });

  it('sends every internal link to a page that exists', () => {
    for (const link of footerLinks()) {
      if (!link.href.startsWith('/')) continue;
      const [path] = link.href.split(/[?#]/);
      // A path with a suffix is a file out of public/, not a React route.
      if (/\.[a-z0-9]+$/i.test(path)) {
        expect(
          existsSync(resolve(PUBLIC_DIR, path.slice(1))),
          `"${link.text}" points at ${path}, which is not in public/`,
        ).toBe(true);
        continue;
      }
      expect(
        ROUTES.has(path),
        `"${link.text}" points at ${path}, which App.jsx does not route`,
      ).toBe(true);
    }
  });

  it('opens every outside link in a new tab, without leaking the page', () => {
    for (const link of footerLinks()) {
      if (link.href.startsWith('/')) continue;
      expect(link.href, `"${link.text}" is an outside link over plain http`).toMatch(/^https:\/\//);
      expect(link.target, `"${link.text}" replaces the site`).toBe('_blank');
      expect(link.rel || '', `"${link.text}" has no rel guard`).toMatch(/noreferrer/);
    }
  });

  it('ships no placeholder destination in the source', () => {
    // Both past failures are one grep. A `to="#"` or an `href="#"` in this file
    // is a link somebody meant to fill in later and did not.
    expect(FOOTER_SOURCE).not.toMatch(/href=["']#["']/);
    expect(FOOTER_SOURCE).not.toMatch(/to=["']#["']/);
    expect(FOOTER_SOURCE).not.toMatch(/(?:href|to)=["']\s*["']/);
    expect(FOOTER_SOURCE).not.toMatch(/(?:href|to)=["']javascript:/i);
  });
});

describe('the contact details', () => {
  /**
   * The other way this can go wrong, and the reason the block was built with
   * its values empty: nobody has published a support address, a phone number
   * or a channel for this project. A plausible-looking one filled in to make
   * the page feel finished sends a child or a parent nowhere, or to a real
   * stranger. The same rule the Live page follows for Samarkand-2028 — say we
   * do not have it, do not invent it.
   */
  it('does not point at the state space agency as though it were us', () => {
    // https://t.me/uzcosmos_official was suggested for this footer. It
    // resolves, which is why it is worth naming here: it is the official
    // channel of Uzcosmos, the national space agency — its own description
    // gives gov.uz/oz/uzspace and the agency's switchboard. It is a real place
    // that has nothing to do with this education platform, so a child asking
    // there about a lesson reaches a government press office. Checked
    // 28 August 2026. If the agency ever does agree to take our enquiries,
    // that is a decision with a name attached, and this test should be
    // changed by whoever has it.
    expect(FOOTER_SOURCE).not.toMatch(/uzcosmos_official/);
  });

  it('ships no filler standing in for a contact', () => {
    const filler = [
      /example\.(com|org)/i,
      /your[-_.]?(email|mail|number)/i,
      /\bXXX+\b/,
      /\+998[\s(]*\d{2}[\s)]*[X_]{3}/i,
      /lorem/i,
    ];
    for (const pattern of filler) {
      expect(
        FOOTER_SOURCE,
        `Footer.jsx carries a placeholder matching ${pattern}. An unfilled `
        + 'contact belongs in the CONTACTS list with value: null, which renders '
        + 'as "not published yet" — it must never render as a fake value.',
      ).not.toMatch(pattern);
    }
  });

  it('says a missing detail is missing, rather than hiding it', () => {
    render(
      <MemoryRouter initialEntries={[CURRENT_PAGE]}>
        <Footer />
      </MemoryRouter>,
    );
    const footer = document.querySelector('footer');
    // Three labelled rows, each carrying the translated "not published yet".
    const notPublished = [...footer.querySelectorAll('[data-contact-missing]')];
    expect(notPublished.length).toBeGreaterThan(0);
    for (const row of notPublished) {
      expect(row.textContent.trim().length).toBeGreaterThan(0);
    }
  });
});
