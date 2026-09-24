/* ============================================================
 *  pumpkin-core.js
 *
 *  Чистая логика генерации параметров тыквы из текста.
 *  Без DOM, без UI. Используется:
 *    - generate.js       (страница с ползунками)
 *    - pumpkin-quest.html (страница заданий)
 *
 *  Экспортирует window.PumpkinCore.
 * ============================================================ */

(function (global) {
  'use strict';

  // ============================================================
  //  КОНСТАНТЫ
  // ============================================================

  const BASE_COLOR = { r: 0xf2, g: 0x8c, b: 0x1a };  // #f28c1a

  const BASE = {
    int: 1,
    shade: 0.55, lit: 0.35,
    tw: 1, mw: 1, bw: 1,
    lw: 1, rw: 1,
    ts: 0, ms: 0, bs: 0,
    sk: 0, rt: 0,
    fx: 0, fy: 0, fs: 1,
  };

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

  const HH_MIN = 100;
  const HH_MAX = 250;
  const RENDER_SIZE = 512;

  // ============================================================
  //  СОСТОЯНИЕ
  // ============================================================

  const SENS = { ...DEFAULTS };
  let globalSens = 1.0;

  function setSens(obj) {
    Object.assign(SENS, obj);
  }

  function getSens() {
    return { ...SENS };
  }

  function setGlobalSens(v) {
    globalSens = v;
  }

  function getGlobalSens() {
    return globalSens;
  }

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r3 = v => Math.round(v * 1000) / 1000;

  function tokenize(text) {
    const cleaned = String(text || '')
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned ? cleaned.split(' ') : [];
  }

  // ============================================================
  //  ДОСТУП К СЛОВАРЮ
  // ============================================================
  //
  //  words.js объявляет RULES через const. Такая переменная
  //  создаётся в глобальной области, но не становится свойством
  //  window. Из другого скрипта того же документа её видно
  //  через лексическую область — при условии, что words.js
  //  подключён раньше того скрипта, который её читает.
  //
  //  getRules() пробует все источники, чтобы не зависеть
  //  от порядка подключения.
  //
  let _cachedRules = null;

  function getRules() {
    if (_cachedRules) return _cachedRules;

    // 1) лексическая RULES (const-объявление в words.js)
    try {
      if (typeof RULES !== 'undefined' && RULES) {
        _cachedRules = RULES;
        return _cachedRules;
      }
    } catch (e) { /* ignore */ }

    // 2) window.RULES
    if (global.RULES) {
      _cachedRules = global.RULES;
      return _cachedRules;
    }

    // 3) пустой словарь, чтобы не падать
    _cachedRules = {};
    return _cachedRules;
  }

  function resetRulesCache() {
    _cachedRules = null;
  }

  // ============================================================
  //  АНАЛИЗ ТЕКСТА
  // ============================================================

  function analyze(words) {
    const raw = {};
    const hits = {};
    const rules = getRules();

    for (const word of words) {
      for (const [cat, rule] of Object.entries(rules)) {
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

    const K = SENS.K;
    const scores = {};
    for (const [cat, n] of Object.entries(raw)) {
      scores[cat] = n / (n + K);
    }

    return { wordCount: words.length, raw, scores, hits };
  }

  function analyzeText(text) {
    return analyze(tokenize(text));
  }

  // ============================================================
  //  ЭМОЦИИ: точка в треугольнике
  // ============================================================

  function computeEmotionTriangle(scores) {
    const sad   = scores.emo_sad   || 0;
    const joy   = scores.emo_joy   || 0;
    const angry = scores.emo_angry || 0;
    const total = sad + joy + angry;

    if (total < 0.001) {
      return {
        tone: 0,
        mood: 0,
        intensity: 0,
        proportions: { sad: 0, joy: 0, angry: 0 },
      };
    }

    const pSad   = sad   / total;
    const pJoy   = joy   / total;
    const pAngry = angry / total;

    const tone = pAngry - pSad;
    const mood = pJoy * 2 - 1;

    const intensity = Math.min(1.5, total * 1.0 * globalSens);

    return {
      tone, mood, intensity,
      proportions: { sad: pSad, joy: pJoy, angry: pAngry },
    };
  }

  // ============================================================
  //  ВЫСОТА ЭКСПОРТА
  // ============================================================

  function computeExportHeight(scores) {
    const plus  = scores.hh_plus  || 0;
    const minus = scores.hh_minus || 0;
    const delta = plus - minus;

    const mid = (HH_MIN + HH_MAX) / 2;
    const half = (HH_MAX - HH_MIN) / 2;
    const h = mid + delta * half * globalSens;
    return Math.round(clamp(h, HH_MIN, HH_MAX));
  }

  // ============================================================
  //  ЦВЕТ
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

  function computeTintFactor(s) {
    const plus  = s.tint_plus  || 0;
    const minus = s.tint_minus || 0;
    const delta = plus - minus;
    return Math.max(0, 1 + delta * SENS.tint * globalSens);
  }

  function computeColor(s) {
    const tint = computeTintFactor(s);
    if (tint <= 0.001) {
      return hslToHex(BASE_HSL.h, BASE_HSL.s, BASE_HSL.l);
    }

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
      const k = 2.0 * (SENS.rgb / 140) * globalSens;
      let mix = mixCurve(hueWeight, k);
      mix = Math.min(1, mix * tint);

      let delta = targetHue - hue;
      if (delta > 180)  delta -= 360;
      if (delta < -180) delta += 360;
      hue = hue + delta * mix;
    }

    let sat = BASE_HSL.s;
    if (hueWeight > 0.01) {
      const k = 2.0 * (SENS.rgb / 140) * globalSens;
      let mix = mixCurve(hueWeight, k);
      mix = Math.min(1, mix * tint);
      sat = sat * (1 - 0.3 * mix);
    }

    let light = BASE_HSL.l;
    const blackScore = s.to_black || 0;
    const whiteScore = s.to_white || 0;
    let bwNet = (whiteScore - blackScore) * SENS.bwshift * globalSens * tint;

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
  //  ПАРАМЕТРЫ
  // ============================================================

  function applyScale(baseValue, plusScore, minusScore, sens) {
    const delta = (plusScore || 0) - (minusScore || 0);
    return baseValue + delta * sens * globalSens;
  }

  function computeParams(a) {
    const s = a.scores;

    const emo = computeEmotionTriangle(s);

    let int = applyScale(BASE.int, s.int_plus, s.int_minus, SENS.int);
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
    const exportHeight = computeExportHeight(s);

    return {
      emo: undefined,
      _useTriangle: true,
      tone: r3(emo.tone),
      mood: r3(emo.mood),
      int: r3(int),

      shade: r3(shade),
      lit: r3(lit),
      tw: r3(tw), mw: r3(mw), bw: r3(bw),
      lw: r3(lw), rw: r3(rw),
      ts: Math.round(ts), ms: Math.round(ms), bs: Math.round(bs),
      sk: Math.round(sk), rt: Math.round(rt),
      fx: r3(fx), fy: r3(fy), fs: r3(fs),
      fill,
      exportHeight,
      _emotion: emo,
    };
  }

  // ============================================================
  //  ЭКСПОРТ
  // ============================================================

  global.PumpkinCore = {
    // константы
    BASE,
    BASE_COLOR,
    BASE_HSL,
    DEFAULTS,
    HUE_TARGET,
    HH_MIN,
    HH_MAX,
    RENDER_SIZE,

    // настройки
    setSens,
    getSens,
    setGlobalSens,
    getGlobalSens,

    // утилиты
    clamp,
    r3,
    tokenize,
    getRules,
    resetRulesCache,

    // логика
    analyze,
    analyzeText,
    computeEmotionTriangle,
    computeExportHeight,
    computeColor,
    computeParams,

    // внутренние, но может понадобиться
    hexToHsl,
    hslToHex,
  };

})(window);