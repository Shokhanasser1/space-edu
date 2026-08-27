/**
 * Google Identity Services, loaded on demand and only when it is configured.
 *
 * No package for this. `@react-oauth/google` is a wrapper around the same script
 * this file injects, and the script has to come from accounts.google.com either
 * way — a dependency would add a supply chain without removing the third-party
 * host, which is the part that actually matters here.
 *
 * That host is a deliberate exception to a rule this project otherwise keeps.
 * Everything else is served from this site, after `Earth3D` fetched Three.js
 * from cdnjs and left the front page showing a black circle wherever cdnjs was
 * slow or blocked. Google's button cannot be self-hosted: the script and the
 * origin it runs on are what Google signs the assertion against. So it is the
 * one script from somewhere else, it is loaded only on the sign-in screens, and
 * a failure to load leaves the password form working rather than the page
 * broken.
 *
 * Without VITE_GOOGLE_CLIENT_ID nothing here runs, nothing is injected and no
 * request is made. CI builds without it, and so does anybody who has not set one
 * up — for them the button is simply not there.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;

export function googleClientId() {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

export function isGoogleEnabled() {
  return Boolean(googleClientId());
}

/** Inject the script once, and hand back the same promise to everybody after. */
export function loadGoogleIdentity() {
  if (!isGoogleEnabled()) {
    return Promise.reject(new Error('Google sign-in is not configured'));
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing && window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    const script = existing || document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error('Google Identity loaded without accounts.id'));
    });
    script.addEventListener('error', () => {
      // Let the next attempt try again: this fails for a blocked host or a bad
      // connection, both of which come back.
      scriptPromise = null;
      reject(new Error('Could not load Google Identity'));
    });
    if (!existing) document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Render Google's own button into `element` and call `onCredential` with the
 * ID token it returns.
 *
 * Google's button rather than one of ours on purpose: their branding rules ask
 * for it, and a look-alike that posts to the same endpoint is what a phishing
 * page looks like. Returns a cleanup function.
 */
export async function renderGoogleButton(element, { onCredential, onError, text = 'signin_with' }) {
  const google = await loadGoogleIdentity();

  google.accounts.id.initialize({
    client_id: googleClientId(),
    callback: (response) => {
      if (response?.credential) onCredential(response.credential);
      else onError?.(new Error('Google returned no credential'));
    },
    // One Tap is off. It signs a returning visitor in the moment a page loads,
    // which is the wrong default for a shared school computer where the last
    // person to use the browser is usually not this one.
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  google.accounts.id.renderButton(element, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text,
    logo_alignment: 'left',
    width: element.offsetWidth || 320,
  });

  return () => {
    try {
      google.accounts.id.cancel();
    } catch {
      // Nothing to cancel. Not empty: eslint's no-empty is an error here
      // because a swallowed catch is how three real bugs stayed hidden.
      onError?.(new Error('Google Identity would not cancel'));
    }
  };
}
