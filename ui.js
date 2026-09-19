(() => {
  'use strict';
  const G = window.GrowthCalendar;
  const { state, today, todayKey, WEEKDAYS, MONTH_NAMES, dateKey, parseDateKey, addDays, daysInMonth, sameMonth, formatLongDate, formatFullDate, escapeHtml, hasText, recordText, recordHasContent, contentLength, calculateStats } = G;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    views: $$('.view'), navItems: $$('.nav-item'), calendarGrid: $('#calendarGrid'), monthTitle: $('#monthTitle'),
    heroSummary: $('#heroSummary'), previewWeekday: $('#previewWeekday'), previewDate: $('#previewDate'),
    previewContent: $('#dayPreviewContent'), previewPrimaryBtn: $('#previewPrimaryBtn'), previewEditBtn: $('#previewEditBtn'),
    recordDialog: $('#recordDialog'), recordForm: $('#recordForm'), editorWeekday: $('#editorWeekday'), editorDate: $('#editorDate'),
    recordInput: $('#recordInput'), imageInput: $('#imageInput'),
    imagePreview: $('#imagePreview'), dropZone: $('#dropZone'), deleteRecordBtn: $('#deleteRecordBtn'),
    timelineContent: $('#timelineContent'), timelineSearch: $('#timelineSearch'), moreDialog: $('#moreDialog'),
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
    $('#metricTotal').textContent = stats.total;
    $('#metricMonth').textContent = stats.monthCount;
    $('#metricLongest').textContent = stats.longest;
    $('#metricPhotos').textContent = stats.photos;
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
    renderPreview();
  }

  function renderPreview() {
    const date = parseDateKey(state.selectedDate);
    const record = state.records.get(state.selectedDate);
    const eventText = calendarEvent(state.selectedDate).map(item => item.text).join(' · ');
    elements.previewWeekday.textContent = `${WEEKDAYS[date.getDay()]}${eventText ? ' · ' + eventText : ''}`;
    elements.previewDate.textContent = formatLongDate(state.selectedDate);
    if (!recordHasContent(record)) {
      elements.previewContent.innerHTML = `<div class="preview-empty"><div><div class="preview-empty-icon"><svg><use href="#i-sparkles"></use></svg></div><strong>这一天还没有记录</strong><p>写下一段今天的真实片段，让今天留下可回看的线索。</p></div></div>`;
      elements.previewPrimaryBtn.querySelector('span').textContent = '记录这一天';
      elements.previewEditBtn.classList.add('hidden');
      return;
    }
    const text = recordText(record);
    elements.previewContent.innerHTML = `
      ${hasText(text) ? `<div class="preview-block"><span>当天记录</span><p>${escapeHtml(text)}</p></div>` : ''}
      ${record.images?.length ? `<div class="preview-images">${record.images.slice(0,3).map(image => `<img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || '记录图片')}" data-lightbox="${escapeHtml(image.dataUrl)}">`).join('')}</div>` : ''}`;
    elements.previewPrimaryBtn.querySelector('span').textContent = '编辑当天记录';
    elements.previewEditBtn.classList.remove('hidden');
  }

  function renderTimelineCard(record) {
    const date = parseDateKey(record.date);
    const sections = hasText(recordText(record)) ? [['记录', recordText(record)]] : [];
    return `<article class="timeline-card" id="record-${record.date}">
      <div class="timeline-date"><strong>${date.getDate()}</strong><span>${WEEKDAYS[date.getDay()]}</span></div>
      <div class="timeline-body"><div class="timeline-body-head"><h3>${formatFullDate(record.date)}</h3><div class="timeline-actions">
      <button type="button" data-edit-date="${record.date}" aria-label="编辑记录"><svg><use href="#i-edit"></use></svg></button>
      <button type="button" data-delete-date="${record.date}" aria-label="删除记录"><svg><use href="#i-trash"></use></svg></button></div></div>
      <div class="timeline-sections">${sections.map(([label, value]) => `<div class="timeline-section"><b>${label}</b><p>${escapeHtml(value)}</p></div>`).join('')}</div>
      ${record.images?.length ? `<div class="timeline-images">${record.images.map(image => `<img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || '记录图片')}" data-lightbox="${escapeHtml(image.dataUrl)}">`).join('')}</div>` : ''}</div></article>`;
  }

  function renderTimeline() {
    const query = state.timelineQuery.trim().toLowerCase();
    const records = [...state.records.values()].filter(recordHasContent).filter(record => !query || recordText(record).toLowerCase().includes(query)).sort((a, b) => b.date.localeCompare(a.date));
    if (!records.length) {
      elements.timelineContent.innerHTML = `<div class="empty-state"><div><div class="empty-state-icon"><svg><use href="#i-timeline"></use></svg></div><h2>${query ? '没有找到匹配的记录' : '成长时间线还在等待第一条记录'}</h2><p>${query ? '试试更换关键词，或回到日历继续记录。' : '从今天开始，用一分钟写下真实片段。时间会帮你把这些片段连接起来。'}</p><button class="btn btn-primary" data-action="quick-add"><svg><use href="#i-plus"></use></svg><span>记录今天</span></button></div></div>`;
      return;
    }
    const groups = new Map();
    records.forEach(record => {
      const date = parseDateKey(record.date);
      const key = `${date.getFullYear()}-${G.pad(date.getMonth() + 1)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    elements.timelineContent.innerHTML = [...groups.entries()].map(([monthKey, items]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return `<section><h2 class="timeline-group-title">${year}年${month}月 <span class="muted">${items.length}条记录</span></h2><div class="timeline-list">${items.map(renderTimelineCard).join('')}</div></section>`;
    }).join('');
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
    if (state.currentView === 'timeline') renderTimeline();
    if (state.currentView === 'insights') renderInsights();
  }

  function showView(viewName) {
    state.currentView = viewName;
    elements.views.forEach(view => view.classList.toggle('active', view.id === `${viewName}View`));
    elements.navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewName));
    if (viewName === 'timeline') renderTimeline();
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
    elements, renderAll, renderCalendar, renderPreview, renderTimeline, renderInsights, showView, selectDate
  };
})();









