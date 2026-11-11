import { COLORS, X_DOMAIN, Y_DOMAIN, logPosition, bubbleRadius, observation, snapshot, summarize } from './model.js';

const $ = (id) => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const state = { data: null, year: 1950, playing: false, continents: new Set(Object.keys(COLORS)), selected: null, hovered: null, lastFrame: 0, lastDraw: 0, frame: null };
const circles = new Map();
let dimensions;
let searchIndex = -1;

function svgElement(name, attributes = {}, content) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (content != null) element.textContent = content;
  return element;
}

function maxRadius() { return dimensions.width < 600 ? 32 : 47; }
function x(value) { return dimensions.left + logPosition(value, dimensions.plotWidth); }
function y(value) { return dimensions.top + (Y_DOMAIN[1] - value) / (Y_DOMAIN[1] - Y_DOMAIN[0]) * dimensions.plotHeight; }

function resize() {
  const { width, height } = $('chart-wrap').getBoundingClientRect();
  const mobile = width < 600;
  dimensions = { width, height, left: mobile ? 36 : 49, right: mobile ? 22 : 29, top: 14, bottom: 28 };
  dimensions.plotWidth = width - dimensions.left - dimensions.right;
  dimensions.plotHeight = height - dimensions.top - dimensions.bottom;
  $('chart').setAttribute('viewBox', `0 0 ${width} ${height}`);
  $('clip-rect').setAttribute('x', dimensions.left - 1);
  $('clip-rect').setAttribute('y', 0);
  $('clip-rect').setAttribute('width', dimensions.plotWidth + 2);
  $('clip-rect').setAttribute('height', height - dimensions.bottom);
  $('grid').replaceChildren();
  $('axis-labels').replaceChildren();
  for (const value of [0, 20, 40, 60, 80]) {
    $('grid').append(svgElement('line', { x1: dimensions.left, x2: width - dimensions.right, y1: y(value), y2: y(value) }));
    $('axis-labels').append(svgElement('text', { x: dimensions.left - 13, y: y(value) + 3, 'text-anchor': 'end' }, value));
  }
  const ticks = mobile ? [200, 1000, 5000, 20000, 100000, 200000] : [200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
  for (const value of ticks) {
    $('grid').append(svgElement('line', { x1: x(value), x2: x(value), y1: dimensions.top, y2: height - dimensions.bottom }));
    $('axis-labels').append(svgElement('text', { x: x(value), y: height - 9, 'text-anchor': 'middle' }, value >= 1000 ? `${value / 1000}k` : value));
  }
  $('year-watermark').setAttribute('x', width - dimensions.right - 16);
  $('year-watermark').setAttribute('y', height - dimensions.bottom - 18);
  $('year-watermark').setAttribute('text-anchor', 'end');
  document.querySelectorAll('.size-legend circle').forEach(circle => circle.setAttribute('r', bubbleRadius(Number(circle.dataset.population), maxRadius())));
  render();
}

function createCountries() {
  for (const country of state.data.countries) {
    const circle = svgElement('circle', { fill: COLORS[country.continent], stroke: COLORS[country.continent], tabindex: '0', role: 'button', 'data-country': country.name });
    const title = svgElement('title');
    circle.append(title);
    circle.addEventListener('pointerenter', () => { state.hovered = country; renderHighlights(); });
    circle.addEventListener('pointerleave', () => { state.hovered = null; renderHighlights(); });
    circle.addEventListener('focus', () => { state.hovered = country; renderHighlights(); });
    circle.addEventListener('blur', () => { state.hovered = null; renderHighlights(); });
    circle.addEventListener('click', () => selectCountry(state.selected === country ? null : country));
    circle.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectCountry(state.selected === country ? null : country); }
    });
    circles.set(country.name, circle);
  }
  // Large countries are underneath smaller countries, making small bubbles reachable.
  const ordered = [...state.data.countries].sort((a, b) => Math.max(...b.population) - Math.max(...a.population));
  $('bubbles').append(...ordered.map(c => circles.get(c.name)));
}

function render() {
  if (!state.data || !dimensions) return;
  const points = snapshot(state.data, state.year, state.continents);
  const visible = new Set(points.map(p => p.country.name));
  for (const country of state.data.countries) {
    const circle = circles.get(country.name);
    const show = visible.has(country.name);
    circle.style.display = show ? '' : 'none';
    circle.setAttribute('aria-hidden', String(!show));
    circle.setAttribute('tabindex', show ? '0' : '-1');
  }
  for (const p of points) {
    const circle = circles.get(p.country.name);
    circle.setAttribute('cx', x(p.income));
    circle.setAttribute('cy', y(p.life));
    circle.setAttribute('r', bubbleRadius(p.population, maxRadius()));
    if (!state.playing) {
      const label = `${p.country.name}, ${Math.round(state.year)}. Income per person ${number.format(p.income)}; life expectancy ${p.life.toFixed(1)} years; population ${number.format(p.population)}. Select to follow.`;
      circle.setAttribute('aria-label', label);
      circle.firstChild.textContent = label;
    }
  }
  const year = Math.round(state.year);
  $('year-watermark').textContent = year;
  $('year-slider').value = year;
  $('year-slider').style.setProperty('--progress', `${(state.year - state.data.years[0]) / (state.data.years.at(-1) - state.data.years[0]) * 100}%`);
  if (document.activeElement !== $('year-input')) $('year-input').value = year;
  $('summary-year').textContent = year;
  const summary = summarize(points);
  $('country-count').textContent = String(summary.count);
  $('population-total').textContent = compact.format(summary.population);
  $('average-life').textContent = summary.life == null ? '—' : `${summary.life.toFixed(1)} years`;
  $('empty-state').hidden = points.length > 0;
  $('empty-state').textContent = !state.continents.size ? 'Select a continent below to see its countries.' : state.data.missingYears.includes(year) ? `No data for ${year}. The supplied files skip this year.` : 'No complete observations for the selected continents in this year.';
  renderHighlights();
}

function renderHighlights() {
  if (!state.data || !dimensions) return;
  const active = state.hovered ?? state.selected;
  const point = active && state.continents.has(active.continent) ? observation(active, state.year, state.data.years[0]) : null;
  for (const [name, circle] of circles) {
    circle.style.fillOpacity = active && name !== active.name ? '.24' : '.76';
    circle.style.strokeOpacity = active && name !== active.name ? '.3' : '.95';
    circle.style.strokeWidth = active?.name === name ? '2' : '1';
  }
  $('bubble-labels').replaceChildren();
  if (point) {
    const radius = bubbleRadius(point.population, maxRadius());
    const isRight = x(point.income) > dimensions.width - 160;
    const anchor = isRight ? 'end' : 'start';
    const tx = x(point.income) + (isRight ? -radius - 7 : radius + 7);
    $('bubble-labels').append(svgElement('text', { x: tx, y: y(point.life) + 4, 'text-anchor': anchor }, point.country.name));
  }
  renderTooltip(active, point);
  renderTrail();
}

function renderTooltip(country, point) {
  $('tooltip').hidden = !country;
  if (!country) return;
  const title = document.createElement('h3'); title.textContent = country.name;
  const dot = document.createElement('span'); dot.className = 'color-dot'; dot.style.background = COLORS[country.continent];
  const header = document.createElement('div'); header.className = 'tooltip-header'; header.append(dot, title);
  const sub = document.createElement('p'); sub.className = 'tooltip-subtitle'; sub.textContent = `${country.continent} · ${Math.round(state.year)}`;
  const dl = document.createElement('dl');
  if (point) {
    for (const [label, value] of [['Income per person', number.format(point.income)], ['Life expectancy', `${point.life.toFixed(1)} years`], ['Population', number.format(point.population)]]) {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; row.append(dt, dd); dl.append(row);
    }
  } else {
    const note = document.createElement('p'); note.className = 'tooltip-subtitle';
    note.textContent = state.continents.has(country.continent) ? 'No complete data for this year.' : 'This continent is currently hidden.';
    dl.append(note);
  }
  const hint = document.createElement('p'); hint.className = 'tooltip-hint';
  hint.textContent = state.selected === country ? 'Following this country · select again to clear' : 'Select this bubble to follow its journey';
  $('tooltip').replaceChildren(header, sub, dl, hint);
}

function renderTrail() {
  const country = state.selected;
  if (!country || !$('show-trail').checked || !state.continents.has(country.continent)) { $('country-trail').setAttribute('d', ''); return; }
  let path = '', previous = false;
  for (const year of state.data.years) {
    if (year > state.year) break;
    const p = observation(country, year, state.data.years[0]);
    if (!p) { previous = false; continue; }
    path += `${previous ? 'L' : 'M'}${x(p.income).toFixed(2)},${y(p.life).toFixed(2)} `;
    previous = true;
  }
  const last = observation(country, state.year, state.data.years[0]);
  if (last && previous) path += `L${x(last.income)},${y(last.life)}`;
  $('country-trail').setAttribute('d', path);
  $('country-trail').setAttribute('stroke', COLORS[country.continent]);
  $('country-trail').setAttribute('opacity', '.65');
}

function selectCountry(country) {
  state.selected = country; state.hovered = null;
  $('selected-country').hidden = !country;
  $('trail-control').hidden = !country;
  $('selected-country').replaceChildren();
  if (country) {
    const label = document.createElement('span'); label.textContent = country.name;
    const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', `Stop following ${country.name}`);
    close.addEventListener('click', () => selectCountry(null));
    $('selected-country').append(label, close);
    state.continents.add(country.continent); updateFilters();
  }
  $('country-search').value = ''; closeSearch(); render();
}

function setYear(value) {
  if (!state.data) return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  state.year = Math.max(state.data.years[0], Math.min(state.data.years.at(-1), Math.round(parsed)));
  render();
}

function setPlaying(playing) {
  if (!state.data) return;
  if (state.frame != null) cancelAnimationFrame(state.frame);
  state.frame = null;
  state.playing = playing;
  $('play-button').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
  $('play-button').innerHTML = playing
    ? '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M5 4h3v12H5zM12 4h3v12h-3z" fill="currentColor"/></svg><span>Pause</span>'
    : '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M6 3.5 16 10 6 16.5Z" fill="currentColor"/></svg><span>Play</span>';
  if (playing) {
    if (state.year >= state.data.years.at(-1)) state.year = state.data.years[0];
    state.lastFrame = 0; state.lastDraw = 0;
    $('tooltip').setAttribute('aria-live', 'off');
    state.frame = requestAnimationFrame(animate);
  } else {
    state.year = Math.round(state.year);
    $('tooltip').setAttribute('aria-live', 'polite'); render();
  }
}

function animate(now) {
  if (!state.playing) return;
  if (state.lastFrame) state.year += Math.min((now - state.lastFrame) / 1000, .1) * 6 * Number($('playback-speed').value);
  state.lastFrame = now;
  if (state.year >= state.data.years.at(-1)) { state.year = state.data.years.at(-1); setPlaying(false); return; }
  if (now - state.lastDraw > 32) { render(); state.lastDraw = now; }
  state.frame = requestAnimationFrame(animate);
}

function updateFilters() {
  for (const button of $('continent-filters').children) button.setAttribute('aria-pressed', String(state.continents.has(button.dataset.continent)));
  $('reset-filters').hidden = state.continents.size === Object.keys(COLORS).length;
  $('view-heading').textContent = state.continents.size === 6 ? 'The whole world' : state.continents.size === 1 ? [...state.continents][0] : `${state.continents.size} continents`;
}

function closeSearch() { $('search-results').hidden = true; $('country-search').setAttribute('aria-expanded', 'false'); searchIndex = -1; }
function search() {
  const query = $('country-search').value.trim().toLocaleLowerCase();
  const matches = query ? state.data.countries.filter(c => c.name.toLocaleLowerCase().includes(query)).slice(0, 12) : [];
  $('search-results').replaceChildren();
  for (const country of matches) {
    const li = document.createElement('li'); li.setAttribute('role', 'option');
    const button = document.createElement('button');
    const dot = document.createElement('span'); dot.className = 'color-dot'; dot.style.background = COLORS[country.continent];
    button.append(dot, document.createTextNode(country.name));
    button.addEventListener('click', () => selectCountry(country));
    li.append(button); $('search-results').append(li);
  }
  if (query && !matches.length) {
    const li = document.createElement('li'); li.className = 'no-results'; li.textContent = 'No matching countries'; $('search-results').append(li);
  }
  $('search-results').hidden = !query;
  $('country-search').setAttribute('aria-expanded', String(Boolean(query))); searchIndex = -1;
}

function setupEvents() {
  $('play-button').addEventListener('click', () => setPlaying(!state.playing));
  $('restart-button').addEventListener('click', () => { setPlaying(false); setYear(state.data.years[0]); });
  $('year-slider').addEventListener('input', event => { const value = event.target.value; setPlaying(false); setYear(value); });
  $('year-input').addEventListener('change', event => { const value = event.target.value || state.year; setPlaying(false); setYear(value); event.target.value = state.year; });
  $('year-input').addEventListener('focus', () => { if (state.playing) setPlaying(false); });
  $('show-trail').addEventListener('change', renderTrail);
  $('country-search').addEventListener('input', search);
  $('country-search').addEventListener('keydown', event => {
    const buttons = [...$('search-results').querySelectorAll('button')];
    if (event.key === 'ArrowDown' && buttons.length) { event.preventDefault(); buttons[0].focus(); searchIndex = 0; }
    if (event.key === 'Enter' && buttons.length) { event.preventDefault(); buttons[0].click(); $('country-search').blur(); }
    if (event.key === 'Escape') closeSearch();
  });
  $('search-results').addEventListener('keydown', event => {
    const buttons = [...$('search-results').querySelectorAll('button')];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); searchIndex = (searchIndex + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[searchIndex]?.focus();
    }
    if (event.key === 'Escape') { closeSearch(); $('country-search').focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) closeSearch(); });
  document.addEventListener('keydown', event => {
    if ($('about-dialog').open || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    if (event.key === ' ') { event.preventDefault(); setPlaying(!state.playing); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPlaying(false); setYear(state.year + (event.key === 'ArrowRight' ? 1 : -1)); }
    if (event.key === '/') { event.preventDefault(); $('country-search').focus(); }
    if (event.key === 'Escape') selectCountry(null);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) setPlaying(false); });
  window.addEventListener('blur', () => { if (state.playing) setPlaying(false); });
  $('reset-filters').addEventListener('click', () => { state.continents = new Set(Object.keys(COLORS)); updateFilters(); render(); });
  for (const [continent, color] of Object.entries(COLORS)) {
    const button = document.createElement('button'); button.dataset.continent = continent; button.setAttribute('aria-pressed', 'true');
    const dot = document.createElement('span'); dot.className = 'color-dot'; dot.style.background = color;
    button.append(dot, document.createTextNode(continent));
    button.addEventListener('click', () => { state.continents.has(continent) ? state.continents.delete(continent) : state.continents.add(continent); state.hovered = null; updateFilters(); render(); });
    $('continent-filters').append(button);
  }
  new ResizeObserver(resize).observe($('chart-wrap'));
}

for (const id of ['about-button', 'methodology-button', 'summary-info']) $(id).addEventListener('click', () => { if (state.playing) setPlaying(false); $('about-dialog').showModal(); });
$('close-dialog').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', event => { if (event.target === $('about-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });

async function initialize() {
  try {
    const response = await fetch(new URL('../data/world.json', import.meta.url));
    if (!response.ok) throw new Error(`Dataset returned ${response.status}`);
    state.data = await response.json();
    if (!state.data.countries.length || !state.data.years.length) throw new Error('Empty dataset');
    createCountries(); setupEvents(); resize();
    $('loading').hidden = true; $('chart-wrap').setAttribute('aria-busy', 'false');
    for (const id of ['play-button', 'restart-button', 'year-slider', 'year-input', 'country-search']) $(id).disabled = false;
  } catch (error) {
    console.error('Could not initialize the world chart:', error);
    $('loading').textContent = 'The data could not be loaded. Please refresh to try again.';
    $('loading').setAttribute('role', 'alert'); $('chart-wrap').setAttribute('aria-busy', 'false');
  }
}

initialize();
