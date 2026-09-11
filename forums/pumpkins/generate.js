/* ============================================================
 *  Генерация параметров тыквы из текста.
 *
 *  Зависимости:
 *    - pumpkin.js : класс Pumpkin
 *    - words.js   : объект RULES со словарём слов
 *
 *  Все чувствительности хранятся в объекте SENS и читаются
 *  с ползунков в левой панели UI при каждом пересчёте.
 *  Глобальный множитель intensity умножается поверх.
 *
 *  ЦВЕТ:
 *    - три канала R, G, B считаются независимо;
 *    - канал, который «победил», тянет свой канал к 255;
 *    - канал, который «проиграл», тянет свой к 0;
 *    - доминирующие каналы взаимно подавляют остальные
 *      (чтобы цвет был насыщеннее, а не серым);
 *    - чёрное/белое считается РАЗНОСТЬЮ и применяется
 *      поверх как общий сдвиг яркости.
 * ============================================================ */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const pumpkin = new Pumpkin($('cv'));

  // ============================================================
  //  БАЗОВЫЕ ЗНАЧЕНИЯ (сбрасываются кнопкой «Сбросить»)
  // ============================================================
  const DEFAULTS = {
    K:      2.5,
    int:    1.2,
    shade:  1.0,
    lit:    1.0,
    tw:     1.5,
    mw:     2.0,
    bw:     1.5,
    lw:     1.2,
    rw:     1.2,
    hh:     1.5,
    ts:     60,
    ms:     60,
    bs:     60,
    sk:     30,
    rt:     120,
    fx:     0.5,
    fy:     0.5,
    fs:     0.8,
    rgb:    140,
    bwshift: 1.0,
  };

  // Текущие значения — читаются с ползунков.
  const SENS = { ...DEFAULTS };

  // Глобальный множитель (правый ползунок)
  let globalSens = 1.0;

  // Базовый цвет заливки
  const BASE_COLOR = { r: 0xf2, g: 0x8c, b: 0x1a };  // #f28c1a

  const BASE = {
    emo: 0.5, int: 1,
    shade: 0.55, lit: 0.35,
    tw: 1, mw: 1, bw: 1,
    lw: 1, rw: 1, hh: 1,
    ts: 0, ms: 0, bs: 0,
    sk: 0, rt: 0,
    fx: 0, fy: 0, fs: 1,
  };

  // ============================================================
  //  ТОКЕНИЗАЦИЯ
  // ============================================================
  function tokenize(text) {
    const cleaned = text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned ? cleaned.split(' ') : [];
  }

  // ============================================================
  //  АНАЛИЗ
  // ============================================================
  function analyze(words) {
    const raw = {};
    const hits = {};

    for (const word of words) {
      for (const [cat, rule] of Object.entries(RULES)) {
        if (!rule.words || rule.words.length === 0) continue;
        const w = rule.weight ?? 1;
        for (const trigger of rule.words) {
          if (trigger && word.includes(trigger)) {
            raw[cat] = (raw[cat] || 0) + w;
            (hits[cat] = hits[cat] || []).push(word);
            break;
          }
        }
      }
    }

    // Гиперболическая сатурация: score = n / (n + K)
    const K = SENS.K;
    const scores = {};
    for (const [cat, n] of Object.entries(raw)) {
      scores[cat] = n / (n + K);
    }

    return { wordCount: words.length, raw, scores, hits };
  }

  // ============================================================
  //  ЭМОЦИИ
  // ============================================================
  function computeEmotion(scores) {
    const sad   = scores.emo_sad   || 0;
    const joy   = scores.emo_joy   || 0;
    const angry = scores.emo_angry || 0;
    const total = sad + joy + angry;

    if (total < 0.001) {
      return {
        emo: 0.5,
        intBonus: 0,
        proportions: { sad: 0, joy: 0, angry: 0 },
      };
    }

    const pSad   = sad   / total;
    const pJoy   = joy   / total;
    const pAngry = angry / total;

    const emo = pSad * 0 + pJoy * 0.5 + pAngry * 1.0;
    const intBonus = Math.min(0.8, total * 0.5 * globalSens);

    return {
      emo,
      intBonus,
      proportions: { sad: pSad, joy: pJoy, angry: pAngry },
    };
  }

  // ============================================================
  //  ПАРАМЕТРЫ ИЗ АНАЛИЗА
  // ============================================================
  function applyScale(baseValue, plusScore, minusScore, sens) {
    const delta = (plusScore || 0) - (minusScore || 0);
    return baseValue + delta * sens * globalSens;
  }

  function computeParams(a) {
    const s = a.scores;

    const emo = computeEmotion(s);

    let int = applyScale(BASE.int, s.int_plus, s.int_minus, SENS.int);
    int += emo.intBonus;
    int = clamp(int, 0, 1.5);

    const shade = clamp(
      applyScale(BASE.shade, s.shade_plus, s.shade_minus, SENS.shade),
      0, 1
    );
    const lit = clamp(
      applyScale(BASE.lit, s.lit_plus, s.lit_minus, SENS.lit),
      0, 1
    );

    const tw = clamp(applyScale(BASE.tw, s.tw_plus, s.tw_minus, SENS.tw), 0.2, 2);
    const mw = clamp(applyScale(BASE.mw, s.mw_plus, s.mw_minus, SENS.mw), 0.2, 2.5);
    const bw = clamp(applyScale(BASE.bw, s.bw_plus, s.bw_minus, SENS.bw), 0.2, 2);
    const lw = clamp(applyScale(BASE.lw, s.lw_plus, s.lw_minus, SENS.lw), 0.3, 2);
    const rw = clamp(applyScale(BASE.rw, s.rw_plus, s.rw_minus, SENS.rw), 0.3, 2);
    const hh = clamp(applyScale(BASE.hh, s.hh_plus, s.hh_minus, SENS.hh), 0.3, 2);

    const ts = clamp(applyScale(BASE.ts, s.ts_plus, s.ts_minus, SENS.ts), -80, 80);
    const ms = clamp(applyScale(BASE.ms, s.ms_plus, s.ms_minus, SENS.ms), -80, 80);
    const bs = clamp(applyScale(BASE.bs, s.bs_plus, s.bs_minus, SENS.bs), -80, 80);

    const sk = clamp(applyScale(BASE.sk, s.sk_plus, s.sk_minus, SENS.sk), -45, 45);
    const rt = clamp(applyScale(BASE.rt, s.rt_plus, s.rt_minus, SENS.rt), -180, 180);

    let fx = clamp(applyScale(BASE.fx, s.fx_plus, s.fx_minus, SENS.fx), -0.4, 0.4);
    let fy = clamp(applyScale(BASE.fy, s.fy_plus, s.fy_minus, SENS.fy), -0.4, 0.4);
    let fs = clamp(applyScale(BASE.fs, s.fs_plus, s.fs_minus, SENS.fs), 0.4, 1.6);

    const sizeDelta = (s.size_plus || 0) - (s.size_minus || 0);
    fs = clamp(fs + sizeDelta * SENS.fs * 0.5 * globalSens, 0.4, 1.6);

    const fill = computeColor(s);

    return {
      emo: r3(emo.emo),
      int: r3(int),
      shade: r3(shade),
      lit: r3(lit),
      tw: r3(tw), mw: r3(mw), bw: r3(bw),
      lw: r3(lw), rw: r3(rw), hh: r3(hh),
      ts: Math.round(ts), ms: Math.round(ms), bs: Math.round(bs),
      sk: Math.round(sk), rt: Math.round(rt),
      fx: r3(fx), fy: r3(fy), fs: r3(fs),
      fill,
    };
  }

  // ============================================================
  //  ЦВЕТ
  // ============================================================
  //
  //  Алгоритм:
  //
  //  1) Считаем веса каналов: wR, wG, wB.
  //     >0 — канал хочет быть ярким (тянется к 255),
  //     <0 — канал хочет быть тёмным (тянется к 0).
  //
  //  2) Нормируем: RGB_MIX = SENS.rgb / 60 (подобрано так,
  //     чтобы одно попадание давало заметный сдвиг).
  //
  //  3) Считаем целевые значения каналов от базы. Канал
  //     с положительным весом тянется к 255, с отрицательным —
  //     к 0, пропорционально |w| * RGB_MIX (clamp до 1).
  //
  //  4) Взаимное подавление: если канал доминирует (w > 0),
  //     он придавливает остальные каналы — это делает цвет
  //     более насыщенным и не даёт ему уйти в серо-белый.
  //
  //  5) Ч/б применяется РАЗНОСТЬЮ поверх всего. Если
  //     blackScore и whiteScore равны — ничего не происходит.
  //
  function computeColor(s) {
    // 1) веса каналов
    const rW = (s.r_plus || 0) - (s.r_minus || 0);
    const gW = (s.g_plus || 0) - (s.g_minus || 0);
    const bW = (s.b_plus || 0) - (s.b_minus || 0);

    // 2) коэффициент пропорции
    const RGB_MIX = (SENS.rgb / 60) * globalSens;

    // 3) целевые значения каналов
    let rT = BASE_COLOR.r;
    let gT = BASE_COLOR.g;
    let bT = BASE_COLOR.b;

    // положительный вес — тянем к 255, отрицательный — к 0
    if (rW > 0)      rT = rT + (255 - rT) * Math.min(1, rW * RGB_MIX);
    else if (rW < 0) rT = rT * (1 - Math.min(1, -rW * RGB_MIX));

    if (gW > 0)      gT = gT + (255 - gT) * Math.min(1, gW * RGB_MIX);
    else if (gW < 0) gT = gT * (1 - Math.min(1, -gW * RGB_MIX));

    if (bW > 0)      bT = bT + (255 - bT) * Math.min(1, bW * RGB_MIX);
    else if (bW < 0) bT = bT * (1 - Math.min(1, -bW * RGB_MIX));

    // 4) ВЗАИМНОЕ ПОДАВЛЕНИЕ.
    //    Считаем «силу» каждого положительного канала.
    //    Если канал доминирует, остальные получают штраф.
    //    Штраф — доля, на которую уменьшается канал.
    const rBoost = Math.max(0, rW);
    const gBoost = Math.max(0, gW);
    const bBoost = Math.max(0, bW);

    // коэффициент подавления: 0.4 значит, что при полной
    // доминации одного канала другие падают почти в 2 раза.
    // Можно регулировать через SENS — здесь жёстко 0.4.
    const SUPPRESS = 0.4;

    // каждый канал штрафуется суммой чужих boost'ов
    const rSuppress = Math.min(1, (gBoost + bBoost) * RGB_MIX * SUPPRESS);
    const gSuppress = Math.min(1, (rBoost + bBoost) * RGB_MIX * SUPPRESS);
    const bSuppress = Math.min(1, (rBoost + gBoost) * RGB_MIX * SUPPRESS);

    // если сам канал «плюсовой» — его штраф слабее
    // (он же хочет быть ярким), если нет — штраф полный.
    rT = rT * (1 - (rBoost > 0 ? rSuppress * 0.3 : rSuppress));
    gT = gT * (1 - (gBoost > 0 ? gSuppress * 0.3 : gSuppress));
    bT = bT * (1 - (bBoost > 0 ? bSuppress * 0.3 : bSuppress));

    // 5) Ч/Б — разность. blackScore и whiteScore взаимно
    //    компенсируются, а не складываются.
    const blackScore = s.to_black || 0;
    const whiteScore = s.to_white || 0;
    const bwNet = (whiteScore - blackScore) * SENS.bwshift * globalSens;

    if (bwNet > 0) {
      const k = Math.min(1, bwNet);
      rT = rT * (1 - k) + 255 * k;
      gT = gT * (1 - k) + 255 * k;
      bT = bT * (1 - k) + 255 * k;
    } else if (bwNet < 0) {
      const k = Math.min(1, -bwNet);
      rT = rT * (1 - k);
      gT = gT * (1 - k);
      bT = bT * (1 - k);
    }

    const r = Math.round(clamp(rT, 0, 255));
    const g = Math.round(clamp(gT, 0, 255));
    const b = Math.round(clamp(bT, 0, 255));

    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r3 = v => Math.round(v * 1000) / 1000;

  // ============================================================
  //  UI: РАЗБОР
  // ============================================================
  function renderBreakdown(a, emotion) {
    const box = $('breakdown');
    box.innerHTML = '';

    if (emotion.proportions.sad + emotion.proportions.joy + emotion.proportions.angry > 0) {
      const catEl = document.createElement('div');
      catEl.className = 'cat';
      catEl.textContent = 'Эмоции (пропорции)';
      box.appendChild(catEl);

      const p = emotion.proportions;
      const line = document.createElement('div');
      line.className = 'line';
      line.innerHTML =
        `<span class="hit">грусть ${(p.sad * 100).toFixed(0)}%</span> · ` +
        `<span class="hit">радость ${(p.joy * 100).toFixed(0)}%</span> · ` +
        `<span class="hit">злость ${(p.angry * 100).toFixed(0)}%</span>`;
      box.appendChild(line);
    }

    const byParam = {};
    for (const [cat, rule] of Object.entries(RULES)) {
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
      lw: 'левая половина', rw: 'правая половина', hh: 'общая высота',
      ts: 'сдвиг верха', ms: 'сдвиг середины', bs: 'сдвиг низа',
      sk: 'наклон', rt: 'поворот',
      fx: 'лицо X', fy: 'лицо Y', fs: 'масштаб лица',
      size: 'общий размер',
      r: 'красный', g: 'зелёный', b: 'синий',
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
  }

  function renderParams(p) {
    const fields = [
      'emo', 'int', 'shade', 'lit',
      'tw', 'mw', 'bw', 'lw', 'rw', 'hh',
      'ts', 'ms', 'bs', 'sk', 'rt',
      'fx', 'fy', 'fs',
    ];
    const box = $('params');
    box.innerHTML = fields
      .map(f => `<div>${f} <span>${p[f]}</span></div>`)
      .join('') +
      `<div>fill <span>${p.fill}</span></div>`;
  }

  // ============================================================
  //  ГЛАВНАЯ ФУНКЦИЯ
  // ============================================================
  let lastAnalysis = null;

  function applyFromAnalysis(a) {
    const params = computeParams(a);
    pumpkin.setParams(params);
    pumpkin.render();

    const emotion = computeEmotion(a.scores);
    renderBreakdown(a, emotion);
    renderParams(params);

    const totalHits = Object.values(a.raw).reduce((s, x) => s + x, 0);
    $('stats').innerHTML =
      `Слов: <b>${a.wordCount}</b> · ` +
      `категорий: <b>${Object.keys(a.raw).length}</b> · ` +
      `попаданий: <b>${totalHits}</b>`;
  }

  function regenerate() {
    const text = $('input').value;
    const words = tokenize(text);
    lastAnalysis = analyze(words);
    applyFromAnalysis(lastAnalysis);
  }

  // ============================================================
  //  ЛЕВАЯ ПАНЕЛЬ: ПОЛЗУНКИ ЧУВСТВИТЕЛЬНОСТИ
  // ============================================================
  const SENS_CONTROLS = [
    ['tw',      's-tw',      'l-tw',      2],
    ['mw',      's-mw',      'l-mw',      2],
    ['bw',      's-bw',      'l-bw',      2],
    ['lw',      's-lw',      'l-lw',      2],
    ['rw',      's-rw',      'l-rw',      2],
    ['hh',      's-hh',      'l-hh',      2],
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
  }

  function resetSensUI() {
    for (const [key, inputId, labelId, digits] of SENS_CONTROLS) {
      const v = DEFAULTS[key];
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

  // ============================================================
  //  ПРАВАЯ ПАНЕЛЬ: ГЛОБАЛЬНЫЙ МНОЖИТЕЛЬ + ГЕНЕРАЦИЯ
  // ============================================================
  const sensInput = $('sens');
  const sensLabel = $('v-sens');

  function readGlobalSens() {
    globalSens = parseFloat(sensInput.value) || 0;
    sensLabel.textContent = globalSens.toFixed(2) + '×';
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

  // ============================================================
  //  RESIZE
  // ============================================================
  function resize() {
    pumpkin.resizeToContainer($('stage'));
  }
  window.addEventListener('resize', resize);

  // старт
  syncSensFromUI();
  readGlobalSens();
  resize();
  pumpkin.render();
})();