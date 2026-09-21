(() => {
  'use strict';

  const ACCOUNTS_KEY = 'growth-calendar-accounts-v1';
  const SESSION_KEY = 'growth-calendar-session-v1';
  const PBKDF2_ITERATIONS = 120000;

  function normalizeUsername(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function isValidUsername(value) {
    return /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,20}$/u.test(String(value || '').trim());
  }

  function getAccounts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function bytesToHex(bytes) {
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function randomSalt() {
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return bytesToHex(bytes);
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }

  function fallbackHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fallback-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  async function derivePassword(password, salt, iterations, requestedAlgorithm = "auto") {
    if (!globalThis.crypto?.subtle) return { algorithm: 'fallback', hash: fallbackHash(`${salt}:${password}`) };
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256'
    }, keyMaterial, 256);
    return { algorithm: 'PBKDF2-SHA256', hash: bytesToHex(bits) };
  }

  function safeEqual(left, right) {
    const a = String(left || '');
    const b = String(right || '');
    if (a.length !== b.length) return false;
    let result = 0;
    for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
    return result === 0;
  }

  function publicUser(account, extra = {}) {
    return { id: account.key, username: account.username, ...extra };
  }

  function getCurrentUser() {
    const key = localStorage.getItem(SESSION_KEY);
    if (!key) return null;
    const account = getAccounts()[key];
    return account ? publicUser(account) : null;
  }

  async function register(username, password) {
    const displayName = String(username || '').trim();
    if (!isValidUsername(displayName)) throw new Error('INVALID_USERNAME');
    if (String(password || '').length < 6) throw new Error('WEAK_PASSWORD');
    const key = normalizeUsername(displayName);
    const accounts = getAccounts();
    if (accounts[key]) throw new Error('ACCOUNT_EXISTS');
    const isFirstAccount = Object.keys(accounts).length === 0;
    const salt = randomSalt();
    const derived = await derivePassword(password, salt, PBKDF2_ITERATIONS);
    const account = {
      key,
      username: displayName,
      salt,
      algorithm: derived.algorithm,
      iterations: derived.algorithm === 'PBKDF2-SHA256' ? PBKDF2_ITERATIONS : 0,
      hash: derived.hash,
      createdAt: new Date().toISOString()
    };
    accounts[key] = account;
    saveAccounts(accounts);
    localStorage.setItem(SESSION_KEY, key);
    return publicUser(account, { isFirstAccount });
  }

  async function login(username, password) {
    const key = normalizeUsername(username);
    const account = getAccounts()[key];
    if (!account) throw new Error('INVALID_CREDENTIALS');
    const derived = await derivePassword(password, account.salt, account.iterations || PBKDF2_ITERATIONS, account.algorithm);
    if (derived.algorithm !== account.algorithm || !safeEqual(derived.hash, account.hash)) throw new Error('INVALID_CREDENTIALS');
    localStorage.setItem(SESSION_KEY, key);
    return publicUser(account);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  window.GrowthCalendarAuth = {
    register,
    login,
    currentUser: getCurrentUser,
    logout,
    normalizeUsername,
    isValidUsername
  };
})();