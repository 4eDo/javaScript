/* ============================================================
 *  Pumpkin — рисует тыкву с эмоциями и объёмом на canvas.
 *
 *  Использование:
 *      const p = new Pumpkin(canvasElement);
 *      p.setParams({ emo: 0.5, tw: 1.2, ... });
 *      p.render();
 *
 *      const dataURL = p.exportDataURL({ format: 'webp', max: 200 });
 *      const result  = await p.uploadToImgbb('API_KEY');
 * ============================================================ */

class Pumpkin {

  // ---------- ФИКСИРОВАННЫЕ КОНСТАНТЫ ----------
  static STROKE_COLOR = '#000000';
  static FACE_COLOR   = '#000000';
  static BASE_LWD     = 5;
  static HALO_SCALE   = 1.8;
  static EXPORT_MAX   = 200;

  // ---------- ПАРАМЕТРЫ ПО УМОЛЧАНИЮ ----------
  static DEFAULTS = {
    emo: 0.5, int: 1,
    shade: 0.55, lit: 0.35,
    tw: 1, mw: 1, bw: 1,
    lw: 1, rw: 1, hh: 1,
    ts: 0, ms: 0, bs: 0,
    sk: 0, rt: 0,
    fx: 0, fy: 0, fs: 1,
    fill: '#f28c1a',
  };

  constructor(canvas) {
    if (!canvas) throw new Error('Pumpkin: canvas не передан');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.params = { ...Pumpkin.DEFAULTS };

    // предрассчитанная геометрия (не зависит от параметров)
    this.OUTLINE  = this._buildOutline();
    this.RIBS     = this._buildRibs();
    this.STEM     = this._buildStem();
    this.STEM_BAR = this._buildStemBar();

    this.SHADE_RIGHT  = this._buildShadeRight();
    this.SHADE_BOTTOM = this._buildShadeBottom();
    this.HIGHLIGHT    = this._buildHighlight();
    this.RIB_SHADOWS  = this._buildRibShadows();

    // кривые эмоций
    this.EMOTIONS = Pumpkin.EMOTIONS;
  }

  // ============================================================
  //  ПУБЛИЧНЫЙ API
  // ============================================================

  setParams(obj) {
    Object.assign(this.params, obj);
    return this;
  }

  setParam(key, value) {
    this.params[key] = value;
    return this;
  }

  getParams() {
    return { ...this.params };
  }

  reset() {
    this.params = { ...Pumpkin.DEFAULTS };
    return this;
  }

  /** Отрисовать на основном canvas. */
  render() {
    this._renderTo(this.ctx, this.canvas.width, this.canvas.height, false);
  }

  /**
   * Вернуть data URL картинки с прозрачным фоном.
   * @param {object} opts
   *   format: 'webp' | 'png'  (по умолчанию 'webp')
   *   quality: number 0..1      (по умолчанию 1.0)
   *   max: максимальная сторона в px (по умолчанию 200)
   */
  exportDataURL(opts = {}) {
    const format  = opts.format  || 'webp';
    const quality = opts.quality ?? 1.0;
    const max     = opts.max     ?? Pumpkin.EXPORT_MAX;

    const p = this.params;

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

    const aspect = w / h;
    let outW, outH;
    if (aspect >= 1) { outW = max; outH = Math.max(1, Math.round(max / aspect)); }
    else            { outH = max; outW = Math.max(1, Math.round(max * aspect)); }

    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const octx = off.getContext('2d');

    this._renderTo(octx, outW, outH, true);

    const mime = format === 'png' ? 'image/png' : 'image/webp';
    const dataURL = off.toDataURL(mime, quality);

    // определяем фактический формат (на случай фолбэка)
    const actual = dataURL.startsWith('data:image/webp') ? 'webp'
                 : dataURL.startsWith('data:image/png')  ? 'png'
                 : 'unknown';

    return {
      dataURL,
      width: outW,
      height: outH,
      format: actual,
      bytes: Math.round(dataURL.length * 0.75), // приблизительно бинарный размер
    };
  }

  /**
   * Загрузить свежую картинку на imgbb.
   * @param {string} apiKey
   * @param {object} opts — те же, что и exportDataURL
   * @returns {Promise<{direct:string,page:string,deleteUrl:string,raw:object}>}
   */
  async uploadToImgbb(apiKey, opts = {}) {
    if (!apiKey) throw new Error('imgbb: не указан API-ключ');
    const { dataURL } = this.exportDataURL(opts);
    const base64 = dataURL.split(',')[1];

    const form = new FormData();
    form.append('key', apiKey);
    form.append('image', base64);
    form.append('name', 'pumpkin_' + Date.now());

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      const msg = (json && json.error && json.error.message) || ('HTTP ' + res.status);
      throw new Error(msg);
    }

    const d = json.data;
    return {
      direct:    d.image && d.image.url || d.url || '',
      page:      d.url_viewer || d.url || '',
      deleteUrl: d.delete_url || '',
      raw:       d,
    };
  }

  /** Подогнать размер canvas под контейнер с учётом DPR. */
  resizeToContainer(container) {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    this.canvas.width  = Math.max(200, rect.width  * dpr);
    this.canvas.height = Math.max(200, rect.height * dpr);
    this.canvas.style.width  = rect.width  + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.render();
  }

  // ============================================================
  //  ВНУТРЕННЕЕ — ГЕОМЕТРИЯ
  // ============================================================

  _buildOutline(steps = 240) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    return pts;
  }

  _buildRibs() {
    const ribs = [];
    const pList = [-0.85, -0.6, -0.32, 0, 0.32, 0.6, 0.85];
    for (const p of pList) {
      const rib = [];
      const ap = Math.abs(p);
      const sign = Math.sign(p) || 1;
      const edge = ap / 0.85;
      const aX = 0.08 + ap * 0.42;
      const aY = 0.82 + edge * 0.16;
      const roundness = 0.45 + edge * 0.5;
      const aXround = Math.min(aX, aY * roundness);
      const centerX = sign * ap * 0.55;
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const ang = -Math.PI / 2 + t * Math.PI;
        rib.push([
          centerX + sign * aXround * Math.cos(ang),
          aY * Math.sin(ang),
        ]);
      }
      ribs.push(rib);
    }
    return ribs;
  }

  _buildStem() {
    return [
      [ 0.02, -0.90], [ 0.05, -1.14], [ 0.12, -1.26], [ 0.20, -1.28],
      [ 0.16, -1.18], [ 0.11, -1.00], [ 0.07, -0.88],
    ];
  }

  _buildStemBar() {
    const pts = [];
    const x0 = -0.14, x1 = 0.18, y0 = -0.90;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([
        x0 + (x1 - x0) * t,
        y0 + 0.035 * Math.sin(t * Math.PI),
      ]);
    }
    return pts;
  }

  _buildShadeRight() {
    const pts = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const ang = -Math.PI / 2 + t * Math.PI;
      pts.push([Math.cos(ang) * 0.99, Math.sin(ang) * 0.99]);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const ang = -Math.PI / 2 + t * Math.PI;
      const inset = 0.18 + 0.28 * Math.sin(t * Math.PI);
      pts.push([Math.cos(ang) * (1 - inset), Math.sin(ang) * (1 - inset * 0.7)]);
    }
    return pts;
  }

  _buildShadeBottom() {
    const pts = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const ang = Math.PI * 0.15 + t * Math.PI * 0.7;
      pts.push([Math.cos(ang) * 0.99, Math.sin(ang) * 0.99]);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const ang = Math.PI * 0.15 + t * Math.PI * 0.7;
      pts.push([Math.cos(ang) * 0.82, Math.sin(ang) * 0.82]);
    }
    return pts;
  }

  _buildHighlight() {
    const pts = [];
    const N = 40;
    const cx = -0.42, cy = -0.4;
    const rx = 0.22, ry = 0.32;
    const tilt = -0.5;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x0 = Math.cos(a) * rx;
      const y0 = Math.sin(a) * ry;
      pts.push([cx + x0 * c - y0 * s, cy + x0 * s + y0 * c]);
    }
    return pts;
  }

  _buildRibShadows() {
    const shadows = [];
    for (const rib of this.RIBS) {
      const mid = rib[Math.floor(rib.length / 2)];
      if (Math.abs(mid[0]) < 0.02) continue;
      const left = [];
      const right = [];
      for (const [x, y] of rib) {
        const dir = x >= 0 ? 1 : -1;
        left.push([x, y]);
        right.push([x - dir * 0.045, y]);
      }
      shadows.push([...left, ...right.reverse()]);
    }
    return shadows;
  }

  // ============================================================
  //  ЭМОЦИИ
  // ============================================================
  static EMOTIONS = [
    { // 0: ГРУСТЬ
      eyeShape: 0.3, eyeTilt: -0.4, eyeSize: 0.9, eyeScaleY: 1.0,
      pupilSize: 0.7, pupilOffset: 0.3,
      browAngle: 0.35, browY: -0.02,
      mouthCurve: -0.7, mouthOpen: 0.05, mouthWidth: 0.55,
    },
    { // 1: РАДОСТЬ
      eyeShape: 0.5, eyeTilt: 0.0, eyeSize: 1.0, eyeScaleY: 1.0,
      pupilSize: 0.85, pupilOffset: 0,
      browAngle: -0.08, browY: -0.05,
      mouthCurve: 0.9, mouthOpen: 0.5, mouthWidth: 0.75,
    },
    { // 2: ГНЕВ
      eyeShape: 0.0, eyeTilt: 0.6, eyeSize: 0.95, eyeScaleY: 0.72,
      pupilSize: 0.6, pupilOffset: -0.05,
      browAngle: -0.5, browY: -0.06,
      mouthCurve: -0.5, mouthOpen: 0.35, mouthWidth: 0.65,
    },
  ];

  _lerpEmotions(a, b, t) {
    const out = {};
    for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
    return out;
  }

  _getEmotionParams(slider) {
    if (slider <= 0.5) return this._lerpEmotions(this.EMOTIONS[0], this.EMOTIONS[1], slider / 0.5);
    return this._lerpEmotions(this.EMOTIONS[1], this.EMOTIONS[2], (slider - 0.5) / 0.5);
  }

  _applyIntensity(e, intensity) {
    const neutral = {
      eyeShape: 0.5, eyeTilt: 0, eyeSize: 1, eyeScaleY: 1,
      pupilSize: 0.8, pupilOffset: 0,
      browAngle: 0, browY: 0,
      mouthCurve: 0, mouthOpen: 0, mouthWidth: 0.6,
    };
    const out = {};
    for (const k in e) out[k] = neutral[k] + (e[k] - neutral[k]) * intensity;
    return out;
  }

  // ============================================================
  //  ФОРМЫ ЛИЦА
  // ============================================================
  _buildEye(shape, tilt, size, scaleY = 1) {
    const pts = [];
    const N = 40;
    const s = size;
    const tri = [
      [ 0.0, -1.0 * s],
      [ 0.9 * s,  0.9 * s],
      [-0.9 * s,  0.9 * s],
    ];
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const triRot = tri.map(([x, y]) => [x * c - y * sn, x * sn + y * c]);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const per = [0, 1/3, 2/3, 1];
      let seg = 0;
      while (seg < 3 && t > per[seg + 1]) seg++;
      const localT = (t - per[seg]) / (per[seg + 1] - per[seg]);
      const p0 = triRot[seg % 3];
      const p1 = triRot[(seg + 1) % 3];
      const tx = p0[0] + (p1[0] - p0[0]) * localT;
      const ty = p0[1] + (p1[1] - p0[1]) * localT;
      const ang = t * Math.PI * 2 - Math.PI / 2;
      const ox = Math.cos(ang) * s;
      const oy = Math.sin(ang) * s;
      let px = tx * (1 - shape) + ox * shape;
      let py = ty * (1 - shape) + oy * shape;
      py *= scaleY;
      pts.push([px, py]);
    }
    return pts;
  }

  _buildBrow(angle, len) {
    const pts = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (t - 0.5) * len;
      pts.push([x, Math.sin(angle) * x]);
    }
    return pts;
  }

  _buildMouth(curve, open, width) {
    const pts = [];
    const N = 48;
    const halfW = width / 2;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -halfW + width * t;
      const smile = curve * (1 - Math.pow(2 * t - 1, 2));
      pts.push([x, smile * 0.25 - open * 0.5 * (1 - Math.pow(2 * t - 1, 2))]);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const x = -halfW + width * t;
      const smile = curve * (1 - Math.pow(2 * t - 1, 2));
      pts.push([x, smile * 0.25 + open * 0.5 * (1 - Math.pow(2 * t - 1, 2))]);
    }
    return pts;
  }

  // ============================================================
  //  ДЕФОРМАЦИЯ
  // ============================================================
  _deform(x, y, p) {
    const topW = Math.exp(-Math.pow((y + 0.7) * 1.6, 2));
    const midW = Math.exp(-Math.pow((y - 0.0) * 1.6, 2));
    const botW = Math.exp(-Math.pow((y - 0.7) * 1.6, 2));
    const wSum = topW + midW + botW || 1;
    const wt = topW / wSum, wm = midW / wSum, wb = botW / wSum;

    const localW = wt * p.tw + wm * p.mw + wb * p.bw;
    const sideW = x >= 0 ? p.rw : p.lw;

    let ny = y * p.hh;
    const dy = wt * p.ts + wm * p.ms + wb * p.bs;
    ny += dy / 300;

    let nx = x * localW * sideW;

    const rad = p.rt * Math.PI / 180;
    const skew = Math.tan(p.sk * Math.PI / 180);
    nx += ny * skew;

    return [
      nx * Math.cos(rad) - ny * Math.sin(rad),
      nx * Math.sin(rad) + ny * Math.cos(rad),
    ];
  }

  _facePointToBody(fx, fy, p) {
    return this._deform(fx * p.fs + p.fx, fy * p.fs + p.fy, p);
  }

  _collectPoints(p) {
    const all = [];
    for (const [x, y] of this.OUTLINE)  all.push(this._deform(x, y, p));
    for (const rib of this.RIBS) for (const [x, y] of rib) all.push(this._deform(x, y, p));
    for (const [x, y] of this.STEM)     all.push(this._deform(x, y, p));
    for (const [x, y] of this.STEM_BAR) all.push(this._deform(x, y, p));
    const emo = this._getEmotionParams(p.emo);
    const e = this._applyIntensity(emo, p.int);
    const eye = this._buildEye(e.eyeShape, e.eyeTilt, e.eyeSize * 0.22, e.eyeScaleY);
    for (const [x, y] of eye) all.push(this._facePointToBody(x - 0.35, y - 0.15, p));
    for (const [x, y] of eye) all.push(this._facePointToBody(x + 0.35, y - 0.15, p));
    return all;
  }

  // ============================================================
  //  ЦВЕТ
  // ============================================================
  _hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  _rgbToHex(r, g, b) {
    return '#' + [r, g, b]
      .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('');
  }
  _darken(hex, amount) {
    const [r, g, b] = this._hexToRgb(hex);
    return this._rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
  }
  _lighten(hex, amount) {
    const [r, g, b] = this._hexToRgb(hex);
    return this._rgbToHex(
      r + (255 - r) * amount,
      g + (255 - g) * amount,
      b + (255 - b) * amount
    );
  }

  // ============================================================
  //  ГЛАВНАЯ ОТРИСОВКА
  // ============================================================
  _renderTo(targetCtx, targetW, targetH, exportMode) {
    const p = this.params;

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

    const pad = exportMode ? (Pumpkin.BASE_LWD / 2 + 2) : 60;
    const fitScale = Math.min((targetW - pad * 2) / w, (targetH - pad * 2) / h);

    targetCtx.save();
    targetCtx.setTransform(1, 0, 0, 1, targetW / 2, targetH / 2);
    targetCtx.scale(fitScale, fitScale);
    targetCtx.translate(-cx, -cy);

    const lw = Pumpkin.BASE_LWD / fitScale;

    // --- ЗАЛИВКА ---
    targetCtx.beginPath();
    this.OUTLINE.forEach(([x, y], i) => {
      const [nx, ny] = this._deform(x, y, p);
      i ? targetCtx.lineTo(nx, ny) : targetCtx.moveTo(nx, ny);
    });
    targetCtx.closePath();
    targetCtx.fillStyle = p.fill;
    targetCtx.fill();

    // --- ТЕНИ И БЛИК ---
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

    // --- КОНТУР ---
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

    // --- РЁБРА ---
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

    // --- ЧЕРЕНОК ---
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

    // --- ЛИЦО ---
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
}