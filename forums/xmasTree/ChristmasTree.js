class ChristmasTree {
    constructor(
      canvas,
      initialGrowth = 0,
      ornamentCount = 0,
      ornamentColor = "#ff4d6d"
    ) {
      this.canvas =
        typeof canvas === "string" ? document.querySelector(canvas) : canvas;
      this.ctx = this.canvas.getContext("2d");
      this.W = this.canvas.width;
      this.H = this.canvas.height;

      // Параметры генерации
      this.NODE_START = 2.0;
      this.NODE_STEP = 5.0;
      this.AGE_FULL = 55;
      this.MAX_BRANCH_LEN = 70;
      this.MIN_CHILD_LEN = 5;
      this.CHILD_AZ_1 = 0.55;
      this.CHILD_AZ_2 = 0.65;
      this.CHILD_TILT_BIAS = 0.06;
      this.ROW_PHASE_STEP = 2.2;
      this.MID_PER_GAP = 2;
      this.MID_LEN = 20;
      this.MID_BRANCH_PROB = 0.4;
      this.MID_BRANCH_MUL = 1.8;
      this.MAX_SEGMENTS_DRAW = 5000;

      // Состояние камеры и кэша
      this.camYaw = 0;
      this.scaleCur = 1;
      this.dragging = false;
      this.lastPointer = null;
      this.CX = this.W / 2;
      this.CY = this.H - 30;

      this.growth = Math.max(0, initialGrowth);
      this.cachedG = -1;
      this.cached = null;
      this.cachedSortYaw = NaN;
      this.cachedSortG = -1;
      this.cachedOrder = [];
      this.rafPending = false;
      this.ornamentCount = Math.max(0, Math.floor(ornamentCount));
      this.ornamentColor = ornamentColor;
      this.ornamentSeed = Math.floor(Math.random() * 2147483646) + 1;

      this._bindEvents();
      this.requestRender();
    }

    // Публичный метод для изменения роста извне
    setGrowth(val) {
      this.growth = Math.max(0, Number(val) || 0);
      this.requestRender();
    }

    // Публичный метод сброса угла поворота
    resetView() {
      this.camYaw = 0;
      this.requestRender();
    }

    requestRender() {
      if (!this.rafPending) {
        this.rafPending = true;
        requestAnimationFrame(() => this.render());
      }
    }

    _growthToTrunk(g) {
      return g <= 0 ? 0 : g * 0.6;
    }

    _project(x, y, z) {
      const cosY = Math.cos(this.camYaw);
      const sinY = Math.sin(this.camYaw);
      const rx = x * cosY - z * sinY;
      const rz = x * sinY + z * cosY;
      return {
        x: this.CX + rx * this.scaleCur,
        y: this.CY - y * this.scaleCur,
        z: rz,
      };
    }

    _tiltByAge(age) {
      const t = 1 - Math.exp(-age / (this.AGE_FULL * 0.45));
      const tiltStart = Math.PI / 2 - 0.25;
      const tiltEnd = -0.25;
      return tiltStart * (1 - t) + tiltEnd * t;
    }

    _lenByAge(age, baseMaxLen, trunkLen, h) {
      if (age <= 0) return 0;
      const expPart = 1 - Math.exp(-age / 45);
      const linPart = age / 900;
      let raw = baseMaxLen * (expPart + linPart);

      const frac = h / trunkLen;
      const lateBoost =
        Math.max(0, (age - 100) / 400) * (1 - frac) * baseMaxLen * 0.7;
      raw += lateBoost;

      const vertBudget = Math.max(3.0, (trunkLen - h) * 1.0);
      return Math.min(raw, vertBudget);
    }

    _thickByAge(age) {
      return 1 + age * 0.014;
    }

    _dirFromTilt(azimuth, tilt) {
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      return {
        dx: Math.cos(azimuth) * ct,
        dy: st,
        dz: Math.sin(azimuth) * ct,
      };
    }

    _buildBranch(
      origin,
      azimuth,
      tilt,
      length,
      droop,
      depth,
      out,
      tierLevel,
      ageThick,
      maxLen,
      age,
      maxChildDepth
    ) {
      if (length < 0.05) return;
      const SEGMENTS = length > 6 ? 3 : 2;
      let px = origin.x,
        py = origin.y,
        pz = origin.z;
      let curAz = azimuth;
      let curTilt = tilt;

      for (let s = 1; s <= SEGMENTS; s++) {
        const t = s / SEGMENTS;
        const segLen = length / SEGMENTS;
        curTilt -= droop / SEGMENTS;

        const d = this._dirFromTilt(curAz, curTilt);
        const nx = px + d.dx * segLen;
        const ny = py + d.dy * segLen;
        const nz = pz + d.dz * segLen;

        out.push({
          type: "seg",
          x1: px,
          y1: py,
          z1: pz,
          x2: nx,
          y2: ny,
          z2: nz,
          depth,
          t,
          tierLevel,
          ageThick,
          zSort: (pz + nz) / 2,
        });

        if (
          maxChildDepth > 0 &&
          depth < maxChildDepth &&
          s < SEGMENTS &&
          length > this.MIN_CHILD_LEN
        ) {
          const excess = (length - this.MIN_CHILD_LEN) / Math.max(1, length);
          const childMaxLen = Math.max(0.4, maxLen * (0.32 - 0.08 * depth));
          const childLen = childMaxLen * Math.min(1, excess * 1.8);
          if (childLen > 0.08) {
            const childAge = age * (0.55 + 0.15 * depth);
            const azDelta = depth === 0 ? this.CHILD_AZ_1 : this.CHILD_AZ_2;
            for (const side of [-1, 1]) {
              this._buildBranch(
                { x: nx, y: ny, z: nz },
                curAz + side * azDelta,
                curTilt + side * this.CHILD_TILT_BIAS,
                childLen,
                droop * 0.5,
                depth + 1,
                out,
                tierLevel,
                ageThick,
                childMaxLen,
                childAge,
                maxChildDepth
              );
            }
          }
        }
        px = nx;
        py = ny;
        pz = nz;
      }
    }

    _segColor(depth, t, zSort, tierLevel, maxZ) {
      const zn = maxZ > 0 ? Math.max(-1, Math.min(1, zSort / (maxZ * 0.6))) : 0;
      const depthMul = 0.55 + (zn + 1) * 0.4;
      const darkBase = 45 + tierLevel * 15;
      const r = Math.round((12 + depth * 6 + t * 14) * depthMul);
      const g = Math.round((darkBase + depth * 18 + t * 28) * depthMul);
      const b = Math.round(
        (22 + depth * 8 + t * 12) * depthMul + (zn < 0 ? 18 : 0)
      );
      if (t === 0) return `rgb(155,0,0)`;
      return `rgb(${r},${g},${b})`;
    }

    _buildTree(g) {
      if (g <= 0) {
        return {
          drawList: [],
          trunkLen: 0,
          bbox: { maxY: 8, maxRad: 3 },
          seed: true,
        };
      }

      const trunkLen = this._growthToTrunk(g);
      const drawList = [];

      const trunkBaseW = 0.25 + trunkLen * 0.014;
      const trunkTipW = Math.max(0.12, trunkBaseW * 0.15);
      const TRUNK_SEGS = Math.min(
        40,
        Math.max(3, Math.floor(trunkLen / 25) + 1)
      );

      for (let s = 0; s < TRUNK_SEGS; s++) {
        const f1 = s / TRUNK_SEGS;
        const f2 = (s + 1) / TRUNK_SEGS;
        drawList.push({
          type: "trunk",
          x1: 0,
          y1: trunkLen * f1,
          z1: 0,
          x2: 0,
          y2: trunkLen * f2,
          z2: 0,
          zSort: 0,
          w1: trunkBaseW + (trunkTipW - trunkBaseW) * f1,
          w2: trunkBaseW + (trunkTipW - trunkBaseW) * f2,
        });
      }

      const K_MAX = Math.floor(
        (trunkLen - this.NODE_START - 0.001) / this.NODE_STEP
      );

      for (let k = 0; k <= K_MAX; k++) {
        const h = this.NODE_START + k * this.NODE_STEP;
        if (h >= trunkLen - 0.05) continue;
        const age = trunkLen - h;
        if (age <= 0) continue;

        const heightFrac = h / trunkLen;
        const baseMaxLen = this.MAX_BRANCH_LEN * (1 - heightFrac * 0.7);
        const len = this._lenByAge(age, baseMaxLen, trunkLen, h);
        if (len < 0.02) continue;

        const tilt = this._tiltByAge(age);
        const droop = 0.15 * Math.min(1, age / this.AGE_FULL);
        const ageThick = this._thickByAge(age);
        const tierLevel = Math.min(1, heightFrac);
        const branches = 5 + (k % 3);
        const phase = k * this.ROW_PHASE_STEP;

        for (let b = 0; b < branches; b++) {
          this._buildBranch(
            { x: 0, y: h, z: 0 },
            phase + (b / branches) * Math.PI * 2,
            tilt,
            len,
            droop,
            0,
            drawList,
            tierLevel,
            ageThick,
            baseMaxLen,
            age,
            2
          );
        }
      }

      for (let k = 0; k <= K_MAX; k++) {
        const hA = this.NODE_START + k * this.NODE_STEP;
        const hB = hA + this.NODE_STEP;
        for (let m = 1; m <= this.MID_PER_GAP; m++) {
          const hM = hA + (hB - hA) * (m / (this.MID_PER_GAP + 1));
          if (hM >= trunkLen - 0.2) continue;
          const ageM = trunkLen - hM;
          if (ageM <= 0) continue;

          const phaseM = (k + m * 0.37) * this.ROW_PHASE_STEP;
          for (let b = 0; b < 2; b++) {
            const seedVal = (k * 7 + m * 13 + b * 3) % 100;
            const willBranch = seedVal < Math.round(this.MID_BRANCH_PROB * 100);
            const midMaxLen = willBranch
              ? this.MID_LEN * this.MID_BRANCH_MUL
              : this.MID_LEN;
            const lenM = this._lenByAge(ageM, midMaxLen, trunkLen, hM);
            if (lenM < 0.05) continue;

            this._buildBranch(
              { x: 0, y: hM, z: 0 },
              phaseM + (b / 2) * Math.PI * 2,
              this._tiltByAge(ageM),
              lenM,
              0,
              0,
              drawList,
              1,
              1,
              midMaxLen,
              ageM,
              willBranch ? 1 : 0
            );
          }
        }
      }

      // Собираем подходящие сегменты веток (лучше всего подходят внешние кончики)
      const branchTips = drawList.filter(
        (it) => it.type === "seg" && (it.depth >= 1 || it.t === 1)
      );

      if (this.ornamentCount > 0 && branchTips.length > 0) {
        // Перемешиваем индексы веток детерминированным способом (алгоритм Фишера-Йейтса с сидом)
        const indices = branchTips.map((_, idx) => idx);
        let seed = this.ornamentSeed;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const count = Math.min(this.ornamentCount, branchTips.length);
        const colors = Array.isArray(this.ornamentColor)
          ? this.ornamentColor
          : [this.ornamentColor];

        for (let i = 0; i < count; i++) {
          const seg = branchTips[indices[i]];
          const color = colors[i % colors.length];
          const radius = 2.8 + rand() * 0.9; // Увеличенный размер шарика
          const drop = radius * 0.85; // Опускаем ниже пропорционально радиусу

          drawList.push({
            type: "ornament",
            x1: seg.x2,
            y1: seg.y2 - drop,
            z1: seg.z2,
            x2: seg.x2,
            y2: seg.y2 - drop,
            z2: seg.z2,
            anchorY: seg.y2, // запоминаем точку на ветке для ниточки
            color: color,
            radius: radius,
          });
        }
      }

      let maxY = trunkLen,
        minY = 0,
        maxRad = 0;
      for (const it of drawList) {
        maxY = Math.max(maxY, it.y1, it.y2);
        minY = Math.min(minY, it.y1, it.y2); // отслеживаем ветки, опустившиеся ниже 0
        if (it.type !== "trunk") {
          const pad = it.type === "ornament" ? it.radius || 3 : 2;
          maxRad = Math.max(
            maxRad,
            Math.hypot(it.x1, it.z1) + pad,
            Math.hypot(it.x2, it.z2) + pad
          );
        }
      }

      // Делаем ствол заметно длиннее вниз (например, 45% от самого глубокого свеса, но не глубже -10)
      const trunkBaseY = minY < 0 ? Math.max(minY * 0.45, -10) : -2;

      if (drawList.length > 0 && drawList[0].type === "trunk") {
        drawList[0].y1 = trunkBaseY;
      }

      // Добавляем сугроб в общий список отрисовки (с глубиной z = 0)
      drawList.push({
        type: "snowdrift",
        x1: 0,
        y1: trunkBaseY,
        z1: 0,
        x2: 0,
        y2: trunkBaseY,
        z2: 0,
      });

      const totalH = maxY - Math.min(minY, trunkBaseY) + 6;
      maxRad = Math.max(maxRad, 2) * 1.12;

      return {
        drawList,
        trunkLen,
        bbox: { maxY: totalH, minY, trunkBaseY, maxRad },
        seed: false,
      };
    }

    _getTree(g) {
      if (g !== this.cachedG || !this.cached) {
        this.cached = this._buildTree(g);
        this.cachedG = g;
      }
      return this.cached;
    }

    render() {
      this.rafPending = false;
      const { drawList, trunkLen, bbox, seed } = this._getTree(this.growth);

      const padPx = 40;
      const availW = this.W - padPx * 2;
      const availH = this.H - padPx * 2;
      const safeMaxY = Math.max(bbox.maxY, trunkLen + 6, 6);
      const safeMaxRad = Math.max(bbox.maxRad, 2);

      let scaleTarget = Math.min(
        availW / (safeMaxRad * 2),
        availH / safeMaxY,
        30
      );
      if (!isFinite(scaleTarget) || scaleTarget <= 0) scaleTarget = 1;

      // Более быстрое и равномерное слежение камеры (0.35 вместо 0.15)
      this.scaleCur += (scaleTarget - this.scaleCur) * 0.35;
      const isZooming = Math.abs(scaleTarget - this.scaleCur) > 0.0005;
      if (!isZooming) this.scaleCur = scaleTarget;

      // Поднимаем основание ствола ровно настолько, чтобы нижние ветки (minY) не уходили за край
      const bottomOverhang = Math.max(0, -(bbox.minY || 0)) * this.scaleCur;
      this.CY = this.H - padPx - 4 - bottomOverhang;
      this.CX = this.W / 2;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);

      const groundY = bbox.trunkBaseY || 0;
      const groundP = this._project(0, groundY, 0);

      // Фон пола от основания ствола
      const grd = ctx.createLinearGradient(0, groundP.y, 0, this.H);
      grd.addColorStop(0, "#14233d");
      grd.addColorStop(1, "#0a0f1e");
      ctx.fillStyle = grd;
      ctx.fillRect(0, groundP.y, this.W, this.H - groundP.y);

      // Сугроб строго под основанием ствола
      ctx.fillStyle = "rgba(200,225,255,0.12)";
      ctx.beginPath();
      ctx.ellipse(
        groundP.x,
        groundP.y + 4,
        Math.max(20, bbox.maxRad * this.scaleCur * 1.1),
        12,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      if (seed) {
        const sz = Math.max(6, Math.min(30, 10 * this.scaleCur));
        ctx.fillStyle = "#8a6a3a";
        ctx.beginPath();
        ctx.ellipse(
          groundP.x,
          this.CY - sz * 0.9,
          sz * 0.7,
          sz,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.strokeStyle = "#5f4726";
        ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * this.scaleCur));
        ctx.stroke();
        if (isZooming) this.requestRender();
        return;
      }
      if (
        this.camYaw !== this.cachedSortYaw ||
        this.growth !== this.cachedSortG
      ) {
        const cosY = Math.cos(this.camYaw),
          sinY = Math.sin(this.camYaw);
        this.cachedOrder = drawList
          .map((it) => ({
            it,
            z: (it.x1 + it.x2) * 0.5 * sinY + (it.z1 + it.z2) * 0.5 * cosY,
          }))
          .sort((a, b) => a.z - b.z);
        this.cachedSortYaw = this.camYaw;
        this.cachedSortG = this.growth;
      }
      const tooMany = drawList.length > this.MAX_SEGMENTS_DRAW;
      const maxZ = bbox.maxRad;
      for (const { it: seg } of this.cachedOrder) {
        // 0. Объёмный сугроб-полусфера на уровне z = 0 (дальние ветки за ним, передние перед ним)
        if (seg.type === "snowdrift") {
          const P = this._project(0, seg.y1, 0);
          // Делаем радиус в 2 раза меньше размаха веток и ограничиваем максимум (140px)
          const rx = Math.max(
            18,
            Math.min(140, bbox.maxRad * this.scaleCur * 0.45)
          );
          const ry = Math.max(8, rx * 0.35);

          const snowGrd = ctx.createRadialGradient(
            P.x,
            P.y - ry * 0.4,
            rx * 0.1,
            P.x,
            P.y + ry * 0.2,
            rx
          );
          snowGrd.addColorStop(0, "rgba(225, 240, 255, 0.35)");
          snowGrd.addColorStop(0.65, "rgba(180, 210, 245, 0.16)");
          snowGrd.addColorStop(1, "rgba(140, 175, 220, 0.0)");

          ctx.fillStyle = snowGrd;
          ctx.beginPath();
          ctx.ellipse(P.x, P.y + 2, rx, ry, 0, Math.PI, Math.PI * 2);
          ctx.ellipse(P.x, P.y + 2, rx, ry * 0.2, 0, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
          continue;
        }

        // 1. Отрисовка сегмента ствола в его реальной глубине (z = 0)
        if (seg.type === "trunk") {
          const A = this._project(seg.x1, seg.y1, seg.z1);
          const B = this._project(seg.x2, seg.y2, seg.z2);
          const wA = seg.w1 * this.scaleCur;
          const wB = seg.w2 * this.scaleCur;
          const grd2 = ctx.createLinearGradient(A.x - wA, 0, A.x + wA, 0);
          grd2.addColorStop(0, "#2c1a0c");
          grd2.addColorStop(0.5, "#5a3d22");
          grd2.addColorStop(1, "#2c1a0c");
          ctx.fillStyle = grd2;
          ctx.beginPath();
          ctx.moveTo(A.x - wA, A.y);
          ctx.lineTo(A.x + wA, A.y);
          ctx.lineTo(B.x + wB, B.y);
          ctx.lineTo(B.x - wB, B.y);
          ctx.closePath();
          ctx.fill();
          continue;
        }
        if (seg.type === "ornament") {
          const P = this._project(seg.x1, seg.y1, seg.z1);
          const A = this._project(seg.x1, seg.anchorY, seg.z1);
          const r = Math.max(3.5, Math.min(22, seg.radius * this.scaleCur));

          // Тонкая ниточка от кончика ветки к шарику
          ctx.strokeStyle = "rgba(255, 235, 180, 0.45)";
          ctx.lineWidth = Math.max(0.8, 0.5 * this.scaleCur);
          ctx.beginPath();
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(P.x, P.y - r * 0.85);
          ctx.stroke();

          // Сам шарик
          const ballGrd = ctx.createRadialGradient(
            P.x - r * 0.3,
            P.y - r * 0.3,
            r * 0.1,
            P.x,
            P.y,
            r
          );
          ballGrd.addColorStop(0, "#ffffff");
          ballGrd.addColorStop(0.35, seg.color);
          ballGrd.addColorStop(1, "#111827");

          ctx.fillStyle = ballGrd;
          ctx.beginPath();
          ctx.arc(P.x, P.y, r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (seg.type !== "seg") continue;
        if (tooMany && seg.depth > 1) continue;
        const A = this._project(seg.x1, seg.y1, seg.z1);
        const B = this._project(seg.x2, seg.y2, seg.z2);
        ctx.strokeStyle = this._segColor(
          seg.depth,
          seg.t,
          seg.zSort,
          seg.tierLevel,
          maxZ
        );
        const tierThick = 1.6 - seg.tierLevel * 0.9;
        const baseThick = (2.8 - seg.depth * 0.7) * tierThick * seg.ageThick;
        const zThick =
          1 +
          Math.max(-0.3, Math.min(0.5, maxZ > 0 ? seg.zSort / (maxZ * 3) : 0));
        ctx.lineWidth = Math.max(
          0.6,
          Math.min(12, baseThick * this.scaleCur * zThick)
        );
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      if (trunkLen > 0) {
        const tip = this._project(0, trunkLen + 1.5, 0);
        const starR = Math.max(4, Math.min(12, 8 * this.scaleCur));
        ctx.save();
        ctx.fillStyle = "#ffd34d";
        ctx.shadowColor = "#ffd34d";
        ctx.shadowBlur = Math.min(14, 12 * this.scaleCur);
        this._drawStar(tip.x, tip.y, starR, starR * 0.45);
        ctx.restore();
      }
      if (isZooming) this.requestRender();
    }
    _drawStar(cx, cy, outer, inner) {
      const ctx = this.ctx;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    _getPoint(e) {
      if (e.touches && e.touches.length)
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (e.changedTouches && e.changedTouches.length)
        return {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        };
      return { x: e.clientX, y: e.clientY };
    }
    _bindEvents() {
      const onDown = (e) => {
        this.dragging = true;
        this.canvas.classList.add("dragging");
        this.lastPointer = this._getPoint(e);
      };
      const onMove = (e) => {
        if (!this.dragging || !this.lastPointer) return;
        const p = this._getPoint(e);
        this.camYaw += (p.x - this.lastPointer.x) * 0.01;
        this.lastPointer = p;
        e.preventDefault();
        this.requestRender();
      };
      const onUp = () => {
        this.dragging = false;
        this.canvas.classList.remove("dragging");
        this.lastPointer = null;
      };
      this.canvas.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      this.canvas.addEventListener("mouseleave", onUp);
      this.canvas.addEventListener("touchstart", onDown, { passive: true });
      this.canvas.addEventListener("touchmove", onMove, { passive: false });
      this.canvas.addEventListener("touchend", onUp);
      this.canvas.addEventListener("touchcancel", onUp);
    }
  }
