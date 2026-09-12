/* ============================================================
 *  UI-логика редактора: связывает ползунки с экземпляром Pumpkin.
 *  Работает через ТРЕУГОЛЬНИК эмоций (tone, mood, int).
 * ============================================================ */

(function () {
  const $ = id => document.getElementById(id);

  const IMGBB_API_KEY = '1e12d568c88876be45ce5c87b6753b67';

  const pumpkin = new Pumpkin($('cv'));

  // Поля-диапазоны, которые читаем с ползунков
  const RANGE_FIELDS = [
    'tone','mood','int','shade','lit',
    'tw','mw','bw','lw','rw',
    'ts','ms','bs','sk','rt',
    'fx','fy','fs',
  ];

  // Карта: имя поля → id подписи
  const LABEL_MAP = {
    tone: 'v-tone', mood: 'v-mood', int: 'v-int',
    shade: 'v-shade', lit: 'v-lit',
    tw: 'v-tw', mw: 'v-mw', bw: 'v-bw',
    lw: 'v-lw', rw: 'v-rw',
    ts: 'v-ts', ms: 'v-ms', bs: 'v-bs',
    sk: 'v-sk', rt: 'v-rt',
    fx: 'v-fx', fy: 'v-fy', fs: 'v-fs',
  };

  // Какие поля — с двумя знаками после запятой
  const FLOAT_FIELDS = new Set([
    'tone','mood','int','shade','lit',
    'tw','mw','bw','lw','rw',
    'fx','fy','fs',
  ]);

  function readUI() {
    const obj = {};
    for (const f of RANGE_FIELDS) obj[f] = +$(f).value;
    obj.fill = $('fill').value;
    // ВАЖНО: ставим флаг, чтобы Pumpkin использовал треугольник,
    // а не старый emo-путь.
    obj._useTriangle = true;
    return obj;
  }

  function updateLabels(params) {
    for (const [field, spanId] of Object.entries(LABEL_MAP)) {
      const v = params[field];
      $(spanId).textContent = FLOAT_FIELDS.has(field)
        ? v.toFixed(2)
        : String(v);
    }
  }

  function loop() {
    const params = readUI();
    updateLabels(params);
    pumpkin.setParams(params).render();
  }

  function resize() {
    pumpkin.resizeToContainer($('stage'));
  }

  // ---- экспорт ----
  function openExport() {
    const result = pumpkin.exportDataURL({ format: 'webp', quality: 1.0, max: 200 });
    const { dataURL, width, height, format } = result;

    $('exportPreview').src = dataURL;
    $('exportPreview').width = width;
    $('exportPreview').height = height;
    $('exportBase64').value = dataURL;

    const kb = (dataURL.length / 1024).toFixed(1);
    $('exportMeta').textContent =
      `Размер: ${width}×${height} px · ${format.toUpperCase()} с прозрачностью · base64 ≈ ${kb} КБ`;

    $('imgbbResult').classList.remove('on');
    $('imgbbStatus').textContent = '';
    $('imgbbStatus').className = '';

    $('exportBox').classList.add('on');
  }

  async function uploadToImgbb() {
    const btn = $('uploadBtn');
    const status = $('imgbbStatus');
    const result = $('imgbbResult');

    btn.disabled = true;
    btn.textContent = '⏳ Загрузка...';
    status.className = '';
    status.textContent = 'Загружаем на imgbb.com...';
    result.classList.remove('on');

    try {
      const res = await pumpkin.uploadToImgbb(IMGBB_API_KEY, {
        format: 'webp',
        quality: 1.0,
        max: 200,
      });

      $('imgbbDirect').value = res.direct;
      $('imgbbPage').value   = res.page;
      $('imgbbDelete').value = res.deleteUrl;

      status.className = 'ok';
      status.textContent = '✓ Загружено!';
      result.classList.add('on');
    } catch (err) {
      status.className = 'err';
      status.textContent = '✗ Ошибка: ' + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '☁ Загрузить на imgbb';
    }
  }

  // ---- обработчики ----
  document.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', loop);
  });

  // быстрые пресеты эмоций под ползунками tone/mood
  document.querySelectorAll('.emotion-scale span').forEach(el => {
    el.addEventListener('click', () => {
      $('tone').value = el.dataset.tone;
      $('mood').value = el.dataset.mood;
      loop();
    });
  });

  $('reset').addEventListener('click', () => {
    const d = Pumpkin.DEFAULTS;
    for (const f of RANGE_FIELDS) {
      if (f in d) $(f).value = d[f];
    }
    $('fill').value = d.fill;
    loop();
  });

  $('export').addEventListener('click', openExport);
  $('closeExport').addEventListener('click', () => {
    $('exportBox').classList.remove('on');
  });
  $('exportBox').addEventListener('click', (e) => {
    if (e.target === $('exportBox')) $('exportBox').classList.remove('on');
  });

  $('copyBtn').addEventListener('click', async () => {
    const ta = $('exportBase64');
    ta.select();
    try {
      await navigator.clipboard.writeText(ta.value);
      $('copyBtn').textContent = '✓ Скопировано!';
      setTimeout(() => $('copyBtn').textContent = '📋 Скопировать base64', 1500);
    } catch (e) {
      document.execCommand('copy');
    }
  });

  $('copyImgBtn').addEventListener('click', async () => {
    try {
      const img = $('exportPreview');
      const res = await fetch(img.src);
      const blob = await res.blob();
      const mime = blob.type || 'image/webp';
      await navigator.clipboard.write([
        new ClipboardItem({ [mime]: blob })
      ]);
      $('copyImgBtn').textContent = '✓ Картинка в буфере!';
      setTimeout(() => $('copyImgBtn').textContent = '🖼 Скопировать как картинку', 1500);
    } catch (e) {
      alert('Не удалось скопировать картинку: ' + e.message);
    }
  });

  $('uploadBtn').addEventListener('click', uploadToImgbb);

  document.querySelectorAll('#imgbbResult [data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = $(btn.dataset.copy);
      if (!input || !input.value) return;
      try {
        await navigator.clipboard.writeText(input.value);
        const old = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = old, 1200);
      } catch (e) {
        input.select();
        document.execCommand('copy');
      }
    });
  });

  window.addEventListener('resize', resize);

  // Первый запуск
  resize();
  loop();
})();