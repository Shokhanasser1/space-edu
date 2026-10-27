// Loaded from index.html before first paint. A file rather than an inline
// <script> so the Content-Security-Policy (deploy/web/Caddyfile) does not
// have to allow inline scripts for the sake of one line.
(function() {
  try {
    // The store (src/store/useUserStore.js) sets this properly once it
    // loads; this is the same guess it makes, made before first paint so
    // the page never announces itself as English to a Russian reader.
    const shortLang = (navigator.language || '').split('-')[0].toLowerCase();
    if (['uz', 'ru'].includes(shortLang)) {
      document.documentElement.lang = shortLang;
    }
  } catch (e) {}
})();
