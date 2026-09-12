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
 *  ЦВЕТ — через HSL-тонирование:
 *    - rgb-шкалы переосмыслены как сдвиги ОТТЕНКА (hue);
 *    - каждое срабатывание даёт вектор на hue-круге,
 *      векторы складываются, итог — результирующий угол;
 *    - ч/б считается разностью и меняет светлоту L;
 *    - НОВЫЙ параметр tint регулирует «непрозрачность»
 *      перекраски: при tint=0 цвет не меняется вообще,
 *      при tint=1 тонирование применяется полностью,
 *      при tint>1 — с перекрутом.
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
    tint:    1.0,
  };

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
  //  ЦВЕТ ЧЕРЕЗ HSL-ТОНИРОВАНИЕ
  // ============================================================

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        case b: h = ((r - g) / d + 4); break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (hp < 1)      [r1, g1, b1] = [c, x, 0];
    else if (hp < 2) [r1, g1, b1] = [x, c, 0];
    else if (hp < 3) [r1, g1, b1] = [0, c, x];
    else if (hp < 4) [r1, g1, b1] = [0, x, c];
    else if (hp < 5) [r1, g1, b1] = [x, 0, c];
    else             [r1, g1, b1] = [c, 0, x];
    const m = l - c / 2;
    const to255 = v => Math.round(Math.max(0, Math.min(255, (v + m) * 255)));
    return '#' + [to255(r1), to255(g1), to255(b1)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
  }

  const BASE_HSL = hexToHsl('#' +
    [BASE_COLOR.r, BASE_COLOR.g, BASE_COLOR.b]
      .map(v => v.toString(16).padStart(2, '0')).join(''));

  const HUE_TARGET = {
    r_plus:  0,
    r_minus: 180,
    g_plus:  120,
    g_minus: 300,
    b_plus:  240,
    b_minus: 45,
  };

  function mixCurve(weight, k) {
    if (weight <= 0) return 0;
    return 1 - Math.exp(-weight * k);
  }

  // Считаем tint-фактор: сколько раз применять перекраску.
  // 0 → вообще не красить, 1 → норма, >1 → перекрут.
  function computeTintFactor(s) {
    const plus  = s.tint_plus  || 0;
    const minus = s.tint_minus || 0;
    const delta = plus - minus;
    // база 1.0, сдвиг вниз/вверх с учётом SENS.tint
    const factor = 1 + delta * SENS.tint * globalSens;
    return Math.max(0, factor);
  }

  function computeColor(s) {
    const tint = computeTintFactor(s);

    // Если прозрачность нулевая — вообще не тонируем,
    // возвращаем чистый базовый цвет.
    if (tint <= 0.001) {
      return hslToHex(BASE_HSL.h, BASE_HSL.s, BASE_HSL.l);
    }

    // 1) Векторы hue
    let vx = 0, vy = 0, hueWeight = 0;
    for (const [cat, targetDeg] of Object.entries(HUE_TARGET)) {
      const w = s[cat] || 0;
      if (w <= 0) continue;
      const rad = targetDeg * Math.PI / 180;
      vx += Math.cos(rad) * w;
      vy += Math.sin(rad) * w;
      hueWeight += w;
    }

    let hue = BASE_HSL.h;

    if (hueWeight > 0.01) {
      const targetHue = (Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360;

      // нелинейный mix
      const k = 2.0 * (SENS.rgb / 140) * globalSens;
      let mix = mixCurve(hueWeight, k);

      // ПРИМЕНЯЕМ TINT: непрозрачность перекраски.
      // tint=1 → mix как есть, tint=0.5 → половинный сдвиг,
      // tint=2 → удвоенный (перекрут).
      mix = Math.min(1, mix * tint);

      let delta = targetHue - hue;
      if (delta > 180)  delta -= 360;
      if (delta < -180) delta += 360;

      hue = hue + delta * mix;
    }

    // 2) Насыщенность
    let sat = BASE_HSL.s;
    if (hueWeight > 0.01) {
      const k = 2.0 * (SENS.rgb / 140) * globalSens;
      let mix = mixCurve(hueWeight, k);
      mix = Math.min(1, mix * tint);
      sat = sat * (1 - 0.3 * mix);
    }

    // 3) Светлота. Ч/б — разностью, тоже с учётом tint.
    let light = BASE_HSL.l;

    const blackScore = s.to_black || 0;
    const whiteScore = s.to_white || 0;
    let bwNet = (whiteScore - blackScore) * SENS.bwshift * globalSens;
    bwNet = bwNet * tint;  // прозрачность влияет и на ч/б

    if (bwNet > 0) {
      const k = Math.min(1, bwNet);
      light = light + (100 - light) * k;
    } else if (bwNet < 0) {
      const k = Math.min(1, -bwNet);
      light = light * (1 - k);
    }

    return hslToHex(hue, sat, light);
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