
'use strict';

const THEME = {
  ink: '#152033',
  inkSoft: '#334155',
  muted: '#69778c',
  line: 'rgba(21,32,51,0.10)',
  coast: '#244e5c',
  risk: '#b86850',
  critical: '#8f4b42',
  gold: '#d3af63',
  green: '#5b7562',
  paper: '#fbf7ec'
};

const state = {
  timeline: null,
  scoreboard: null,
  anomaly: null,
  fi: null,
  summary: null,
  filter: 'all',
  charts: {
    scoreboard: null,
    timeline: null,
    anomaly: null,
    fi: null
  }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function labelText(value) {
  return String(value || 'at_risk').replaceAll('_', ' ');
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—';
}

function fmt(value, digits = 4) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function modelColor(label) {
  if (label === 'critical') return THEME.critical;
  if (label === 'resilient') return THEME.green;
  return THEME.risk;
}

function featureName(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace('sl ', 'sea level ')
    .replace('sst ', 'SST ')
    .replace('renew ', 'renewable ')
    .replace('roc ', 'rate of change ');
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function commonChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: {
        labels: {
          color: THEME.muted,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
          font: { family: 'Manrope', size: 10, weight: '800' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(21,32,51,0.93)',
        titleColor: THEME.paper,
        bodyColor: THEME.paper,
        borderColor: 'rgba(251,247,236,0.16)',
        borderWidth: 1,
        padding: 11,
        displayColors: true
      }
    },
    scales: {
      x: {
        ticks: { color: THEME.muted, font: { family: 'Manrope', size: 10, weight: '800' } },
        grid: { color: THEME.line }
      },
      y: {
        ticks: { color: THEME.muted, font: { family: 'Manrope', size: 10, weight: '800' } },
        grid: { color: THEME.line }
      }
    },
    ...extra
  };
}

function latestSB() {
  return state.scoreboard.find(row => row.country_code === 'SB') || state.scoreboard[0] || {};
}

function updateKpis() {
  const countries = state.summary?.data?.countries ?? state.scoreboard.length;
  const critical = state.scoreboard.filter(row => (row.label || row.label_predicted) === 'critical').length;
  const atRisk = state.scoreboard.filter(row => (row.label || row.label_predicted) === 'at_risk').length;
  const anomalies = state.summary?.task3?.total_anomalies ?? state.anomaly.length;
  const sb = latestSB();

  $('#kpi-countries').textContent = countries;
  $('#kpi-risk').textContent = `${critical}/${atRisk}`;
  $('#kpi-anomalies').textContent = anomalies;
  $('#kpi-sb-cvi').textContent = fmt(sb.CVI, 3);
  $('#kpi-sb-label').textContent = `Solomon Islands · ${labelText(sb.label_predicted || sb.label)}`;
}

function renderScoreboardHighlights() {
  const ranked = state.scoreboard.slice().sort((a, b) => Number(b.CVI || 0) - Number(a.CVI || 0));
  const sb = latestSB();
  const sbRank = ranked.findIndex(row => row.country_code === 'SB') + 1;
  const top = ranked[0] || {};
  const anomalyCounts = {};
  state.anomaly.forEach(row => {
    const key = row.country_name || row.country_code;
    anomalyCounts[key] = (anomalyCounts[key] || 0) + 1;
  });
  const anomalyLeader = Object.entries(anomalyCounts).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
  const topFeature = state.fi[0] || {};

  $('#scoreboard-highlights').innerHTML = `
    <article class="insight-card"><b>Highest CVI</b><strong>${esc(top.country_code || '—')}</strong><span>${esc(top.country_name || '')} · ${fmt(top.CVI, 3)}</span></article>
    <article class="insight-card"><b>Solomon rank</b><strong>#${sbRank || '—'}</strong><span>CVI ${fmt(sb.CVI, 3)} · ${esc(labelText(sb.label_predicted || sb.label))}</span></article>
    <article class="insight-card"><b>Anomaly leader</b><strong>${esc(anomalyLeader[1])}</strong><span>${esc(anomalyLeader[0])} flags</span></article>
    <article class="insight-card"><b>Top feature</b><strong>${Math.round(Number(topFeature.importance || 0) * 100)}%</strong><span>${esc(featureName(topFeature.feature))}</span></article>
  `;
}

function renderScoreboardCards(filter = 'all') {
  const host = $('#scoreboard-grid');
  const data = (filter === 'all'
    ? state.scoreboard
    : state.scoreboard.filter(row => (row.label || row.label_predicted) === filter)
  ).slice().sort((a, b) => Number(b.CVI || 0) - Number(a.CVI || 0));

  host.innerHTML = data.map(row => {
    const label = row.label || row.label_predicted || 'at_risk';
    const cvi = Number(row.CVI || 0);
    const bar = Math.max(4, Math.min(100, cvi * 100));
    return `
      <article class="score-card ${esc(label)}">
        <div class="card-header">
          <div>
            <div class="card-country">${esc(row.country_name)}</div>
            <div class="card-code">${esc(row.country_code)} · ${esc(row.year || '')}</div>
          </div>
          <span class="label-badge ${esc(label)}">${esc(labelText(label))}</span>
        </div>
        <div class="cvi-bar-wrap">
          <div class="cvi-bar-track">
            <div class="cvi-bar-fill ${esc(label)}" style="width:${bar}%"></div>
          </div>
        </div>
        <div class="cvi-value">${fmt(cvi, 4)}</div>
        <div class="card-meta">
          <span>Confidence ${pct(row.confidence)}</span>
          <span>Pred ${fmt(row.CVI_predicted, 4)}</span>
        </div>
      </article>`;
  }).join('');
}

function renderScoreboardChart(filter = 'all') {
  const data = (filter === 'all'
    ? state.scoreboard
    : state.scoreboard.filter(row => (row.label || row.label_predicted) === filter)
  ).slice().sort((a, b) => Number(b.CVI || 0) - Number(a.CVI || 0)).slice(0, 14);

  destroyChart('scoreboard');
  state.charts.scoreboard = new Chart($('#chart-scoreboard'), {
    type: 'bar',
    data: {
      labels: data.map(row => row.country_code),
      datasets: [{
        label: 'CVI',
        data: data.map(row => Number(row.CVI || 0)),
        backgroundColor: data.map(row => modelColor(row.label || row.label_predicted)),
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: commonChartOptions({
      indexAxis: 'y',
      plugins: {
        ...commonChartOptions().plugins,
        legend: { display: false },
        tooltip: {
          ...commonChartOptions().plugins.tooltip,
          callbacks: {
            title: items => {
              const row = data[items[0].dataIndex];
              return row.country_name;
            },
            label: item => `CVI ${fmt(item.raw, 4)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: THEME.muted, font: { family: 'Manrope', size: 10, weight: '800' } },
          grid: { color: THEME.line },
          min: 0,
          max: Math.max(0.7, ...data.map(row => Number(row.CVI || 0))) + 0.03
        },
        y: {
          ticks: { color: THEME.inkSoft, font: { family: 'Manrope', size: 10, weight: '900' } },
          grid: { display: false }
        }
      }
    })
  });
}

function setupFilters() {
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      renderScoreboardCards(state.filter);
      renderScoreboardChart(state.filter);
    });
  });
}

function populateCountrySelects() {
  const primary = $('#timeline-country');
  const compare = $('#timeline-compare');
  const names = new Map(state.scoreboard.map(row => [row.country_code, row.country_name]));
  const codes = Object.keys(state.timeline).sort((a, b) => (names.get(a) || a).localeCompare(names.get(b) || b));

  primary.innerHTML = '';
  compare.innerHTML = '<option value="">None</option>';

  codes.forEach(code => {
    const name = state.timeline[code]?.name || names.get(code) || code;
    primary.insertAdjacentHTML('beforeend', `<option value="${esc(code)}">${esc(name)} (${esc(code)})</option>`);
    compare.insertAdjacentHTML('beforeend', `<option value="${esc(code)}">${esc(name)} (${esc(code)})</option>`);
  });

  primary.value = state.timeline.SB ? 'SB' : codes[0];
  compare.value = '';

  primary.addEventListener('change', () => renderTimeline());
  compare.addEventListener('change', () => renderTimeline());
}

function renderTimelineSnapshot(d) {
  const n = d.years.length - 1;
  const previous = Math.max(0, n - 5);
  const delta = Number(d.CVI?.[n]) - Number(d.CVI?.[previous]);
  const direction = delta > 0 ? 'Rising' : delta < 0 ? 'Falling' : 'Stable';
  const anomalyYears = state.anomaly.filter(row => row.country_code === $('#timeline-country').value).length;
  $('#timeline-snapshot').innerHTML = `
    <article class="snapshot-card"><b>Country</b><strong>${esc($('#timeline-country').value)}</strong><span>${esc(d.name)}</span></article>
    <article class="snapshot-card"><b>Latest CVI</b><strong>${fmt(d.CVI?.[n], 3)}</strong><span>${esc(labelText(d.label?.[n]))}</span></article>
    <article class="snapshot-card"><b>5-year movement</b><strong>${esc(direction)}</strong><span>${fmt(delta, 4)} CVI change</span></article>
    <article class="snapshot-card"><b>Anomaly events</b><strong>${anomalyYears}</strong><span>flags across timeline</span></article>
  `;
}

function renderTimeline() {
  const code1 = $('#timeline-country').value;
  const code2 = $('#timeline-compare').value;
  const d1 = state.timeline[code1];
  const d2 = code2 ? state.timeline[code2] : null;
  if (!d1) return;

  const datasets = [
    {
      label: `${d1.name} actual`,
      data: d1.CVI,
      borderColor: THEME.coast,
      backgroundColor: 'rgba(36,78,92,0.11)',
      fill: true,
      tension: 0.35,
      pointRadius: 2.5,
      pointBackgroundColor: THEME.coast
    },
    {
      label: `${d1.name} predicted`,
      data: d1.CVI_predicted,
      borderColor: THEME.risk,
      borderDash: [6, 5],
      fill: false,
      tension: 0.35,
      pointRadius: 0
    }
  ];

  if (d2) {
    datasets.push({
      label: `${d2.name} actual`,
      data: d2.CVI,
      borderColor: THEME.gold,
      backgroundColor: 'rgba(211,175,99,0.10)',
      fill: true,
      tension: 0.35,
      pointRadius: 2.5,
      pointBackgroundColor: THEME.gold
    });
    datasets.push({
      label: `${d2.name} predicted`,
      data: d2.CVI_predicted,
      borderColor: THEME.green,
      borderDash: [6, 5],
      fill: false,
      tension: 0.35,
      pointRadius: 0
    });
  }

  destroyChart('timeline');
  state.charts.timeline = new Chart($('#chart-timeline'), {
    type: 'line',
    data: { labels: d1.years, datasets },
    options: commonChartOptions({
      plugins: {
        ...commonChartOptions().plugins,
        legend: { position: 'bottom', labels: commonChartOptions().plugins.legend.labels }
      },
      scales: {
        x: {
          ticks: { color: THEME.muted, maxRotation: 0, autoSkip: true, font: { family: 'Manrope', size: 10, weight: '800' } },
          grid: { color: THEME.line }
        },
        y: {
          ticks: { color: THEME.muted, font: { family: 'Manrope', size: 10, weight: '800' } },
          grid: { color: THEME.line },
          suggestedMin: 0.2,
          suggestedMax: 0.7,
          title: { display: true, text: 'CVI Score', color: THEME.muted }
        }
      }
    })
  });

  renderTimelineSnapshot(d1);
  renderTimelineDetails(d1);
}

function renderTimelineDetails(d) {
  const host = $('#timeline-detail');
  const n = d.years.length - 1;
  const label = d.label?.[n] || 'at_risk';
  const renew = d.renew_share?.[n];
  const sstTrend = d.sst_trend_10yr?.[n];
  const seaTrend = d.sl_trend_5yr?.[n];

  host.innerHTML = `
    <article class="detail-card">
      <div class="detail-label">Selected country</div>
      <div class="detail-value">${esc(d.name)}</div>
    </article>
    <article class="detail-card">
      <div class="detail-label">Latest CVI</div>
      <div class="detail-value risk">${fmt(d.CVI?.[n], 4)}</div>
    </article>
    <article class="detail-card">
      <div class="detail-label">Model status</div>
      <div class="detail-value ${label === 'resilient' ? 'good' : 'risk'}">${esc(labelText(label))}</div>
    </article>
    <article class="detail-card">
      <div class="detail-label">Renewable share</div>
      <div class="detail-value">${renew == null ? '—' : fmt(renew, 1) + '%'}</div>
    </article>
    <article class="detail-card">
      <div class="detail-label">SST trend 10yr</div>
      <div class="detail-value">${sstTrend == null ? '—' : fmt(sstTrend, 4)}</div>
    </article>
    <article class="detail-card">
      <div class="detail-label">Sea level trend 5yr</div>
      <div class="detail-value">${seaTrend == null ? '—' : fmt(seaTrend, 4)}</div>
    </article>
  `;
}

function renderAnomalySummary(data = state.anomaly) {
  const iso = data.filter(row => row.iso_anomaly).length;
  const lof = data.filter(row => row.lof_anomaly).length;
  const zsc = data.filter(row => row.zscore_anomaly).length;
  $('#anomaly-summary').innerHTML = `
    <article class="anom-summary-card"><b>Isolation forest</b><strong>${iso}</strong><span>density-based outlier flags</span></article>
    <article class="anom-summary-card"><b>LOF</b><strong>${lof}</strong><span>local outlier factor flags</span></article>
    <article class="anom-summary-card"><b>Z-score</b><strong>${zsc}</strong><span>statistical deviation flags</span></article>
  `;
}

function renderAnomalies(data = state.anomaly) {
  const host = $('#anomaly-list');
  const count = $('#anomaly-count');
  count.textContent = `${data.length} events`;

  host.innerHTML = data.slice(0, 120).map(row => {
    const tags = [];
    if (row.iso_anomaly) tags.push('<span class="anom-tag iso">ISO</span>');
    if (row.lof_anomaly) tags.push('<span class="anom-tag lof">LOF</span>');
    if (row.zscore_anomaly) tags.push('<span class="anom-tag zsc">Z-score</span>');
    const indicators = row.zscore_indicators ? row.zscore_indicators.replaceAll(',', ', ') : 'multi-indicator';
    return `
      <article class="anom-row">
        <div class="anom-left">
          <div class="anom-country">${esc(row.country_name)}</div>
          <div class="anom-year">${esc(row.year)} · ${esc(indicators)}</div>
        </div>
        <div class="anom-right">
          <div class="anom-tags">${tags.join('')}</div>
          <div class="anom-zscore">${row.zscore_max_z ? 'z=' + Number(row.zscore_max_z).toFixed(2) : ''}</div>
        </div>
      </article>
    `;
  }).join('');

  renderAnomalySummary(data);
}

function renderAnomalyChart(data = state.anomaly) {
  const counts = {};
  data.forEach(row => {
    const key = row.country_name || row.country_code;
    counts[key] = (counts[key] || 0) + 1;
  });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 14);

  destroyChart('anomaly');
  state.charts.anomaly = new Chart($('#chart-anomaly-bar'), {
    type: 'bar',
    data: {
      labels: rows.map(row => row[0]),
      datasets: [{
        label: 'Anomaly flags',
        data: rows.map(row => row[1]),
        backgroundColor: rows.map((_, i) => i < 3 ? 'rgba(184,104,80,0.78)' : 'rgba(36,78,92,0.62)'),
        borderColor: rows.map((_, i) => i < 3 ? THEME.risk : THEME.coast),
        borderWidth: 1,
        borderRadius: 9,
        borderSkipped: false
      }]
    },
    options: commonChartOptions({
      indexAxis: 'y',
      plugins: {
        ...commonChartOptions().plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: THEME.muted, font: { family: 'Manrope', size: 10, weight: '800' } },
          grid: { color: THEME.line }
        },
        y: {
          ticks: { color: THEME.inkSoft, font: { family: 'Manrope', size: 10, weight: '900' } },
          grid: { display: false }
        }
      }
    })
  });
}

function setupAnomalySearch() {
  $('#anomaly-search').addEventListener('input', event => {
    const q = event.target.value.trim().toLowerCase();
    const filtered = !q
      ? state.anomaly
      : state.anomaly.filter(row =>
          String(row.country_name || '').toLowerCase().includes(q) ||
          String(row.country_code || '').toLowerCase().includes(q)
        );
    renderAnomalies(filtered);
    renderAnomalyChart(filtered);
  });
}

function renderModelMetrics() {
  const s = state.summary;
  const host = $('#model-metrics-grid');
  host.innerHTML = `
    <article class="metric-card">
      <div class="mc-title">Task 1 · Regression</div>
      <div class="mc-model">${esc(s.task1?.model || 'CVI model')}</div>
      <div class="metric-row"><span class="mr-key">MAE</span><span class="mr-val good">${esc(s.task1?.mae)}</span></div>
      <div class="metric-row"><span class="mr-key">R²</span><span class="mr-val good">${esc(s.task1?.r2)}</span></div>
      <div class="metric-row"><span class="mr-key">Spearman</span><span class="mr-val good">${esc(s.task1?.spearman)}</span></div>
      <div class="metric-row"><span class="mr-key">Beats baseline</span><span class="mr-val ${s.task1?.beats_baseline ? 'good' : 'bad'}">${s.task1?.beats_baseline ? 'Yes' : 'No'}</span></div>
    </article>
    <article class="metric-card">
      <div class="mc-title">Task 2 · Classification</div>
      <div class="mc-model">${esc(s.task2?.model || 'Label model')}</div>
      <div class="metric-row"><span class="mr-key">Weighted F1</span><span class="mr-val good">${esc(s.task2?.f1_weighted)}</span></div>
      <div class="metric-row"><span class="mr-key">Critical recall</span><span class="mr-val warn">${esc(s.task2?.critical_recall)}</span></div>
      <div class="metric-row"><span class="mr-key">Target ≥0.80</span><span class="mr-val ${Number(s.task2?.critical_recall) >= .8 ? 'good' : 'warn'}">${Number(s.task2?.critical_recall) >= .8 ? 'Met' : 'Not yet'}</span></div>
    </article>
    <article class="metric-card">
      <div class="mc-title">Task 3 · Anomaly</div>
      <div class="mc-model">Z-score · Isolation Forest · LOF</div>
      <div class="metric-row"><span class="mr-key">Z-score</span><span class="mr-val">${esc(s.task3?.zscore_count)}</span></div>
      <div class="metric-row"><span class="mr-key">Isolation forest</span><span class="mr-val">${esc(s.task3?.iso_count)}</span></div>
      <div class="metric-row"><span class="mr-key">Total flags</span><span class="mr-val warn">${esc(s.task3?.total_anomalies)}</span></div>
    </article>
  `;
}

function renderFeatureImportance() {
  const rows = state.fi.slice(0, 12);
  destroyChart('fi');
  state.charts.fi = new Chart($('#chart-fi'), {
    type: 'bar',
    data: {
      labels: rows.map(row => featureName(row.feature)),
      datasets: [{
        label: 'Feature influence',
        data: rows.map(row => Number(row.importance || 0)),
        backgroundColor: rows.map((_, i) => i < 2 ? 'rgba(211,175,99,0.82)' : 'rgba(36,78,92,0.64)'),
        borderColor: rows.map((_, i) => i < 2 ? THEME.gold : THEME.coast),
        borderWidth: 1,
        borderRadius: 9,
        borderSkipped: false
      }]
    },
    options: commonChartOptions({
      indexAxis: 'y',
      plugins: {
        ...commonChartOptions().plugins,
        legend: { display: false },
        tooltip: {
          ...commonChartOptions().plugins.tooltip,
          callbacks: {
            label: ctx => `${Math.round(Number(ctx.raw) * 100)}%`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: THEME.muted,
            font: { family: 'Manrope', size: 10, weight: '800' },
            callback: value => Math.round(value * 100) + '%'
          },
          grid: { color: THEME.line }
        },
        y: {
          ticks: { color: THEME.inkSoft, font: { family: 'Manrope', size: 10, weight: '900' } },
          grid: { display: false }
        }
      }
    })
  });
}

function setupTabs() {
  $$('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      $$('.tab-btn').forEach(el => el.classList.remove('active'));
      $$('.tab-page').forEach(el => el.classList.remove('active'));
      button.classList.add('active');
      const tab = button.dataset.tab;
      $(`#tab-${tab}`).classList.add('active');

      requestAnimationFrame(() => {
        Object.values(state.charts).forEach(chart => chart && chart.resize());
      });
    });
  });
}

async function init() {
  const [timeline, scoreboard, anomaly, fi, summary] = await Promise.all([
    loadJSON('timeline_data.json'),
    loadJSON('scoreboard_data.json'),
    loadJSON('anomaly_data.json'),
    loadJSON('feature_importance_data.json'),
    loadJSON('model_summary.json')
  ]);

  state.timeline = timeline;
  state.scoreboard = scoreboard;
  state.anomaly = anomaly;
  state.fi = fi;
  state.summary = summary;

  updateKpis();
  setupTabs();
  setupFilters();
  populateCountrySelects();
  setupAnomalySearch();

  renderScoreboardHighlights();
  renderScoreboardCards('all');
  renderScoreboardChart('all');
  renderTimeline();
  renderAnomalies();
  renderAnomalyChart();
  renderModelMetrics();
  renderFeatureImportance();
}

init().catch(err => {
  console.error('ML Command init error:', err);
  document.body.insertAdjacentHTML('afterbegin', `<div style="padding:16px;color:#8f4b42;font-weight:800">ML Command data failed to load: ${esc(err.message)}</div>`);
});
