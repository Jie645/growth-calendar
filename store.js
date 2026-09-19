(() => {
  'use strict';

  const DB_NAME = 'growth-calendar-db';
  const DB_VERSION = 1;
  const STORE_NAME = 'records';
  const LOCAL_KEY = 'growth-calendar-records-v1';
  const MAX_IMAGES = 6;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  const today = new Date();
  const todayKey = dateKey(today);
  const demoMode = new URLSearchParams(location.search).has('demo');

  const state = {
    records: new Map(),
    selectedDate: todayKey,
    currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    currentView: 'calendar',
    editorDate: todayKey,
    editorImages: [],
    timelineQuery: '',
    demoMode,
    dbAvailable: true
  };

  const Store = (() => {
    let dbPromise = null;
    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'date' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
      });
      return dbPromise;
    }

    async function all() {
      try {
        const db = await open();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const request = tx.objectStore(STORE_NAME).getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        state.dbAvailable = false;
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    }

    async function put(record) {
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        state.dbAvailable = false;
        const records = new Map((await all()).map(item => [item.date, item]));
        records.set(record.date, record);
        localStorage.setItem(LOCAL_KEY, JSON.stringify([...records.values()]));
      }
    }

    async function putMany(records) {
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          records.forEach(record => store.put(record));
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        state.dbAvailable = false;
        const merged = new Map((await all()).map(item => [item.date, item]));
        records.forEach(record => merged.set(record.date, record));
        localStorage.setItem(LOCAL_KEY, JSON.stringify([...merged.values()]));
      }
    }

    async function remove(date) {
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(date);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        state.dbAvailable = false;
        const records = new Map((await all()).map(item => [item.date, item]));
        records.delete(date);
        localStorage.setItem(LOCAL_KEY, JSON.stringify([...records.values()]));
      }
    }

    async function clear() {
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        state.dbAvailable = false;
        localStorage.removeItem(LOCAL_KEY);
      }
    }

    return { all, put, putMany, remove, clear };
  })();

  function pad(value) { return String(value).padStart(2, '0'); }
  function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function parseDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  function addDays(date, amount) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function sameMonth(date, year, month) { return date.getFullYear() === year && date.getMonth() === month; }
  function formatLongDate(key) {
    const date = parseDateKey(key);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  function formatFullDate(key) {
    const date = parseDateKey(key);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }
  function hasText(value) { return Boolean(String(value || '').trim()); }
  function recordText(record) {
    if (!record) return '';
    if (hasText(record.text)) return String(record.text).trim();
    return [record.action, record.learning, record.next].map(value => String(value || '').trim()).filter(Boolean).join('\n\n');
  }
  function recordHasContent(record) {
    return Boolean(record && (hasText(recordText(record)) || (record.images || []).length));
  }
  function contentLength(record) {
    return recordText(record).length;
  }
  function calculateStats() {
    const keys = [...state.records.keys()].filter(key => recordHasContent(state.records.get(key))).sort();
    let longest = 0;
    let running = 0;
    let previous = null;
    keys.forEach(key => {
      const current = parseDateKey(key);
      if (previous && dateKey(addDays(previous, 1)) === key) running += 1;
      else running = 1;
      longest = Math.max(longest, running);
      previous = current;
    });

    let streak = 0;
    let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!state.records.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    while (state.records.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    const monthCount = keys.filter(key => sameMonth(parseDateKey(key), today.getFullYear(), today.getMonth())).length;
    const photos = [...state.records.values()].reduce((sum, record) => sum + ((record.images || []).length), 0);
    const words = [...state.records.values()].reduce((sum, record) => sum + contentLength(record), 0);
    return { total: keys.length, streak, longest, monthCount, photos, words };
  }

  window.GrowthCalendar = {
    DB_NAME, STORE_NAME, MAX_IMAGES, MAX_FILE_SIZE, WEEKDAYS, MONTH_NAMES,
    today, todayKey, state, Store,
    pad, dateKey, parseDateKey, addDays, daysInMonth, sameMonth,
    formatLongDate, formatFullDate, escapeHtml, hasText, recordText, recordHasContent, contentLength, calculateStats
  };
})();

