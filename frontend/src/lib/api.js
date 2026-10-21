import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
});

// Set lazily from useAuthStore to avoid circular dep
let _getAccess = () => null;
let _getRefresh = () => null;
let _onLogout = () => {};
let _onTokenRefresh = (_newAccess, _newRefresh) => {};

export const setupApiAuth = (getAccess, getRefresh, onLogout, onTokenRefresh) => {
  _getAccess = getAccess;
  _getRefresh = getRefresh;
  _onLogout = onLogout;
  if (onTokenRefresh) _onTokenRefresh = onTokenRefresh;
};

api.interceptors.request.use((config) => {
  const token = _getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * One refresh at a time, shared by everybody who needs it.
 *
 * The backend rotates refresh tokens and blacklists the one just used. When the
 * access token expired, every request in flight came back 401 together and each
 * refreshed on its own with the same token: the first won, the rest were refused,
 * and the pupil was signed out on the first page they opened that morning.
 */
let refreshing = null;

function refreshTokens() {
  if (!refreshing) {
    const sent = _getRefresh();
    refreshing = axios
      .post(`${import.meta.env.VITE_API_URL}/auth/token/refresh/`, { refresh: sent })
      .then(({ data }) => {
        // The response carries a NEW refresh token and the one we sent is now
        // blacklisted. Dropping data.refresh meant the next refresh went out
        // with a dead token and every user was forced back to /login about an
        // hour after signing in. Persist both.
        _onTokenRefresh(data.access, data.refresh);
        return data.access;
      })
      .catch((err) => {
        // Another tab rotated it first; its pair reaches this one through the
        // storage event (useAuthStore). That is not a reason to sign out.
        const now = _getRefresh();
        if (now && now !== sent) return _getAccess();
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function retryAfterRefresh(client) {
  return async (error) => {
    if (error.response?.status !== 401 || !error.config) return Promise.reject(error);
    const { config } = error;
    // Only redirect to login if user was authenticated (had an access token).
    // Unauthenticated requests that get 401 should fail silently.
    if (!_getRefresh()) {
      if (_getAccess()) _onLogout();
      return Promise.reject(error);
    }
    // Refused with a token we have just been given: the account is gone or
    // switched off, and refreshing again would go round for ever.
    if (config._retried) {
      _onLogout();
      return Promise.reject(error);
    }
    config._retried = true;
    try {
      const sentWith = config.headers?.Authorization;
      const current = _getAccess();
      // Sent before somebody else's refresh landed: the new token is already here.
      const access = sentWith && current && sentWith !== `Bearer ${current}`
        ? current
        : await refreshTokens();
      config.headers.Authorization = `Bearer ${access}`;
      return client(config);
    } catch {
      _onLogout();
      return Promise.reject(error);
    }
  };
}

api.interceptors.response.use((res) => res, retryAfterRefresh(api));

/**
 * Long-running requests.
 *
 * The shared client gives up after 10 s while the AI endpoint waits up to 20 s
 * on Gemini, so every longer answer was cut off in the browser even though the
 * server had produced it. Same interceptors, longer patience.
 */
export const slowApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 45000,
});

slowApi.interceptors.request.use((config) => {
  const token = _getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// It had the request half only, so after eight hours every AI answer failed
// with 401 until some other request happened to refresh the token.
slowApi.interceptors.response.use((res) => res, retryAfterRefresh(slowApi));

export default api;
