/* ============================================================
 *  Генерация параметров тыквы из текста.
 *
 *  Идея: у нас есть словарь триггеров. Каждый триггер — это
 *  одно или несколько слов, которые «тянут» один параметр
 *  тыквы в определённую сторону. По тексту считаем попадания
 *  и превращаем их в значения параметров.
 *
 *  Все параметры тыквы — из класса Pumpkin (см. pumpkin.js).
 *  Если какого-то поля там нет, мы его просто не трогаем.
 * ============================================================ */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  // ---------- экземпляр класса ----------
  const pumpkin = new Pumpkin($('cv'));

  // ============================================================
  //  СЛОВАРЬ ВЛИЯНИЙ
  // ============================================================
  //
  //  Каждая запись — это правило:
  //    words   — массив подстрок (буквально, регистр не важен)
  //    weight  — сила влияния: сколько «очков» добавляет одно
  //              вхождение к счётчику своей категории
  //
  //  Категории:
  //    emo_sad, emo_joy, emo_angry   → три опорные эмоции
  //    int_up, int_down              → интенсивность
  //    shade_up, shade_down          → сила теней
  //    lit_up, lit_down              → сила блика
  //    size_big, size_small          → общий масштаб (fs)
  //    wide, narrow                  → пузо (mw)
  //    tall, low                     → высота (hh)
  //    warm, cold                    → цвет заливки (сдвиг оттенка)
  //    asym_left, asym_right         → асимметрия lw/rw
  //    up, down                      → сдвиг вверх/вниз (ts/bs)
  //    round, angular                → форма (eyes round vs angular)
  //
  //  words — массив ПОДСТРОК. «грусть» найдётся и в «грустный»,
  //  и в «грустно», и в «грусть». Это упрощает словарь.
  // ============================================================

  const RULES = {
    // ---- эмоции ----
    emo_sad: {
      weight: 1,
      words: ['груст', 'печаль', 'тоск', 'уныл', 'слез', 'плак', 'одинок', 'хмур'],
    },
    emo_joy: {
      weight: 1,
      words: ['весел', 'бодр', 'улыб', 'радост', 'счаст', 'смеш', 'улыбн', 'празд'],
    },
    emo_angry: {
      weight: 1,
      words: ['зло', 'ярост', 'грозн', 'крик', 'бешен', 'раздраж', 'ненавист', 'рыч'],
    },

    // ---- интенсивность ----
    int_up:   { weight: 1, words: ['бурн', 'эмоциональн', 'нервн', 'страст', 'ярк', 'сильн', 'интенсив'] },
    int_down: { weight: 1, words: ['тих', 'спокойн', 'расслаблен', 'мягк', 'нежн', 'ленив', 'умиротвор'] },

    // ---- тени ----
    shade_up:   { weight: 1, words: ['мрачн', 'тёмн', 'темн', 'тень', 'густ', 'глубок'] },
    shade_down: { weight: 1, words: ['светл', 'ярк', 'сия', 'блеск', 'солнечн', 'воздушн'] },

    // ---- блик ----
    lit_up:   { weight: 1, words: ['блест', 'глянц', 'сия', 'сверк', 'искр', 'лосн'] },
    lit_down: { weight: 1, words: ['матов', 'тускл', 'блёкл', 'блекл', 'пыльн'] },

    // ---- размер ----
    size_big:   { weight: 1, words: ['больш', 'огромн', 'гигант', 'широк', 'разду', 'толст'] },
    size_small: { weight: 1, words: ['мал', 'крох', 'мелк', 'узк', 'тонк', 'сжат'] },

    // ---- пузо ----
    wide:   { weight: 1, words: ['широк', 'толст', 'пухл', 'кругл', 'наду', 'раскорм'] },
    narrow: { weight: 1, words: ['узк', 'тонк', 'худ', 'стройн', 'подтянут'] },

    // ---- высота ----
    tall: { weight: 1, words: ['высок', 'длинн', 'вытянут', 'стройн', 'долговяз'] },
    low:  { weight: 1, words: ['низк', 'коротк', 'призем', 'коренаст', 'низеньк'] },

    // ---- асимметрия ----
    asym_left:  { weight: 1, words: ['лев', 'влево', 'наклон влево', 'скособоч'] },
    asym_right: { weight: 1, words: ['прав', 'вправо', 'наклон вправо'] },

    // ---- сдвиг ----
    up:   { weight: 1, words: ['вверх', 'вверх', 'взлет', 'взлёт', 'подн', 'ввысь'] },
    down: { weight: 1, words: ['вниз', 'пад', 'провис', 'осел', 'осёл', 'просел'] },
  };

  // ============================================================
  //  НАСТРОЙКИ ИНТЕРПРЕТАЦИИ
  // ============================================================

  // доля слов, при которой категория считается «насыщенной»
  // (после saturation score обрезается до 1)
  const SATURATION = 0.08;

  // насколько сильно каждое «насыщение» сдвигает параметр
  // (множитель для нормализованного score 0..1)
  const INFLUENCE = {
    emo: 1.0,
    int: 1.0,
    shade: 1.0,
    lit: 1.0,
    size: 0.6,
    mw: 1.2,
    hh: 1.2,
    asym: 0.6,
    shift: 0.5,
  };

  // базовый цвет и его «тепло/холод»
  const BASE_HUE = 30;       // оранжевый оттенок заливки
  const HUE_RANGE = 25;      // насколько градусов сдвигаем максимум

  // ============================================================
  //  ТОКЕНИЗАЦИЯ
  // ============================================================
  function tokenize(text) {
    // Оставляем только буквы (включая русские), цифры и пробелы.
    // Остальное превращаем в пробелы. Потом режем по пробелам.
    const cleaned = text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];
    return cleaned.split(' ');
  }

  // ============================================================
  //  ПОДСЧЁТ ПОПАДАНИЙ
  // ============================================================
  function analyze(words) {
    // scores[category] = число (может быть > 1 из-за weight, но у нас weight=1)
    const scores = {};
    // hits[category] = [сами слова, которые сработали]
    const hits = {};

    for (const word of words) {
      for (const [cat, rule] of Object.entries(RULES)) {
        for (const trigger of rule.words) {
          if (word.includes(trigger)) {
            scores[cat] = (scores[cat] || 0) + rule.weight;
            if (!hits[cat]) hits[cat] = [];
            if (!hits[cat].includes(word)) hits[cat].push(word);
            break; // одно слово — один раз на категорию
          }
        }
      }
    }

    // нормализуем: hits / wordCount, потом обрезаем по SATURATION
    const wordCount = Math.max(1, words.length);
    const normalized = {};
    for (const [cat, raw] of Object.entries(scores)) {
      normalized[cat] = Math.min(1, (raw / wordCount) / SATURATION);
    }

    return { wordCount, raw: scores, scores: normalized, hits };
  }

  // ============================================================
  //  ПАРАМЕТРЫ ИЗ АНАЛИЗА
  // ============================================================
  function computeParams(a) {
    const s = a.scores;

    // --- эмоции ---
    // три эмоции: sad, joy, angry. Берём суммарное влияние и
    // решаем, куда сдвинуть emo-слайдер (0..1):
    //   0 = грусть, 0.5 = радость, 1 = гнев
    //
    // Если одна эмоция доминирует — сдвигаем к ней. Если ничего
    // не сработало — emo = 0.5.
    const sad   = s.emo_sad   || 0;
    const joy   = s.emo_joy   || 0;
    const angry = s.emo_angry || 0;
    const emoTotal = sad + joy + angry;

    let emo = 0.5; // радость по умолчанию
    if (emoTotal > 0.01) {
      // позиция на шкале: sad → 0, joy → 0.5, angry → 1
      emo = (sad * 0 + joy * 0.5 + angry * 1) / emoTotal;
    }

    // интенсивность эмоции: сколько всего эмоциональных попаданий
    // относительно длины. Если эмоций много — выражение ярче.
    let int = 0.5 + emoTotal * 0.7;
    int = clamp(int, 0, 1.5);

    // --- тени / блик ---
    let shade = 0.55;
    if (s.shade_up)   shade += s.shade_up   * INFLUENCE.shade * 0.4;
    if (s.shade_down) shade -= s.shade_down * INFLUENCE.shade * 0.4;
    shade = clamp(shade, 0, 1);

    let lit = 0.35;
    if (s.lit_up)   lit += s.lit_up   * INFLUENCE.lit * 0.5;
    if (s.lit_down) lit -= s.lit_down * INFLUENCE.lit * 0.4;
    lit = clamp(lit, 0, 1);

    // --- размер (fs), пузо (mw), высота (hh) ---
    let fs = 1;
    if (s.size_big)   fs += s.size_big   * INFLUENCE.size;
    if (s.size_small) fs -= s.size_small * INFLUENCE.size;
    fs = clamp(fs, 0.5, 1.6);

    let mw = 1;
    if (s.wide)   mw += s.wide   * INFLUENCE.mw * 0.5;
    if (s.narrow) mw -= s.narrow * INFLUENCE.mw * 0.5;
    mw = clamp(mw, 0.4, 2.5);

    let hh = 1;
    if (s.tall) hh += s.tall * INFLUENCE.hh * 0.4;
    if (s.low)  hh -= s.low  * INFLUENCE.hh * 0.4;
    hh = clamp(hh, 0.5, 2);

    // --- асимметрия ---
    // сдвигаем lw/rw в стороны от 1
    let lw = 1, rw = 1;
    if (s.asym_left) {
      lw -= s.asym_left  * INFLUENCE.asym * 0.4;
      rw += s.asym_left  * INFLUENCE.asym * 0.2;
    }
    if (s.asym_right) {
      rw -= s.asym_right * INFLUENCE.asym * 0.4;
      lw += s.asym_right * INFLUENCE.asym * 0.2;
    }
    lw = clamp(lw, 0.5, 1.6);
    rw = clamp(rw, 0.5, 1.6);

    // --- вертикальные сдвиги ---
    let ts = 0, bs = 0;
    if (s.up)   { ts -= s.up   * INFLUENCE.shift * 30; }
    if (s.down) { bs += s.down * INFLUENCE.shift * 30; }
    ts = clamp(ts, -60, 60);
    bs = clamp(bs, -60, 60);

    // --- цвет заливки ---
    // базовый оранжевый. "Тёплое"/светлое тянет к жёлтому,
    // "холодное"/мрачное — к красному.
    let hue = BASE_HUE;
    if (s.lit_up)   hue += s.lit_up   * HUE_RANGE * 0.4;
    if (s.shade_up) hue -= s.shade_up * HUE_RANGE * 0.4;
    hue = clamp(hue, 0, 60);

    const fill = hslToHex(hue, 90, 55);

    return {
      emo: round3(emo),
      int: round3(int),
      shade: round3(shade),
      lit: round3(lit),
      tw: 1,
      mw: round3(mw),
      bw: 1,
      lw: round3(lw),
      rw: round3(rw),
      hh: round3(hh),
      ts: Math.round(ts),
      ms: 0,
      bs: Math.round(bs),
      sk: 0,
      rt: 0,
      fx: 0,
      fy: 0,
      fs: round3(fs),
      fill,
    };
  }

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round3 = v => Math.round(v * 1000) / 1000;

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }

  // ============================================================
  //  UI
  // ============================================================
  function renderBreakdown(a, params) {
    const box = $('breakdown');
    box.innerHTML = '';

    if (a.wordCount === 0 || Object.keys(a.raw).length === 0) {
      box.innerHTML = '<span class="muted">Ничего не сработало — параметры по умолчанию.</span>';
      return;
    }

    // группируем категории в удобные блоки
    const GROUPS = [
      { title: 'Эмоции', cats: ['emo_sad', 'emo_joy', 'emo_angry'] },
      { title: 'Интенсивность', cats: ['int_up', 'int_down'] },
      { title: 'Тени', cats: ['shade_up', 'shade_down'] },
      { title: 'Блик', cats: ['lit_up', 'lit_down'] },
      { title: 'Размер', cats: ['size_big', 'size_small'] },
      { title: 'Пузо', cats: ['wide', 'narrow'] },
      { title: 'Высота', cats: ['tall', 'low'] },
      { title: 'Асимметрия', cats: ['asym_left', 'asym_right'] },
      { title: 'Сдвиг', cats: ['up', 'down'] },
    ];

    for (const g of GROUPS) {
      const active = g.cats.filter(c => a.raw[c]);
      if (active.length === 0) continue;
      const catEl = document.createElement('div');
      catEl.className = 'cat';
      catEl.textContent = g.title;
      box.appendChild(catEl);

      for (const c of active) {
        const line = document.createElement('div');
        line.className = 'line';
        const words = a.hits[c] || [];
        line.innerHTML =
          `<span class="muted">${c}</span> ` +
          `<span class="score">${a.raw[c]}</span> · ` +
          words.map(w => `<span class="hit">${w}</span>`).join(', ');
        box.appendChild(line);
      }
    }
  }

  function renderParams(p) {
    const box = $('params');
    const fields = ['emo', 'int', 'shade', 'lit', 'mw', 'lw', 'rw', 'hh', 'fs', 'ts', 'bs'];
    box.innerHTML = fields
      .map(f => `<div>${f} <span>${typeof p[f] === 'number' ? p[f] : p[f]}</span></div>`)
      .join('');
  }

  function generate() {
    const text = $('input').value;
    const words = tokenize(text);
    const a = analyze(words);
    const params = computeParams(a);

    // применяем к тыкве
    pumpkin.setParams(params);
    pumpkin.render();

    // UI
    renderBreakdown(a, params);
    renderParams(params);

    $('stats').innerHTML =
      `Слов: <b>${a.wordCount}</b> · ` +
      `сработало категорий: <b>${Object.keys(a.raw).length}</b> · ` +
      `всего попаданий: <b>${Object.values(a.raw).reduce((s, x) => s + x, 0)}</b>`;
  }

  // ---------- обработчики ----------
  $('gen').addEventListener('click', generate);

  $('demo').addEventListener('click', () => {
    $('input').value =
      'Мне так грустно и тоскливо на душе. Всё кажется унылым и печальным. ' +
      'Я одинок, и хочется плакать тихо, спокойно, без слёз.';
    generate();
  });

  // горячая клавиша: Ctrl+Enter — сгенерировать
  $('input').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });

  // подгонка canvas под контейнер + первичная отрисовка
  function resize() {
    pumpkin.resizeToContainer($('stage'));
  }
  window.addEventListener('resize', resize);
  resize();

  // стартовый рендер — тыква по умолчанию
  pumpkin.render();
})();