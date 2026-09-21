(() => {
  'use strict';
  const G = window.GrowthCalendar;
  const UI = window.GrowthCalendarUI;
  const Auth = window.GrowthCalendarAuth;
  const { state, Store, todayKey, MAX_IMAGES, MAX_FILE_SIZE, WEEKDAYS, dateKey, parseDateKey, addDays, formatFullDate, escapeHtml, hasText, recordText, recordHasContent } = G;
  const elements = UI.elements;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const appShell = $('#appShell');
  const authShell = $('#authShell');
  const authForm = $('#authForm');
  const authUsername = $('#authUsername');
  const authPassword = $('#authPassword');
  const authConfirm = $('#authConfirm');
  const authConfirmWrap = $('#authConfirmWrap');
  const authMessage = $('#authMessage');
  const authSubmit = $('#authSubmit');
  const authTitle = $('#authTitle');
  const authSubtitle = $('#authSubtitle');
  const userName = $('#userName');
  const userAvatar = $('#userAvatar');
  let appStarted = false;
  let authMode = 'login';

  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }

  function openEditor(key) {
    state.selectedDate = key;
    const date = parseDateKey(key);
    state.currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    state.editorDate = key;
    const record = state.records.get(key);
    state.editorImages = record?.images ? record.images.map(image => ({ ...image })) : [];
    elements.editorWeekday.textContent = WEEKDAYS[date.getDay()].toUpperCase();
    elements.editorDate.textContent = formatFullDate(key);
    elements.recordInput.value = recordText(record);
    elements.deleteRecordBtn.classList.toggle('hidden', !recordHasContent(record));
    renderEditorImages();
    if (!elements.recordDialog.open) elements.recordDialog.showModal();
    setTimeout(() => elements.recordInput.focus(), 80);
  }

  function renderEditorImages() {
    elements.imagePreview.innerHTML = state.editorImages.map((image, index) => `<div class="image-item"><img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || '记录图片')}"><button type="button" data-remove-image="${index}" aria-label="移除图片"><svg><use href="#i-close"></use></svg></button></div>`).join('');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  async function compressImage(file) {
    const original = await fileToDataUrl(file);
    const image = await loadImage(original);
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  async function handleImageFiles(fileList) {
    const files = [...fileList].filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    const remaining = MAX_IMAGES - state.editorImages.length;
    if (remaining <= 0) return toast(`最多添加 ${MAX_IMAGES} 张图片`, 'error');
    const accepted = files.slice(0, remaining);
    const oversized = accepted.filter(file => file.size > MAX_FILE_SIZE);
    if (oversized.length) toast(`已跳过 ${oversized.length} 张超过 10MB 的图片`, 'error');
    const validFiles = accepted.filter(file => file.size <= MAX_FILE_SIZE);
    if (!validFiles.length) return;
    toast('正在压缩图片…');
    try {
      for (const file of validFiles) {
        state.editorImages.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          name: file.name,
          dataUrl: await compressImage(file)
        });
      }
      renderEditorImages();
      toast(`已添加 ${validFiles.length} 张图片`);
    } catch (error) {
      console.error(error);
      toast('图片处理失败，请换一张试试', 'error');
    }
  }

  async function saveCurrentRecord(event) {
    event.preventDefault();
    const date = state.editorDate;
    const existing = state.records.get(date);
    const record = {
      date,
      owner: state.user.id,
      text: elements.recordInput.value.trim(),
      images: state.editorImages,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!recordHasContent(record)) return toast('至少写下一项内容，再保存记录', 'error');
    if (state.demoMode) {
      state.records.set(date, record);
      toast('示例模式：记录仅在本次浏览中保留');
    } else {
      await Store.put(record);
      state.records.set(date, record);
      toast('这一天的成长痕迹已保存');
    }
    closeDialog(elements.recordDialog);
    UI.renderAll();
  }

  async function deleteRecord(key, ask = true) {
    if (ask && !window.confirm(`确定删除 ${formatFullDate(key)} 的记录吗？此操作不可撤销。`)) return;
    if (!state.demoMode) await Store.remove(key, state.user.id);
    state.records.delete(key);
    closeDialog(elements.recordDialog);
    UI.renderAll();
    toast('记录已删除');
  }

  function toast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type === 'error' ? 'error' : ''}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { elements.toast.className = 'toast'; }, 2300);
  }

  const WEATHER_CACHE_KEY = 'growth-calendar-weather-v1';
  let weatherRefreshTimer = null;

  function weatherPresentation(code, isDay = 1) {
    const map = {
      0: [isDay ? '☀️' : '🌙', isDay ? '晴' : '晴朗夜空'],
      1: ['🌤️', '大部晴朗'], 2: ['⛅', '多云'], 3: ['☁️', '阴'],
      45: ['🌫️', '有雾'], 48: ['🌫️', '雾凇'],
      51: ['🌦️', '小毛毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌧️', '强毛毛雨'],
      56: ['🌧️', '冻毛毛雨'], 57: ['🌧️', '强冻毛毛雨'],
      61: ['🌦️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'],
      66: ['🌧️', '冻雨'], 67: ['🌧️', '强冻雨'],
      71: ['🌨️', '小雪'], 73: ['🌨️', '中雪'], 75: ['❄️', '大雪'], 77: ['❄️', '米雪'],
      80: ['🌦️', '小阵雨'], 81: ['🌧️', '中阵雨'], 82: ['⛈️', '强阵雨'],
      85: ['🌨️', '小阵雪'], 86: ['❄️', '强阵雪'],
      95: ['⛈️', '雷雨'], 96: ['⛈️', '雷暴伴冰雹'], 99: ['⛈️', '强雷暴伴冰雹']
    };
    return map[code] || ['🌡️', '天气变化'];
  }

  async function fetchJson(url, timeout = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function browserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation unavailable'));
      navigator.geolocation.getCurrentPosition(
        position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, source: 'geo' }),
        reject,
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    });
  }

  async function networkLocation() {
    const data = await fetchJson('https://ipwho.is/', 6000);
    if (!data || data.success === false || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) throw new Error('IP location unavailable');
    return { latitude: data.latitude, longitude: data.longitude, source: 'ip', city: data.city || data.region || data.country || '当前位置' };
  }

  async function bestLocation() {
    const geolocation = browserLocation().catch(() => null);
    const precise = await Promise.race([
      geolocation,
      new Promise(resolve => setTimeout(() => resolve(null), 2500))
    ]);
    if (precise) return precise;
    try { return await networkLocation(); }
    catch (error) { return { latitude: 31.2304, longitude: 121.4737, source: 'default', city: '上海 · 默认位置' }; }
  }

  async function resolveLocationName(location) {
    try {
      const data = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=zh`, 6000);
      return data.city || data.locality || data.principalSubdivision || data.countryName || '当前位置';
    } catch (error) {
      return location.city || `${location.latitude.toFixed(1)}°, ${location.longitude.toFixed(1)}°`;
    }
  }

  function renderWeather(data, stale = false) {
    if (!data) return;
    const presentation = weatherPresentation(data.weatherCode, data.isDay);
    elements.weatherIcon.textContent = presentation[0];
    elements.weatherTemp.textContent = `${Math.round(data.temperature)}°`;
    elements.weatherLocation.textContent = stale ? `${data.location} · 缓存` : data.location;
    elements.weatherDesc.textContent = `${presentation[1]} ${Math.round(data.high)}° / ${Math.round(data.low)}°`;
    elements.weatherWidget.title = `${data.location}｜体感 ${Math.round(data.apparent)}°｜湿度 ${data.humidity}%｜风速 ${Math.round(data.wind)} km/h`;
  }

  async function loadWeather(force = false) {
    elements.weatherWidget.classList.add('loading');
    elements.weatherDesc.textContent = force ? '刷新中' : '更新中';
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
      if (!force && cached && Date.now() - cached.savedAt < 10 * 60 * 1000) {
        renderWeather(cached.data, false);
        return;
      }
    } catch (error) { cached = null; }

    try {
      const location = await bestLocation();
      const locationName = await resolveLocationName(location);
      const params = new URLSearchParams({
        latitude: String(location.latitude), longitude: String(location.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code', timezone: 'auto', forecast_days: '1'
      });
      const weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      const data = {
        location: locationName,
        temperature: weather.current.temperature_2m,
        apparent: weather.current.apparent_temperature,
        humidity: weather.current.relative_humidity_2m,
        isDay: weather.current.is_day,
        weatherCode: weather.current.weather_code,
        wind: weather.current.wind_speed_10m,
        high: weather.daily.temperature_2m_max[0],
        low: weather.daily.temperature_2m_min[0],
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
      renderWeather(data, false);
    } catch (error) {
      console.warn('Weather unavailable', error);
      if (cached?.data) renderWeather(cached.data, true);
      else {
        elements.weatherIcon.textContent = '🌤️';
        elements.weatherTemp.textContent = '--°';
        elements.weatherLocation.textContent = '天气暂不可用';
        elements.weatherDesc.textContent = '点击重试';
      }
    } finally {
      elements.weatherWidget.classList.remove('loading');
      clearTimeout(weatherRefreshTimer);
      weatherRefreshTimer = setTimeout(() => loadWeather(true), 15 * 60 * 1000);
    }
  }
  function generateDemoRecords() {
    const templates = [
      ['完成了产品原型首页的第一版设计，并把日历交互流程串联起来。', '先把核心流程做通，再追求更多功能，验证效率会更高。', '邀请5位同学试用，记录他们第一次使用的卡点。'],
      ['阅读了《设计中的设计》第二章，整理了关于“留白”的笔记。', '留白不是缺少内容，而是帮助用户把注意力放在真正重要的信息上。', '把留白原则应用到记录页面的层级设计中。'],
      ['参加小组讨论，确定了本周的测试目标和访谈问题。', '问题越具体，用户越容易给出可以行动的信息。', '今晚整理访谈提纲，明天完成第一轮访谈。'],
      ['完成了一次5公里慢跑，比上周快了1分钟。', '稳定节奏比一开始冲得太快更容易完成目标。', '周末尝试一次更长的轻松跑。'],
      ['整理了最近一周的工作记录，发现自己花了不少时间在重复沟通上。', '把常见问题写成模板，可以减少重复解释。', '制作一份项目沟通清单。'],
      ['完成课程作业，并第一次独立使用数据透视表分析结果。', '先明确要回答的问题，再决定需要哪些数据。', '找一个小数据集再做一次练习。'],
      ['把手机相册里的照片整理成三个主题相册。', '整理记忆也是一种回看，会重新发现很多被忽略的片段。', '每个月保留30分钟做一次相册整理。'],
      ['和一个很久没联系的朋友通了电话。', '真实的连接不需要频繁，但需要主动。', '下周再约一次线下见面。'],
      ['完成第一次用户访谈，得到很多和预想不同的反馈。', '不要急着解释产品，先让用户完整讲出自己的经历。', '把访谈结论整理成需求优先级清单。'],
      ['学习了CSS Grid，并完成日历布局的小练习。', '复杂布局拆成重复的小单元后，会更容易实现。', '继续练习响应式断点和移动端适配。']
    ];
    const records = [];
    for (let index = 0; index < 18; index += 1) {
      if ([2, 6, 13].includes(index)) continue;
      const date = addDays(new Date(G.today.getFullYear(), G.today.getMonth(), G.today.getDate()), -index);
      const template = templates[index % templates.length];
      records.push({
        date: dateKey(date), action: template[0], learning: template[1], next: template[2], images: [],
        createdAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 21, 10).toISOString(),
        updatedAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 21, 10).toISOString()
      });
    }
    return records;
  }

  async function loadDemoData() {
    const records = generateDemoRecords().map(record => ({ ...record, owner: state.user.id }));
    if (!state.demoMode) await Store.putMany(records);
    records.forEach(record => state.records.set(record.date, record));
    closeDialog(elements.welcomeDialog);
    closeDialog(elements.moreDialog);
    UI.selectDate(todayKey);
    UI.renderAll();
    toast('示例数据已加载，可以自由编辑体验');
  }

  function exportData() {
    const records = [...state.records.values()].sort((a, b) => a.date.localeCompare(b.date));
    const payload = { app: '成长日历', version: 1, exportedAt: new Date().toISOString(), records };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `成长日历-数据备份-${todayKey}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast('数据备份已导出');
  }

  async function importData(file) {
    try {
      const payload = JSON.parse(await file.text());
      const source = Array.isArray(payload) ? payload : payload.records;
      if (!Array.isArray(source)) throw new Error('invalid records');
      const records = source.filter(record => record && /^\d{4}-\d{2}-\d{2}$/.test(record.date)).map(record => ({
        date: record.date, owner: state.user.id, text: recordText(record),
        images: Array.isArray(record.images) ? record.images : [], createdAt: record.createdAt || new Date().toISOString(), updatedAt: record.updatedAt || new Date().toISOString()
      })).filter(recordHasContent);
      if (!records.length) throw new Error('empty records');
      if (!state.demoMode) await Store.putMany(records);
      records.forEach(record => state.records.set(record.date, record));
      closeDialog(elements.moreDialog);
      UI.renderAll();
      toast(`成功导入 ${records.length} 条记录`);
    } catch (error) {
      console.error(error);
      toast('导入失败，请检查备份文件格式', 'error');
    } finally {
      elements.importFileInput.value = '';
    }
  }

  async function clearAllData() {
    if (!window.confirm('确定清空当前账号的全部记录吗？此操作不可撤销，建议先导出备份。')) return;
    if (!state.demoMode) await Store.clear(state.user.id);
    state.records.clear();
    closeDialog(elements.moreDialog);
    UI.renderAll();
    toast('全部记录已清空');
  }

  function openLightbox(dataUrl) {
    if (!dataUrl) return;
    elements.lightboxImage.src = dataUrl;
    if (!elements.imageDialog.open) elements.imageDialog.showModal();
  }

  function randomReview() {
    const records = [...state.records.values()].filter(recordHasContent);
    if (!records.length) return toast('还没有可以回顾的记录', 'error');
    const record = records[Math.floor(Math.random() * records.length)];
    openEditor(record.date);
    toast(`一起回顾 ${formatFullDate(record.date)}`);
  }

  function setAuthMessage(message = '', type = '') {
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type === 'success' ? 'success' : ''}`.trim();
  }

  function setAuthMode(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    const registering = authMode === 'register';
    $$('.auth-tabs [data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === authMode));
    authConfirmWrap.classList.toggle('hidden', !registering);
    authConfirm.required = registering;
    authPassword.autocomplete = registering ? 'new-password' : 'current-password';
    authTitle.textContent = registering ? '创建你的成长账号' : '登录你的成长日历';
    authSubtitle.textContent = registering ? '设置用户名和密码，开始记录属于你的成长片段。' : '输入用户名和密码，继续记录属于你的成长片段。';
    authSubmit.textContent = registering ? '注册并进入' : '登录';
    setAuthMessage();
  }

  function setUserUi(user) {
    userName.textContent = user.username;
    userAvatar.textContent = [...user.username][0]?.toUpperCase() || 'U';
  }

  async function loadAccountRecords() {
    state.records.clear();
    if (state.demoMode) {
      generateDemoRecords().forEach(record => state.records.set(record.date, record));
      elements.demoBadge.classList.remove('hidden');
      return;
    }
    elements.demoBadge.classList.add('hidden');
    const records = await Store.all(state.user.id);
    records.filter(recordHasContent).forEach(record => state.records.set(record.date, record));
  }

  async function enterApp(user) {
    state.user = user;
    state.selectedDate = todayKey;
    state.currentMonth = new Date(G.today.getFullYear(), G.today.getMonth(), 1);
    state.currentView = 'calendar';
    state.timelineQuery = '';
    setUserUi(user);
    authShell.classList.add('hidden');
    appShell.classList.remove('hidden');
    if (!appStarted) {
      bindEvents();
      appStarted = true;
    }
    await loadAccountRecords();
    UI.renderAll();
    UI.showView('calendar');
    loadWeather();
    const editParam = new URLSearchParams(location.search).get('edit');
    if (editParam) openEditor(editParam === 'today' ? todayKey : editParam);
    if (!state.records.size && !state.demoMode) setTimeout(() => { if (state.user?.id === user.id && !appShell.classList.contains('hidden')) elements.welcomeDialog.showModal(); }, 180);
  }

  function showAuthScreen(mode = 'login') {
    appShell.classList.add('hidden');
    authShell.classList.remove('hidden');
    authPassword.value = '';
    authConfirm.value = '';
    setAuthMode(mode);
    setTimeout(() => authUsername.focus(), 60);
  }

  function logout() {
    if (!window.confirm('退出当前账号吗？记录仍会保存在当前浏览器中。')) return;
    Auth.logout();
    state.user = null;
    state.records.clear();
    closeDialog(elements.recordDialog);
    closeDialog(elements.moreDialog);
    closeDialog(elements.welcomeDialog);
    closeDialog(elements.imageDialog);
    authForm.reset();
    showAuthScreen('login');
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const username = authUsername.value.trim();
    const password = authPassword.value;
    if (authMode === 'register' && password !== authConfirm.value) {
      return setAuthMessage('两次输入的密码不一致');
    }
    const submitLabel = authMode === 'register' ? '注册并进入' : '登录';
    authSubmit.disabled = true;
    authSubmit.textContent = '处理中…';
    try {
      let user;
      if (authMode === 'register') {
        user = await Auth.register(username, password);
        if (user.isFirstAccount) {
          const migrated = await Store.claimLegacyRecords(user.id);
          if (migrated) setAuthMessage(`已为当前账号导入 ${migrated} 条原有记录`, 'success');
        }
      } else {
        user = await Auth.login(username, password);
      }
      await enterApp(user);
    } catch (error) {
      console.error(error);
      const messages = {
        INVALID_USERNAME: '用户名需为2-20位中文、字母、数字、下划线或短横线',
        WEAK_PASSWORD: '密码至少需要6位',
        ACCOUNT_EXISTS: '这个用户名已经注册，请直接登录',
        INVALID_CREDENTIALS: '用户名或密码错误'
      };
      setAuthMessage(messages[error.message] || '操作失败，请稍后重试');
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = submitLabel;
    }
  }

  function bindAuthEvents() {
    $$('.auth-tabs [data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
    authForm.addEventListener('submit', handleAuthSubmit);
  }
  function bindEvents() {
    document.addEventListener('click', event => {
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) UI.showView(viewButton.dataset.view);
      const closeButton = event.target.closest('[data-close-dialog]');
      if (closeButton) closeDialog(document.getElementById(closeButton.dataset.closeDialog));
      if (event.target.closest('[data-action="quick-add"]')) openEditor(todayKey);
    });

    $('#quickAddBtn').addEventListener('click', () => openEditor(todayKey));
    $('#logoutBtn').addEventListener('click', logout);
    elements.weatherWidget.addEventListener('click', () => loadWeather(true));
    $('#prevMonthBtn').addEventListener('click', () => { state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1); UI.renderCalendar(); });
    $('#nextMonthBtn').addEventListener('click', () => { state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1); UI.renderCalendar(); });
    $('#todayBtn').addEventListener('click', () => { state.currentMonth = new Date(G.today.getFullYear(), G.today.getMonth(), 1); UI.selectDate(todayKey); });
    elements.calendarGrid.addEventListener('click', event => {
      const cell = event.target.closest('[data-date]');
      if (!cell) return;
      UI.selectDate(cell.dataset.date);
      openEditor(cell.dataset.date);
    });

    elements.recordForm.addEventListener('submit', saveCurrentRecord);
    elements.deleteRecordBtn.addEventListener('click', () => deleteRecord(state.editorDate));
    $('#selectImagesBtn').addEventListener('click', () => elements.imageInput.click());
    elements.dropZone.addEventListener('click', () => elements.imageInput.click());
    elements.dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.imageInput.click(); } });
    elements.imageInput.addEventListener('change', event => handleImageFiles(event.target.files));
    ['dragenter','dragover'].forEach(type => elements.dropZone.addEventListener(type, event => { event.preventDefault(); elements.dropZone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(type => elements.dropZone.addEventListener(type, event => { event.preventDefault(); elements.dropZone.classList.remove('dragover'); }));
    elements.dropZone.addEventListener('drop', event => handleImageFiles(event.dataTransfer.files));
    elements.imagePreview.addEventListener('click', event => { const button = event.target.closest('[data-remove-image]'); if (button) { state.editorImages.splice(Number(button.dataset.removeImage), 1); renderEditorImages(); } });

    elements.timelineSearch.addEventListener('input', event => { state.timelineQuery = event.target.value; UI.renderTimeline(); });
    $('#randomReviewBtn').addEventListener('click', randomReview);
    elements.timelineContent.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit-date]');
      const remove = event.target.closest('[data-delete-date]');
      const image = event.target.closest('[data-lightbox]');
      if (edit) openEditor(edit.dataset.editDate);
      if (remove) deleteRecord(remove.dataset.deleteDate);
      if (image) openLightbox(image.dataset.lightbox);
    });

    $('#moreBtn').addEventListener('click', () => elements.moreDialog.showModal());
    $('#exportDataBtn').addEventListener('click', exportData);
    $('#importDataBtn').addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', event => { if (event.target.files[0]) importData(event.target.files[0]); });
    $('#loadDemoFromMoreBtn').addEventListener('click', loadDemoData);
    $('#clearDataBtn').addEventListener('click', clearAllData);
    $('#startTodayBtn').addEventListener('click', () => { closeDialog(elements.welcomeDialog); openEditor(todayKey); });
    $('#loadDemoBtn').addEventListener('click', loadDemoData);

    $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog && dialog.id !== 'welcomeDialog') closeDialog(dialog); }));
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && elements.recordDialog.open) {
        event.preventDefault();
        elements.recordForm.requestSubmit();
      }
    });
  }

  async function init() {
    bindAuthEvents();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=8').catch(console.warn);
    const user = Auth.currentUser();
    if (user) await enterApp(user);
    else showAuthScreen('login');
  }
  init().catch(error => { console.error(error); showAuthScreen('login'); setAuthMessage('应用初始化失败，请刷新页面重试'); });
})();














