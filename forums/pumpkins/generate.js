/* ============================================================
 *  Генерация параметров тыквы из текста.
 *
 *  Зависимости:
 *    - pumpkin.js : класс Pumpkin
 *    - words.js   : объект RULES со словарём слов
 *
 *  Принципы:
 *    1) Один параметр тыквы = одна шкала из двух категорий
 *       <param>_plus / <param>_minus. Они считаются независимо
 *       и вычитаются друг из друга.
 *    2) Эмоции — три шкалы, из которых считается ПРОПОРЦИЯ.
 *       Слайдер emo ставится на взвешенную позицию между
 *       грустью (0), радостью (0.5) и злостью (1).
 *    3) Цвет — три канала RGB + шкала чёрное/белое. Все сдвиги
 *       применяются ОТ ТЕКУЩЕГО базового цвета.
 *    4) Нормировка счётчиков — гиперболическая сатурация
 *       score = n / (n + K). Она даёт заметный отклик уже при
 *       1–3 попаданиях и не зависит от длины текста.
 *    5) Глобальный множитель интенсивности (ползунок в UI)
 *       масштабирует SENS и RGB/BW сдвиги на лету.
 * ============================================================ */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const pumpkin = new Pumpkin($('cv'));

  // ============================================================
  //  НАСТРОЙКИ
  // ============================================================

  // Гиперболическая сатурация: score = n / (n + K).
  // Чем меньше K, тем быстрее набирается «насыщение».
  //   K = 2.5 → 1 попадание: 0.29, 3: 0.55, 5: 0.67, 10: 0.80
  const K = 2.5;

  // Базовый цвет заливки, от которого работают сдвиги RGB
  const BASE_COLOR = { r: 0xf2, g: 0x8c, b: 0x1a };  // #f28c1a

  // Базовые значения параметров (совпадают с Pumpkin.DEFAULTS)
  const BASE = {
    emo: 0.5, int: 1,
    shade: 0.55, lit: 0.35,
    tw: 1, mw: 1, bw: 1,
    lw: 1, rw: 1, hh: 1,
    ts: 0, ms: 0, bs: 0,
    sk: 0, rt: 0,
    fx: 0, fy: 0, fs: 1,
  };

  // Чувствительность: насколько score (0..1) сдвигает параметр.
  // Это базовые значения, поверх которых умножается globalSens.
  const SENS = {
    int:   1.2,
    shade: 1.0,
    lit:   1.0,
    tw:    1.5,
    mw:    2.0,
    bw:    1.5,
    lw:    1.2,
    rw:    1.2,
    hh:    1.5,
    ts:    60,
    ms:    60,
    bs:    60,
    sk:    30,
    rt:    120,
    fx:    0.5,
    fy:    0.5,
    fs:    0.8,
  };

  const RGB_SHIFT_BASE = 140;   // из 255
  const BW_SHIFT_BASE  = 1.0;

  // Глобальный множитель, читается с ползунка в UI
  let globalSens = 1.0;

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

    const scores = {};
    for (const [cat, n] of Object.entries(raw)) {
      scores[cat] = n / (n + K);
    }

    return { wordCount: words.length, raw, scores, hits };
  }

  // ============================================================
  //  ЭМОЦИИ: пропорция
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

    // Бонус к интенсивности — тоже масштабируем глобальным множителем.
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
  function computeColor(s) {
    let { r, g, b } = BASE_COLOR;

    const RGB_SHIFT = RGB_SHIFT_BASE * globalSens;
    const BW_SHIFT  = Math.min(1, BW_SHIFT_BASE * globalSens);

    const rDelta = (s.r_plus || 0) - (s.r_minus || 0);
    const gDelta = (s.g_plus || 0) - (s.g_minus || 0);
    const bDelta = (s.b_plus || 0) - (s.b_minus || 0);

    r += rDelta * RGB_SHIFT;
    g += gDelta * RGB_SHIFT;
    b += bDelta * RGB_SHIFT;

    const blackK = (s.to_black || 0) * BW_SHIFT;
    const whiteK = (s.to_white || 0) * BW_SHIFT;

    r = r * (1 - blackK) + 255 * whiteK;
    g = g * (1 - blackK) + 255 * whiteK;
    b = b * (1 - blackK) + 255 * whiteK;

    r = Math.round(clamp(r, 0, 255));
    g = Math.round(clamp(g, 0, 255));
    b = Math.round(clamp(b, 0, 255));

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
  // Последний проанализированный текст храним, чтобы ползунок
  // интенсивности мог пересчитать тыкву мгновенно, без нового
  // нажатия «Сгенерировать».
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

  function generate() {
    const text = $('input').value;
    const words = tokenize(text);
    const a = analyze(words);
    lastAnalysis = a;
    applyFromAnalysis(a);
  }

  // ============================================================
  //  ОБРАБОТЧИКИ
  // ============================================================
  $('gen').addEventListener('click', generate);

  $('demo').addEventListener('click', () => {
    $('input').value =
      'Мне так грустно и тоскливо на душе. Всё кажется унылым и печальным. ' +
      'Я одинок, и хочется плакать тихо, спокойно, без слёз.';
    generate();
  });

  $('input').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });

  // ---- ползунок интенсивности ----
  const sensInput = $('sens');
  const sensLabel = $('v-sens');

  function readSens() {
    globalSens = parseFloat(sensInput.value) || 0;
    sensLabel.textContent = globalSens.toFixed(2) + '×';
  }

  sensInput.addEventListener('input', () => {
    readSens();
    // Пересчитываем тыкву на лету, если уже есть анализ
    if (lastAnalysis) applyFromAnalysis(lastAnalysis);
  });

  // клики по «шкале» под ползунком
  document.querySelectorAll('.slider-scale span').forEach(el => {
    el.addEventListener('click', () => {
      sensInput.value = el.dataset.sens;
      readSens();
      if (lastAnalysis) applyFromAnalysis(lastAnalysis);
    });
  });

  // ---- resize ----
  function resize() {
    pumpkin.resizeToContainer($('stage'));
  }
  window.addEventListener('resize', resize);

  // стартовая инициализация
  readSens();
  resize();
  pumpkin.render();
})();