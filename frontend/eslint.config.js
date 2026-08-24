import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * What this is for.
 *
 * Six people writing JavaScript in the same repository will not agree about
 * unused imports, and they should not have to: a linter is cheaper than an
 * argument in a review. More to the point, three of the defects the 22 August
 * audit found were the kind a linter catches for free — `/store` threw a
 * ReferenceError on its first product card and took the whole app down, and an
 * `except`-style empty block hid failures for months.
 *
 * The bar is deliberately set where it can be held: **errors block a merge,
 * warnings do not.** A linter that reports 249 problems on the day it arrives
 * teaches everyone to ignore it. Warnings are the backlog; drive them down and
 * promote rules as they reach zero.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // The two that catch real bugs. A hook called conditionally is broken in
      // a way that shows up as impossible state three screens away.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // eslint-plugin-react-hooks v7 ships the React Compiler rules. They fire
      // 61 times here and almost all of it is react-three-fiber: mutating a ref
      // inside useFrame is how that library is meant to be used, and the game
      // and the 3D views do it on every frame on purpose. Off until somebody
      // has read them against the Three.js code specifically, rather than
      // switched on to be seen switching something on.
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',

      // Unused things are noise in a review, not a crime. `_` prefixed and
      // SCREAMING_CASE are deliberate.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],

      // An empty catch is how the sign-out failure stayed invisible: the
      // request 401'd for weeks and `.catch(() => {})` swallowed it. Say why
      // it is empty, in the block, and this rule is satisfied.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  {
    // Node scripts and config files run outside the browser.
    files: ['scripts/**', '*.config.js', 'vitest.setup.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // `.cjs` is the only thing here that is CommonJS, and `require` in it is
    // not a typo. Everything else under scripts/ is an ES module.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
];
