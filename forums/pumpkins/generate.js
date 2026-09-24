/* ============================================================
 *  Генерация параметров тыквы из текста — UI.
 *
 *  Зависимости:
 *    - pumpkin.js      : класс Pumpkin
 *    - words.js        : объект RULES со словарём слов
 *    - pumpkin-core.js : вся логика генерации
 *
 *  UI-логика: ползунки, треугольник эмоций, экспорт.
 * ============================================================ */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const pumpkin = new Pumpkin($('cv'));
  const Core = window.PumpkinCore;

  // синхронизация чувствительностей с ядром
  const SENS = Core.getSens();

  // UI-ползунки
  const SENS_CONTROLS = [
    ['tw',      's-tw',      'l-tw',      2],
    ['mw',      's-mw',      'l-mw',      2],
    ['bw',      's-bw',      'l-bw',      2],
    ['lw',      's-lw',      'l-lw',      2],
    ['rw',      's-rw',      'l-rw',      2],
    ['fs',      's-fs',      'l-fs',      2],
    ['ts',      's-ts',      'l-ts',      0],
    ['ms',      's-ms',      'l-ms',      0],
    ['bs',      's-bs',      'l-bs',      0],
    ['sk',      's-sk',      'l-sk',      0],
    ['rt',      's-rt',      'l-rt',      0],
    ['fx',      's-fx',      'l-fx',      2],
    ['fy',      's-fy',      'l-fy',      2],
    ['int',     's-int',     'l-int',     2],
    ['shade',   's-shade',   'l-shade',   2],
    ['lit',     's-lit',     'l-lit',     2],
    ['rgb',     's-rgb',     'l-rgb',     0],
    ['bwshift', 's-bwshift', 'l-bwshift', 2],
    ['tint',    's-tint',    'l-tint',    2],
    ['K',       's-K',       'l-K',       2],
  ];

  function syncSensFromUI() {
    for (const [key, inputId, labelId, digits] of SENS_CONTROLS) {
      const input = $(inputId);
      const label = $(labelId);
      const v = parseFloat(input.value);
      SENS[key] = v;
      label.textContent = v.toFixed(digits);
    }
    Core.setSens(SENS);
  }

  function resetSensUI() {
    const d = Core.DEFAULTS;
    for (const [key, inputId, labelId, digits] of SENS_CONTROLS) {
      const v = d[key];
      if (v === undefined) continue;
      $(inputId).value = v;
      $(labelId).textContent = v.toFixed(digits);
    }
    syncSensFromUI();
    if (lastAnalysis) applyFromAnalysis(lastAnalysis);
    else pumpkin.render();
  }

  for (const [, inputId] of SENS_CONTROLS) {
    $(inputId).addEventListener('input', () => {
      syncSensFromUI();
      if (lastAnalysis) applyFromAnalysis(lastAnalysis);
    });
  }

  $('tunerReset').addEventListener('click', resetSensUI);

  $('toggleTuner').addEventListener('click', () => {
    const aside = $('tuner');
    aside.classList.toggle('collapsed');
    $('toggleTuner').textContent = aside.classList.contains('collapsed') ? '▶' : '◀';
    setTimeout(() => resize(), 220);
  });

  // ---- общий множитель интенсивности ----
  const sensInput = $('sens');
  const sensLabel = $('v-sens');

  function readGlobalSens() {
    const v = parseFloat(sensInput.value) || 0;
    Core.setGlobalSens(v);
    sensLabel.textContent = v.toFixed(2) + '×';
  }

  sensInput.addEventListener('input', () => {
    readGlobalSens();
    if (lastAnalysis) applyFromAnalysis(lastAnalysis);
  });

  document.querySelectorAll('.slider-scale span').forEach(el => {
    el.addEventListener('click', () => {
      sensInput.value = el.dataset.sens;
      readGlobalSens();
      if (lastAnalysis) applyFromAnalysis(lastAnalysis);
    });
  });

  // ---- анализ и применение ----
  let lastAnalysis = null;

  function applyFromAnalysis(a) {
    const params = Core.computeParams(a);

    const forPumpkin = { ...params };
    delete forPumpkin.exportHeight;
    delete forPumpkin._emotion;

    pumpkin.setParams(forPumpkin);
    pumpkin.render();

    renderBreakdown(a, params._emotion, params.exportHeight);
    renderParams(params);

    const totalHits = Object.values(a.raw).reduce((s, x) => s + x, 0);
    $('stats').innerHTML =
      `Слов: <b>${a.wordCount}</b> · ` +
      `категорий: <b>${Object.keys(a.raw).length}</b> · ` +
      `попаданий: <b>${totalHits}</b>`;
  }

  function regenerate() {
    const text = $('input').value;
    const words = Core.tokenize(text);
    lastAnalysis = Core.analyze(words);
    applyFromAnalysis(lastAnalysis);
  }

  // ---- UI разбора ----
  function renderTriangleSVG(emo) {
    const cx = 60, cy = 20;
    const lx = 20, ly = 100;
    const rx = 100, ry = 100;

    const pSad   = emo.proportions.sad;
    const pJoy   = emo.proportions.joy;
    const pAngry = emo.proportions.angry;
    const px = pSad * lx + pJoy * cx + pAngry * rx;
    const py = pSad * ly + pJoy * cy + pAngry * ry;

    return `
      <svg width="120" height="120" viewBox="0 0 120 120"
           xmlns="http://www.w3.org/2000/svg" style="display:block">
        <polygon points="${lx},${ly} ${cx},${cy} ${rx},${ry}"
                 fill="none" stroke="#4a4a58" stroke-width="1.5"/>
        <text x="${lx - 4}" y="${ly + 12}" fill="#9ab" font-size="9" text-anchor="middle">ГР</text>
        <text x="${rx + 4}" y="${ry + 12}" fill="#9ab" font-size="9" text-anchor="middle">ЗЛ</text>
        <text x="${cx}" y="${cy - 6}" fill="#9ab" font-size="9" text-anchor="middle">РД</text>
        <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4"
                fill="#ff8c1a" stroke="#1e1e24" stroke-width="1.5"/>
      </svg>
    `;
  }

  function renderBreakdown(a, emo, exportHeight) {
    const box = $('breakdown');
    box.innerHTML = '';

    if (emo.proportions.sad + emo.proportions.joy + emo.proportions.angry > 0) {
      const catEl = document.createElement('div');
      catEl.className = 'cat';
      catEl.textContent = 'Эмоции (треугольник)';
      box.appendChild(catEl);

      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '10px';
      wrap.style.alignItems = 'center';
      wrap.style.paddingLeft = '10px';
      wrap.style.marginTop = '4px';

      const svg = document.createElement('div');
      svg.innerHTML = renderTriangleSVG(emo);
      wrap.appendChild(svg);

      const p = emo.proportions;
      const info = document.createElement('div');
      info.style.fontSize = '11px';
      info.style.lineHeight = '1.6';
      info.innerHTML =
        `<span class="hit">грусть ${(p.sad * 100).toFixed(0)}%</span><br>` +
        `<span class="hit">радость ${(p.joy * 100).toFixed(0)}%</span><br>` +
        `<span class="hit">злость ${(p.angry * 100).toFixed(0)}%</span><br>` +
        `<span class="muted">tone=${emo.tone.toFixed(2)} mood=${emo.mood.toFixed(2)}</span><br>` +
        `<span class="muted">int=${emo.intensity.toFixed(2)}</span>`;
      wrap.appendChild(info);
      box.appendChild(wrap);
    }

    const rules = window.RULES || {};
    const byParam = {};
    for (const [cat, rule] of Object.entries(rules)) {
      if (cat.startsWith('emo_')) continue;
      const m = cat.match(/^(.+?)_(plus|minus)$/);
      const key = m ? m[1] : cat;
      const dir = m ? m[2] : '';
      if (!byParam[key]) byParam[key] = { plus: null, minus: null, other: [] };
      if (dir === 'plus')       byParam[key].plus = cat;
      else if (dir === 'minus') byParam[key].minus = cat;
      else                      byParam[key].other.push(cat);
    }

    const NICE = {
      int: 'интенсивность', shade: 'тени', lit: 'блик',
      tw: 'ширина верха', mw: 'ширина середины', bw: 'ширина низа',
      lw: 'левая половина', rw: 'правая половина',
      hh: 'высота картинки',
      ts: 'сдвиг верха', ms: 'сдвиг середины', bs: 'сдвиг низа',
      sk: 'наклон', rt: 'поворот',
      fx: 'лицо X', fy: 'лицо Y', fs: 'масштаб лица',
      size: 'общий размер',
      r: 'красный', g: 'зелёный', b: 'синий',
      tint: 'сила перекраски',
      to_black: 'к чёрному', to_white: 'к белому',
    };

    for (const [key, grp] of Object.entries(byParam)) {
      const cats = [grp.plus, grp.minus, ...grp.other].filter(Boolean);
      const active = cats.filter(c => a.raw[c]);
      if (active.length === 0) continue;

      const catEl = document.createElement('div');
      catEl.className = 'cat';
      catEl.textContent = NICE[key] || key;
      box.appendChild(catEl);

      for (const c of active) {
        const line = document.createElement('div');
        line.className = 'line';
        const words = (a.hits[c] || []).slice(0, 12);
        const more = (a.hits[c] || []).length > 12 ? '…' : '';
        line.innerHTML =
          `<span class="muted">${c}</span> ` +
          `<span class="score">${a.raw[c]}</span> · ` +
          words.map(w => `<span class="hit">${w}</span>`).join(', ') + more;
        box.appendChild(line);
      }
    }

    const sizeEl = document.createElement('div');
    sizeEl.className = 'cat';
    sizeEl.style.marginTop = '10px';
    sizeEl.innerHTML = `Размер экспорта: <span class="score">${exportHeight}px</span> по высоте`;
    box.appendChild(sizeEl);
  }

  function renderParams(p) {
    const fields = [
      'tone', 'mood', 'int', 'shade', 'lit',
      'tw', 'mw', 'bw', 'lw', 'rw',
      'ts', 'ms', 'bs', 'sk', 'rt',
      'fx', 'fy', 'fs',
    ];
    const box = $('params');
    box.innerHTML = fields
      .map(f => `<div>${f} <span>${p[f]}</span></div>`)
      .join('') +
      `<div>fill <span>${p.fill}</span></div>` +
      `<div>exportHeight <span>${p.exportHeight}</span></div>`;
  }

  // ---- кнопки ----
  $('gen').addEventListener('click', regenerate);

  $('demo').addEventListener('click', () => {
    $('input').value =
      'Мне так грустно и тоскливо на душе. Всё кажется унылым и печальным. ' +
      'Я одинок, и хочется плакать тихо, спокойно, без слёз.';
    regenerate();
  });

  $('input').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      regenerate();
    }
  });

  // ---- resize ----
  function resize() {
    pumpkin.resizeToContainer($('stage'));
  }
  window.addEventListener('resize', resize);

  // ---- старт ----
  syncSensFromUI();
  readGlobalSens();
  resize();
  pumpkin.render();
})();