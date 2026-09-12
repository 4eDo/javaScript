/* ============================================================
 *  UI-логика: связывает ползунки с экземпляром класса Pumpkin.
 * ============================================================ */

(function () {
  const $ = id => document.getElementById(id);

  const IMGBB_API_KEY = '1e12d568c88876be45ce5c87b6753b67';

  // ---- создаём экземпляр ----
  const pumpkin = new Pumpkin($('cv'));

  // ---- поля, которые читаем с ползунков ----
  const RANGE_FIELDS = [
    'emo','int','shade','lit',
    'tw','mw','bw','lw','rw','hh',
    'ts','ms','bs','sk','rt',
    'fx','fy','fs',
  ];

  // карта подпись → id
  const LABEL_MAP = {
    emo: 'v-emo', int: 'v-int', shade: 'v-shade', lit: 'v-lit',
    tw: 'v-tw', mw: 'v-mw', bw: 'v-bw', lw: 'v-lw', rw: 'v-rw', hh: 'v-hh',
    ts: 'v-ts', ms: 'v-ms', bs: 'v-bs', sk: 'v-sk', rt: 'v-rt',
    fx: 'v-fx', fy: 'v-fy', fs: 'v-fs',
  };

  // какие поля показывать с 2 знаками после запятой
  const FLOAT_FIELDS = new Set([
    'emo','int','shade','lit',
    'tw','mw','bw','lw','rw','hh',
    'fx','fy','fs',
  ]);

  function readUI() {
    const obj = {};
    for (const f of RANGE_FIELDS) obj[f] = +$(f).value;
    obj.fill = $('fill').value;
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

  // ---- инициализация ----
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

    /**
   * Экспортировать картинку заданной ВЫСОТЫ.
   *
   * Отличие от exportDataURL:
   *   - рендерим сначала в большой offscreen-canvas 512×N,
   *     где N — пропорционально bbox тыквы,
   *   - потом уменьшаем этот большой canvas в маленький
   *     (finalW × outH) через drawImage с high-quality сглаживанием.
   *
   * Это даёт чистые края при уменьшении (box-фильтр браузера).
   * Толщина линий сжимается пропорционально — это вариант Б
   * из обсуждения: чёткость, но не сохранение абсолютной толщины.
   *
   * @param {number} outH    желаемая высота результата в пикселях
   * @param {object} opts
   *   format:  'webp' | 'png'  (по умолчанию 'webp')
   *   quality: 0..1            (по умолчанию 1.0)
   *   renderSize: размер эталонного рендера по большей стороне
   *               (по умолчанию 512)
   * @returns {{dataURL, width, height, format}}
   */
  exportWithHeight(outH, opts = {}) {
    const format     = opts.format     || 'webp';
    const quality    = opts.quality    ?? 1.0;
    const renderSize = opts.renderSize ?? 512;

    const p = this.params;

    // 1) bbox в внутренних единицах
    const pts = this._collectPoints(p);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const bboxW = (maxX - minX) || 1;
    const bboxH = (maxY - minY) || 1;
    const aspect = bboxW / bboxH;   // ширина / высота

    // 2) финальные размеры
    const finalH = Math.max(1, Math.round(outH));
    const finalW = Math.max(1, Math.round(outH * aspect));

    // 3) большой рендер: большая сторона = renderSize
    let bigW, bigH;
    if (bboxW >= bboxH) {
      bigW = renderSize;
      bigH = Math.round(renderSize / aspect);
    } else {
      bigH = renderSize;
      bigW = Math.round(renderSize * aspect);
    }
    bigW = Math.max(1, bigW);
    bigH = Math.max(1, bigH);

    const big = document.createElement('canvas');
    big.width = bigW;
    big.height = bigH;
    const bigCtx = big.getContext('2d');

    // рисуем как при обычном экспорте — без padding, но с запасом
    // на толщину обводки, чтобы она не срезалась
    const bigPad = Math.ceil(Pumpkin.BASE_LWD / 2) + 2;
    this._renderToFit(bigCtx, bigW, bigH, p, bigPad);

    // 4) маленький canvas — финальный результат
    const small = document.createElement('canvas');
    small.width = finalW;
    small.height = finalH;
    const smallCtx = small.getContext('2d');

    // высококачественное уменьшение
    smallCtx.imageSmoothingEnabled = true;
    smallCtx.imageSmoothingQuality = 'high';
    smallCtx.clearRect(0, 0, finalW, finalH);
    smallCtx.drawImage(big, 0, 0, bigW, bigH, 0, 0, finalW, finalH);

    const mime = format === 'png' ? 'image/png' : 'image/webp';
    const dataURL = small.toDataURL(mime, quality);

    const actual = dataURL.startsWith('data:image/webp') ? 'webp'
                 : dataURL.startsWith('data:image/png')  ? 'png'
                 : 'unknown';

    return {
      dataURL,
      width: finalW,
      height: finalH,
      format: actual,
      bytes: Math.round(dataURL.length * 0.75),
    };
  }

  /**
   * Вспомогательный метод: рендер с явным padding.
   * Используется exportWithHeight, чтобы контролировать
   * отступ от обводки независимо от режима «экспорт/показ».
   */
  _renderToFit(targetCtx, targetW, targetH, p, pad) {
    targetCtx.clearRect(0, 0, targetW, targetH);

    const pts = this._collectPoints(p);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const fitScale = Math.min((targetW - pad * 2) / w, (targetH - pad * 2) / h);

    targetCtx.save();
    targetCtx.setTransform(1, 0, 0, 1, targetW / 2, targetH / 2);
    targetCtx.scale(fitScale, fitScale);
    targetCtx.translate(-cx, -cy);

    const lw = Pumpkin.BASE_LWD / fitScale;

    // ---- заливка ----
    targetCtx.beginPath();
    this.OUTLINE.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.fillStyle = p.fill;
    targetCtx.fill();

    // ---- тени и блик ----
    targetCtx.save();
    targetCtx.beginPath();
    this.OUTLINE.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.clip();

    targetCtx.beginPath();
    this.SHADE_RIGHT.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.fillStyle = this._darken(p.fill, p.shade);
    targetCtx.fill();

    targetCtx.beginPath();
    this.SHADE_BOTTOM.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.fillStyle = this._darken(p.fill, p.shade * 0.75);
    targetCtx.fill();

    targetCtx.fillStyle = this._darken(p.fill, p.shade * 0.85);
    for (const ribbon of this.RIB_SHADOWS) {
      targetCtx.beginPath();
      ribbon.forEach(([x, y], i) => {
        const [nx, ny] = this._deform(x, y, p);
        i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
      });
      targetCtx.closePath();
      targetCtx.fill();
    }

    targetCtx.beginPath();
    this.HIGHLIGHT.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.fillStyle = this._lighten(p.fill, p.lit);
    targetCtx.fill();

    targetCtx.restore();

    // ---- контур ----
    targetCtx.lineJoin = 'round';
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    this.OUTLINE.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.strokeStyle = Pumpkin.STROKE_COLOR;
    targetCtx.lineWidth = lw;
    targetCtx.stroke();

    // ---- рёбра ----
    targetCtx.save();
    targetCtx.beginPath();
    this.OUTLINE.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.clip();
    targetCtx.beginPath();
    for (const rib of this.RIBS) {
      rib.forEach(([x, y], i) => {
        const [nx, ny] = this._deform(x, y, p);
        i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
      });
    }
    targetCtx.strokeStyle = Pumpkin.STROKE_COLOR;
    targetCtx.lineWidth = lw * 0.85;
    targetCtx.stroke();
    targetCtx.restore();

    // ---- черенок ----
    targetCtx.beginPath();
    this.STEM.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.fillStyle = '#5a4433';
    targetCtx.fill();
    targetCtx.strokeStyle = Pumpkin.STROKE_COLOR;
    targetCtx.lineWidth = lw;
    targetCtx.stroke();

    targetCtx.beginPath();
    this.STEM_BAR.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.strokeStyle = Pumpkin.STROKE_COLOR;
    targetCtx.lineWidth = lw;
    targetCtx.lineCap = 'round';
    targetCtx.stroke();

    // ---- лицо ----
    targetCtx.save();
    targetCtx.beginPath();
    this.OUTLINE.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.clip();

    const emo = this._getEmotionParams(p.emo);
    const e = this._applyIntensity(emo, p.int);

    targetCtx.lineJoin = 'round';
    targetCtx.lineCap = 'round';

    const eyeSize = 0.22 * e.eyeSize;
    const eyeY = -0.15;
    const eyeDX = 0.35;
    const faceColor = Pumpkin.FACE_COLOR;
    const haloColor = p.fill;
    const haloWidth = lw * Pumpkin.HALO_SCALE;

    const self = this;
    function traceEye(side) {
      const eye = self._buildEye(e.eyeShape, e.eyeTilt * side, eyeSize, e.eyeScaleY);
      targetCtx.beginPath();
      eye.forEach(([x, y], i) => {
        const [nx, ny] = self._facePointToBody(x + side * eyeDX, y + eyeY, p);
        i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
      });
      targetCtx.closePath();
    }
    function traceBrow(side) {
      const brow = self._buildBrow(e.browAngle * side, 0.42);
      targetCtx.beginPath();
      brow.forEach(([x, y], i) => {
        const [nx, ny] = self._facePointToBody(x + side * eyeDX, y + eyeY - 0.24 + e.browY, p);
        i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
      });
    }
    function tracePupil(side) {
      const pupilR = eyeSize * e.pupilSize;
      const pup = self._buildEye(1, 0, pupilR);
      targetCtx.beginPath();
      pup.forEach(([x, y], i) => {
        const [nx, ny] = self._facePointToBody(x + side * eyeDX, y + eyeY + e.pupilOffset * eyeSize, p);
        i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
      });
      targetCtx.closePath();
    }
    function traceMouth() {
      const mouth = self._buildMouth(e.mouthCurve, e.mouthOpen * 0.5, e.mouthWidth * 0.8);
      targetCtx.beginPath();
      mouth.forEach(([x, y], i) => {
        const [nx, ny] = self._facePointToBody(x, y + 0.35, p);
        i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
      });
      targetCtx.closePath();
    }

    // подложка
    targetCtx.strokeStyle = haloColor;
    targetCtx.fillStyle = haloColor;
    targetCtx.lineWidth = haloWidth;
    for (const side of [-1, 1]) {
      traceEye(side);
      targetCtx.fill();
      targetCtx.stroke();
      traceBrow(side);
      targetCtx.stroke();
    }
    traceMouth();
    if (e.mouthOpen > 0.15) { targetCtx.fill(); targetCtx.stroke(); }
    else targetCtx.stroke();

    // чёрные элементы
    targetCtx.strokeStyle = faceColor;
    targetCtx.fillStyle = faceColor;
    targetCtx.lineWidth = lw;
    for (const side of [-1, 1]) {
      traceEye(side);
      if (e.eyeShape > 0.7) targetCtx.stroke();
      else targetCtx.fill();

      if (e.eyeShape > 0.55) {
        tracePupil(side);
        targetCtx.fillStyle = faceColor;
        targetCtx.fill();

        const pupilR = eyeSize * e.pupilSize;
        const glint = self._buildEye(1, 0, pupilR * 0.3);
        targetCtx.beginPath();
        glint.forEach(([x, y], i) => {
          const [nx, ny] = self._facePointToBody(
            x + side * eyeDX - pupilR * 0.3,
            y + eyeY + e.pupilOffset * eyeSize - pupilR * 0.3,
            p
          );
          i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
        });
        targetCtx.closePath();
        targetCtx.fillStyle = p.fill;
        targetCtx.fill();
        targetCtx.fillStyle = faceColor;
      }

      targetCtx.lineWidth = lw * 0.9;
      traceBrow(side);
      targetCtx.stroke();
      targetCtx.lineWidth = lw;
    }
    traceMouth();
    if (e.mouthOpen > 0.15) {
      targetCtx.fillStyle = faceColor;
      targetCtx.fill();
    }
    targetCtx.strokeStyle = faceColor;
    targetCtx.lineWidth = lw;
    targetCtx.stroke();

    targetCtx.restore();
    targetCtx.restore();
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
      // Свежий экспорт делается ВНУТРИ метода класса.
      // Если ползунки менялись после открытия окна — загрузится актуальная версия.
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

  // ---- подключаем обработчики ----
  document.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', loop);
  });

  document.querySelectorAll('.emotion-scale span').forEach(el => {
    el.addEventListener('click', () => {
      $('emo').value = el.dataset.emo;
      loop();
    });
  });

  $('reset').addEventListener('click', () => {
    // сброс UI-ползунков к значениям по умолчанию из класса
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

  // первый запуск
  resize();
  loop();
})();