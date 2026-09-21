(() => {
  'use strict';
  const G = window.GrowthCalendar;
  const { state, today, todayKey, MONTH_NAMES, dateKey, parseDateKey, addDays, daysInMonth, sameMonth, formatLongDate, formatFullDate, escapeHtml, recordHasContent, contentLength, calculateStats } = G;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    views: $$('.view'), navItems: $$('.nav-item'), calendarGrid: $('#calendarGrid'), monthTitle: $('#monthTitle'),
    heroSummary: $('#heroSummary'),
    recordDialog: $('#recordDialog'), recordForm: $('#recordForm'), editorWeekday: $('#editorWeekday'), editorDate: $('#editorDate'),
    recordInput: $('#recordInput'), imageInput: $('#imageInput'),
    imagePreview: $('#imagePreview'), dropZone: $('#dropZone'), deleteRecordBtn: $('#deleteRecordBtn'),
    welcomeDialog: $('#welcomeDialog'), imageDialog: $('#imageDialog'), lightboxImage: $('#lightboxImage'),
    importFileInput: $('#importFileInput'), demoBadge: $('#demoBadge'), toast: $('#toast'),
    weatherWidget: $('#weatherWidget'), weatherIcon: $('#weatherIcon'), weatherTemp: $('#weatherTemp'), weatherLocation: $('#weatherLocation'), weatherDesc: $('#weatherDesc')
  };

  const PREFERRED_FESTIVALS = new Set(['元旦节','除夕','春节','元宵节','情人节','妇女节','植树节','愚人节','劳动节','青年节','母亲节','儿童节','父亲节','建党节','建军节','教师节','国庆节','中秋节','重阳节','腊八节','小年','平安夜','圣诞节']);
  function calendarEvent(key) {
    const data = (window.CALENDAR_EVENT_DATA || {})[key] || {};
    const labels = [];
    if (data.jq) labels.push({ text: data.jq, type: 'is-jieqi' });
    const festival = (data.f || []).find(name => PREFERRED_FESTIVALS.has(name));
    if (festival) labels.push({ text: festival, type: 'is-festival' });
    return labels.slice(0, 2);
  }

  function renderHeaderStats() {
    const stats = calculateStats();
    const hour = new Date().getHours();
    const greeting = hour < 6 ? '夜深了，别忘了记录今天' : hour < 12 ? '早上好，今天也要留下痕迹' : hour < 18 ? '下午好，回顾一下今天的收获' : '晚上好，用一分钟记录今天';
    $('#calendarTitle').textContent = greeting;
    elements.heroSummary.textContent = stats.total
      ? `你已经留下 ${stats.total} 天的成长记录，最近一次连续记录了 ${stats.streak} 天。`
      : '写下一段今天的成长片段，也为未来保留一份可回看的真实线索。';
    $('#heroStreak').textContent = stats.streak;
    $('#streakHint').textContent = stats.streak ? '保持节奏，不必追求完美' : '从今天开始';
  }

  function renderCalendar() {
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    elements.monthTitle.textContent = `${year}年${month + 1}月`;
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = addDays(firstDay, -mondayOffset);
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      const key = dateKey(date);
      const record = state.records.get(key);
      const hasRecord = recordHasContent(record);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = [
        'day-cell', !sameMonth(date, year, month) ? 'other-month' : '', key === todayKey ? 'today' : '',
        key === state.selectedDate ? 'selected' : '', hasRecord ? 'has-record' : ''
      ].filter(Boolean).join(' ');
      button.dataset.date = key;
      button.setAttribute('aria-label', `${formatFullDate(key)}${hasRecord ? '，已有记录' : ''}`);
      const eventLabels = calendarEvent(key);
      const imageCount = record?.images?.length || 0;
      button.innerHTML = `
        <span class="day-number">${date.getDate()}</span>
        ${eventLabels.map(item => `<span class="day-event ${item.type}">${escapeHtml(item.text)}</span>`).join('')}
        <span class="day-meta">
          ${imageCount ? `<span class="image-count" title="${imageCount}张图片"><svg><use href="#i-image"></use></svg><span>${imageCount}</span></span>` : ''}
        </span>`;
      fragment.appendChild(button);
    }
    elements.calendarGrid.replaceChildren(fragment);
  }

  function countMonth(year, month) {
    return [...state.records.keys()].filter(key => {
      const date = parseDateKey(key);
      return date.getFullYear() === year && date.getMonth() === month && recordHasContent(state.records.get(key));
    }).length;
  }

  function renderHeatmap() {
    const days = 84;
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOffset = (end.getDay() + 6) % 7;
    const endSunday = addDays(end, 6 - dayOffset);
    const start = addDays(endSunday, -(days - 1));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < days; index += 1) {
      const date = addDays(start, index);
      const key = dateKey(date);
      const record = state.records.get(key);
      const length = contentLength(record);
      let level = 0;
      if (recordHasContent(record)) {
        if (length >= 180 || record?.images?.length >= 3) level = 4;
        else if (length >= 100 || record?.images?.length >= 2) level = 3;
        else if (length >= 40 || record?.images?.length) level = 2;
        else level = 1;
      }
      const cell = document.createElement('i');
      cell.className = `heat-cell heat-${level}`;
      cell.title = `${formatFullDate(key)}：${recordHasContent(record) ? '已记录' : '未记录'}`;
      fragment.appendChild(cell);
    }
    $('#heatmap').replaceChildren(fragment);
    $('#heatmapRange').textContent = `${formatLongDate(dateKey(start))}—${formatLongDate(dateKey(end))}`;
  }

  function renderMonthlyChart(year) {
    const counts = Array.from({ length: 12 }, (_, month) => countMonth(year, month));
    const max = Math.max(1, ...counts);
    $('#monthlyChart').innerHTML = counts.map((count, month) => {
      const height = count ? Math.max(8, count / max * 100) : 2;
      return `<div class="month-column" title="${MONTH_NAMES[month]}：${count}天"><div class="month-bar-track">${count ? `<span class="month-value">${count}</span>` : ''}<div class="month-bar" style="height:${height}%"></div></div><span class="month-label">${month + 1}月</span></div>`;
    }).join('');
  }

  function renderInsights() {
    const stats = calculateStats();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysElapsed = Math.min(today.getDate(), daysInMonth(year, month));
    const density = daysElapsed ? Math.round(countMonth(year, month) / daysElapsed * 100) : 0;
    $('#insightTotal').textContent = stats.total;
    $('#insightStreak').textContent = stats.streak;
    $('#insightDensity').textContent = density;
    $('#insightWords').textContent = stats.words > 9999 ? `${(stats.words / 10000).toFixed(1)}万` : stats.words;
    $('#yearTitle').textContent = `${year} 年月度记录`;
    renderHeatmap();
    renderMonthlyChart(year);
  }

  function renderAll() {
    renderHeaderStats();
    renderCalendar();
    if (state.currentView === 'insights') renderInsights();
  }

  function showView(viewName) {
    state.currentView = viewName;
    elements.views.forEach(view => view.classList.toggle('active', view.id === `${viewName}View`));
    elements.navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewName));
    if (viewName === 'insights') renderInsights();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectDate(key) {
    state.selectedDate = key;
    const date = parseDateKey(key);
    state.currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
  }

  window.GrowthCalendarUI = {
    elements, renderAll, renderCalendar, renderInsights, showView, selectDate
  };
})();









