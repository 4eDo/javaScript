/* ============================================================
 *  pumpkin-quest.js
 *
 *  Логика страницы квестов за тыквы.
 *  Зависимости:
 *    - jQuery   ($)
 *    - Pumpkin  (pumpkin.js)
 *    - PumpkinCore (pumpkin-core.js)
 *    - window.PUMPKIN_QUEST_CONFIG (из pumpkin-quest.html)
 *    - глобалы форума: UserID
 * ============================================================ */

(function () {
  'use strict';

  if (window.self !== window.top) return;

  const CFG = window.PUMPKIN_QUEST_CONFIG;
  if (!CFG) {
    console.error('[pumpkin-quest] PUMPKIN_QUEST_CONFIG не найден');
    return;
  }
  const MSG = CFG.MESSAGES;

  // ---- DOM ----
  const $quest         = $('#pumpkinQuest');
  const $status        = $('#pqStatus');
  const $errors        = $('#pqErrors');
  const $preview       = $('#pqPreviewBlock');
  const $previewW      = $('#pqPreviewWrap');
  const $collLink      = $('#pqCollectionLink');

  const $btnBringLink  = $('#pqBtnBringLink');
  const $btnDiscover   = $('#pqBtnDiscover');
  const $linkBlock     = $('#pqLinkBlock');
  const $linkInput     = $('#pqLinkInput');
  const $btnGetThis    = $('#pqBtnGetThis');
  const $btnCancel     = $('#pqBtnCancel');

  const $discoverBlock = $('#pqDiscoverBlock');
  const $cacheWarning  = $('#pqCacheWarning');
  const $table         = $('#pqTable');
  const $tbody         = $('#pqTableBody');

  if (typeof UserID === 'undefined' || !UserID) {
    console.error('[pumpkin-quest] UserID не найден');
    return;
  }

  const USER_ID   = String(UserID);
  const START_TS  = new Date(CFG.START_DATE + 'T00:00:00').getTime();
  const CACHE_KEY = 'pq_cache_' + USER_ID;

  // ---- фоновый Pumpkin ----
  const $hiddenCanvas = document.createElement('canvas');
  $hiddenCanvas.width = 512;
  $hiddenCanvas.height = 512;
  const pumpkin = new Pumpkin($hiddenCanvas);

  // ============================================================
  //  КЛАССЫ ИЗ ШАБЛОНОВ
  // ============================================================

  function extractContainerClass(inventoryTmpl) {
    const before = inventoryTmpl.substring(0, inventoryTmpl.indexOf('{{items}}'));
    const matches = [...before.matchAll(/<div[^>]*class="([^"]+)"/g)];
    if (!matches.length) return 'usr_pumps';
    return matches[matches.length - 1][1].split(/\s+/)[0];
  }
  function extractItemClass(itemTmpl) {
    const m = itemTmpl.match(/<div[^>]*class="([^"]+)"/);
    if (!m) return 'inv_pump';
    return m[1].split(/\s+/)[0];
  }
  const CONTAINER_CLASS = extractContainerClass(CFG.TEMPLATES.INVENTORY);
  const ITEM_CLASS      = extractItemClass(CFG.TEMPLATES.IMAGE_IN_INVENTORY);
  console.log('[pumpkin-quest] container:', CONTAINER_CLASS, '· item:', ITEM_CLASS);

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================

  function setStatus(text) { $status.html(text || ''); }
  function addError(text)  { $errors.append('<div>' + text + '</div>'); }
  function clearErrors()   { $errors.empty(); }
  function delay(ms)       { return new Promise(r => setTimeout(r, ms)); }

  function fmt(template, params) {
    let out = template;
    for (const k in params) out = out.replaceAll('{' + k + '}', String(params[k]));
    return out;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatAge(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return min + ' мин';
    const h = Math.floor(min / 60);
    return h + ' ч ' + (min % 60) + ' мин';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeHtmlEntities(str) {
    if (!str) return '';
    const ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value;
  }

  function htmlToText(html) {
    if (!html) return '';
    const decoded = decodeHtmlEntities(html);
    const tmp = document.createElement('div');
    tmp.innerHTML = decoded;
    tmp.querySelectorAll('script, style').forEach(n => n.remove());
    const text = tmp.textContent || tmp.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function parsePidFromLink(link) {
    const m = String(link || '').match(/#p(\d+)/);
    return m ? m[1] : null;
  }

  // ============================================================
  //  БЛОКИРОВКА UI
  // ============================================================

  let busy = false;

  function lockUI() {
    busy = true;
    $quest.find('button').prop('disabled', true);
  }

  function unlockUI() {
    busy = false;
    $quest.find('button').prop('disabled', false);
    // Кнопки, которые должны остаться отключёнными, — их нет,
    // потому что полученные строки используют <span>, а не <button>.
    // Но «Получить» в процессе не должно быть отключено здесь,
    // потому что кнопка в процессе сама себя восстанавливает
    // или заменяется на span.
  }

  // ============================================================
  //  API
  // ============================================================

  async function apiCall(method, params = {}) {
    const urlParams = new URLSearchParams({ method, ...params });
    const url = '/api.php?' + urlParams.toString();
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
    return await response.json();
  }

  async function apiCallWithRetry(method, params) {
    let lastErr = null;
    for (let i = 0; i < CFG.MAX_RETRIES; i++) {
      try {
        const r = await apiCall(method, params);
        await delay(CFG.API_DELAY);
        return r;
      } catch (e) {
        lastErr = e;
        if (i < CFG.MAX_RETRIES - 1) await delay(CFG.API_DELAY * 2);
      }
    }
    throw lastErr;
  }

  function responseArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.response)) return data.response;
    return [];
  }

  // ============================================================
  //  КЭШ (ТОЛЬКО СПИСОК ПОСТОВ, БЕЗ СТАТУСА ПОЛУЧЕНИЯ)
  // ============================================================

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.ts !== 'number' || !Array.isArray(obj.posts)) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  function writeCache(posts) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        posts: posts,
      }));
    } catch (e) {
      console.warn('[pumpkin-quest] cache write failed:', e);
    }
  }

  function clearCache() {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
  }

  // ============================================================
  //  ИНВЕНТАРЬ: ЧТЕНИЕ ПОЛУЧЕННЫХ PID
  // ============================================================

  async function findInventoryPost() {
    const data = await apiCallWithRetry('post.get', {
      topic_id: CFG.PUMPKINS_TOPIC,
      fields: 'id,user_id,message',
      limit: 100,
    });
    const posts = responseArray(data);
    const mine = posts.filter(p =>
      String(p.user_id) === USER_ID &&
      typeof p.message === 'string' &&
      p.message.indexOf('[html]') !== -1
    );
    return mine.length ? mine[mine.length - 1] : null;
  }

  function getInventoryHtmlBlock(message) {
    const start = message.indexOf('[html]');
    const end = message.indexOf('[/html]');
    if (start === -1 || end === -1) return '';
    return message.substring(start + 6, end);
  }

  function extractObtainedPids(htmlBlock) {
    const pids = new Set();
    if (!htmlBlock) return pids;
    try {
      const decoded = decodeHtmlEntities(htmlBlock);
      const doc = new DOMParser().parseFromString(decoded, 'text/html');
      const container = doc.querySelector('.' + CONTAINER_CLASS);
      if (!container) return pids;
      container.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const m = href.match(/#p(\d+)/);
        if (m) pids.add(m[1]);
      });
    } catch (e) {
      console.warn('[pumpkin-quest] extractObtainedPids error:', e);
    }
    return pids;
  }

  async function loadObtainedPids() {
    const post = await findInventoryPost();
    if (!post) return new Set();
    const block = getInventoryHtmlBlock(post.message);
    return extractObtainedPids(block);
  }

  function extractExistingItemsHtml(htmlBlock) {
    if (!htmlBlock) return '';
    try {
      const decoded = decodeHtmlEntities(htmlBlock);
      const doc = new DOMParser().parseFromString(decoded, 'text/html');
      const container = doc.querySelector('.' + CONTAINER_CLASS);
      if (!container) return '';
      let html = '';
      container.querySelectorAll('.' + ITEM_CLASS).forEach(item => {
        html += item.outerHTML;
      });
      return html;
    } catch (e) {
      console.warn('[pumpkin-quest] extractExistingItemsHtml error:', e);
      return '';
    }
  }

  // ============================================================
  //  ИНВЕНТАРЬ: ЗАПИСЬ
  // ============================================================

  function buildInventoryMessage(allItemsHtml) {
    const currentTime = new Date().toLocaleString();
    const uniq = Date.now().toString(36) + Math.random().toString(36).substring(2);
    return CFG.TEMPLATES.INVENTORY
      .replaceAll('{{uniq}}', uniq)
      .replace('{{items}}', allItemsHtml)
      .replace('{{currentTime}}', currentTime);
  }

  function buildItemHtml(imageUrl, pid, name) {
    return CFG.TEMPLATES.IMAGE_IN_INVENTORY
      .replace(/{{src}}/g, imageUrl)
      .replace(/{{pid}}/g, pid)
      .replace(/{{name}}/g, escapeHtml(name));
  }

  // ---------- iframe submit ----------

  function submitViaIframe(url, formSelector, fields, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '1024px';
      iframe.style.height = '768px';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      let stage = 0;
      let finished = false;

      const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { iframe.remove(); } catch (e) {}
      };

      const fail = (msg) => { cleanup(); reject(new Error(msg)); };
      const ok   = () => { cleanup(); resolve(true); };

      const timer = setTimeout(() => fail(MSG.errTimeout), timeoutMs);

      iframe.addEventListener('load', () => {
        if (finished) return;

        if (stage === 0) {
          let doc = null;
          try {
            doc = iframe.contentDocument || iframe.contentWindow.document;
          } catch (e) {
            fail(MSG.errIframeAccess + ' ' + e.message);
            return;
          }
          if (!doc) { fail(MSG.errIframeAccess); return; }

          const form = doc.querySelector(formSelector);
          if (!form) { fail(MSG.errFormNotFound + ' (' + formSelector + ')'); return; }

          for (const name in fields) {
            const el = form.querySelector('[name="' + name + '"]');
            if (el) el.value = fields[name];
          }

          const submitBtn =
            form.querySelector('input[type="submit"][name="submit"]') ||
            form.querySelector('input[type="submit"]') ||
            form.querySelector('button[type="submit"]') ||
            form.querySelector('input[name="submit"]');

          if (!submitBtn) { fail(MSG.errFormNotFound); return; }

          stage = 1;
          setTimeout(() => {
            try { submitBtn.click(); }
            catch (e) { fail('submit: ' + e.message); }
          }, 50);

        } else if (stage === 1) {
          ok();
        }
      });

      iframe.src = url;
    });
  }

  async function detectMessageFieldName(url, formSelector) {
    const html = await new Promise((resolve, reject) => {
      $.ajax({
        url: url,
        method: 'GET',
        success: resolve,
        error: (jqXHR, textStatus) => reject(new Error(textStatus)),
      });
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const form = doc.querySelector(formSelector);
    if (!form) throw new Error(MSG.errFormNotFound + ' (' + formSelector + ')');
    const names = [...form.querySelectorAll('[name]')].map(el => el.name);
    if (names.includes('req_message')) return 'req_message';
    const msgName = names.find(n => /message/i.test(n));
    if (msgName) return msgName;
    throw new Error(MSG.errFormNotFound);
  }

  async function appendPumpkinToInventory(imageUrl, pid, name) {
    const existingPost = await findInventoryPost();
    const newItemHtml = buildItemHtml(imageUrl, pid, name);

    if (existingPost) {
      const block = getInventoryHtmlBlock(existingPost.message);
      const existingItems = extractExistingItemsHtml(block);
      const newMessage = buildInventoryMessage(existingItems + newItemHtml);

      const url = '/edit.php?id=' + existingPost.id;
      const fieldName = await detectMessageFieldName(url, '#post');
      const fields = {};
      fields[fieldName] = newMessage;

      await submitViaIframe(url, '#post', fields, 20000);
      return existingPost.id;
    }

    const newMessage = buildInventoryMessage(newItemHtml);
    const url = '/viewtopic.php?id=' + CFG.PUMPKINS_TOPIC;
    const formSelector = '#post, form[action*="posting.php"]';
    const fieldName = await detectMessageFieldName(url, formSelector);
    const fields = {};
    fields[fieldName] = newMessage;
    await submitViaIframe(url, formSelector, fields, 20000);
    return null;
  }

  // ============================================================
  //  IMGBB
  // ============================================================

  async function uploadToImgbb(dataURL, name) {
    const base64 = dataURL.split(',')[1];
    const form = new FormData();
    form.append('key', CFG.IMGBB_API_KEY);
    form.append('image', base64);
    form.append('name', name);

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      const msg = (json && json.error && json.error.message) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return json.data.image && json.data.image.url || json.data.url;
  }

  // ============================================================
  //  ГЕНЕРАЦИЯ ТЫКВЫ
  // ============================================================

  async function generateAndUploadPumpkin(post) {
    const analysis = PumpkinCore.analyzeText(post.text);
    const params = PumpkinCore.computeParams(analysis);

    const forPumpkin = { ...params };
    delete forPumpkin.exportHeight;
    delete forPumpkin._emotion;

    pumpkin.setParams(forPumpkin);

    const result = pumpkin.exportWithHeight(params.exportHeight, {
      format: 'webp',
      quality: 1.0,
      renderSize: PumpkinCore.RENDER_SIZE,
    });

    const fileName = USER_ID + '_' + post.postId;
    return await uploadToImgbb(result.dataURL, fileName);
  }

  // ============================================================
  //  СБОР ПОСТОВ
  // ============================================================

  async function fetchTopics() {
    const forumIds = CFG.GAME_FORUMS.join(',');
    const all = [];
    let skip = 0;
    const limit = 100;

    while (skip <= 1000) {
      const data = await apiCallWithRetry('topic.get', {
        forum_id: forumIds,
        sort_by: 'last_post',
        sort_dir: 'desc',
        skip: skip,
        limit: limit,
        fields: 'id,subject,last_post_date,forum_id,init_post',
      });
      const topics = responseArray(data);
      if (!topics.length) break;

      let stop = false;
      for (const t of topics) {
        const lastTs = parseInt(t.last_post_date, 10) * 1000;
        if (lastTs < START_TS) { stop = true; break; }
        all.push(t);
      }
      if (stop || topics.length < limit) break;
      skip += limit;
    }
    return all;
  }

  async function fetchPostsForTopic(topic) {
    const out = [];
    let skip = 0;
    const limit = 100;

    while (skip <= 1000) {
      const data = await apiCallWithRetry('post.get', {
        topic_id: topic.id,
        sort_by: 'posted',
        sort_dir: 'desc',
        skip: skip,
        limit: limit,
        fields: 'id,user_id,username,posted,subject,message',
      });
      const posts = responseArray(data);
      if (!posts.length) break;

      let stop = false;
      for (const p of posts) {
        const ts = parseInt(p.posted, 10) * 1000;
        if (ts < START_TS) { stop = true; break; }
        if (String(p.user_id) !== USER_ID) continue;
        if (String(p.id) === String(topic.init_post)) continue;
        out.push({
          postId: String(p.id),
          topicId: topic.id,
          subject: topic.subject,
          posted: ts,
          text: htmlToText(p.message),
        });
      }
      if (stop || posts.length < limit) break;
      skip += limit;
    }
    return out;
  }

  async function collectPosts() {
    const topics = await fetchTopics();
    const out = [];
    for (const t of topics) {
      try {
        const posts = await fetchPostsForTopic(t);
        out.push(...posts);
      } catch (e) {
        addError(fmt(MSG.errTopic, { id: t.id, msg: e.message }));
      }
    }
    out.sort((a, b) => b.posted - a.posted);
    return out;
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ ТЫКВЫ
  // ============================================================

  async function obtainPumpkinForPost(post, obtainedPids) {
    if (obtainedPids.has(post.postId)) {
      setStatus(MSG.statusAlreadyGot);
      return false;
    }

    try {
      setStatus(MSG.statusGetting);
      const imageUrl = await generateAndUploadPumpkin(post);

      const pumpkinName = fmt(MSG.pumpkinTitle, { subject: post.subject || ('#' + post.postId) });
      await appendPumpkinToInventory(imageUrl, post.postId, pumpkinName);

      obtainedPids.add(post.postId);

      renderPreview(imageUrl);
      setStatus(MSG.statusGot);
      return true;
    } catch (e) {
      console.error('[pumpkin-quest] obtain failed:', e);
      addError(fmt(MSG.errGet, { msg: e.message }));
      setStatus('');
      return false;
    }
  }

  // ============================================================
  //  ПРЕВЬЮ
  // ============================================================

  function renderPreview(imageUrl) {
    $previewW.empty();
    $previewW.append(
      $('<img>')
        .attr('src', imageUrl)
        .attr('alt', 'Тыква')
        .attr('width', CFG.PREVIEW_SIZE)
        .attr('height', CFG.PREVIEW_SIZE)
        .css({ display: 'block', margin: '0 auto' })
    );
    $collLink.attr('href', '/viewtopic.php?id=' + CFG.PUMPKINS_TOPIC);
    $collLink.text(MSG.collectionLink);
    $preview.show();
  }

  // ============================================================
  //  ТАБЛИЦА
  // ============================================================

  function renderDiscoverTable(posts, obtainedPids) {
    $tbody.empty();
    $table.find('thead th').each(function (i) {
      const t = [MSG.colNum, MSG.colEpisode, MSG.colDate, MSG.colAction][i];
      $(this).text(t || '');
    });

    if (!posts.length) {
      $discoverBlock.show();
      setStatus(MSG.statusNothingNew);
      return;
    }

    posts.forEach((p, idx) => {
      const url = '/viewtopic.php?pid=' + p.postId + '#p' + p.postId;
      const alreadyGot = obtainedPids.has(p.postId);

      const $row = $('<tr>').attr('data-pid', p.postId);
      $row.append($('<td>').text(idx + 1));
      $row.append(
        $('<td>').append(
          $('<a>').attr('href', url).text(p.subject || ('#' + p.postId))
        )
      );
      $row.append($('<td>').text(formatDate(p.posted)));

      const $action = $('<td>');
      if (alreadyGot) {
        $action.append($('<span>').text(MSG.alreadyGot).css('color', '#3a3'));
      } else {
        const $btn = $('<button>').attr('type', 'button').text(MSG.btnGetPumpkin);
        $btn.on('click', async () => {
          if (busy) return;
          lockUI();
          $btn.text('...');
          try {
            const ok = await obtainPumpkinForPost(p, obtainedPids);
            if (ok) {
              $btn.replaceWith($('<span>').text(MSG.alreadyGot).css('color', '#3a3'));
            } else {
              $btn.text(MSG.btnGetPumpkin);
            }
          } finally {
            unlockUI();
          }
        });
        $action.append($btn);
      }
      $row.append($action);
      $tbody.append($row);
    });

    $discoverBlock.show();
    const total = posts.length;
    const got = posts.filter(p => obtainedPids.has(p.postId)).length;
    setStatus(fmt(MSG.statusDetected, { n: total, m: got }));
  }

  /**
   * Обновляет одну строку таблицы по pid — помечает её как полученную.
   */
  function markRowAsObtained(pid) {
    const $row = $tbody.find('tr[data-pid="' + pid + '"]');
    if (!$row.length) return;
    const $action = $row.children('td').last();
    $action.empty().append($('<span>').text(MSG.alreadyGot).css('color', '#3a3'));
  }

  // ============================================================
  //  «ОБНАРУЖИТЬ ВСЕ»
  // ============================================================

  async function onDiscoverAll() {
    if (busy) return;
    clearErrors();
    lockUI();

    setStatus(fmt(MSG.statusCollecting, { date: CFG.START_DATE }));

    try {
      // ВСЕГДА читаем инвентарь — источник правды
      const obtainedPids = await loadObtainedPids();

      const cache = readCache();
      const now = Date.now();

      if (cache && (now - cache.ts) < CFG.CACHE_TTL_MS) {
        // Свежий кэш — берём только список постов, статус — из инвентаря
        renderDiscoverTable(cache.posts, obtainedPids);
        $cacheWarning
          .text(fmt(MSG.statusCacheFresh, { age: formatAge(now - cache.ts) }))
          .show();
        return;
      }

      // Кэша нет или он старый — собираем заново
      const posts = await collectPosts();
      writeCache(posts);
      renderDiscoverTable(posts, obtainedPids);
      $cacheWarning.text(MSG.statusFresh).show();

    } catch (e) {
      console.error('[pumpkin-quest] discover failed:', e);
      setStatus('');
      addError(fmt(MSG.errLoad, { msg: e.message }));
    } finally {
      unlockUI();
    }
  }

  // ============================================================
  //  «ПРИНЕСТИ ССЫЛКУ»
  // ============================================================

  function showLinkBlock() {
    $linkBlock.show();
    $linkInput.val('').attr('placeholder', MSG.linkPlaceholder).focus();
  }

  function hideLinkBlock() {
    $linkBlock.hide();
    $linkInput.val('');
  }

  async function onBringLink() {
    if (busy) return;
    clearErrors();

    const link = $linkInput.val();
    const pid = parsePidFromLink(link);
    if (!pid) {
      addError(MSG.errLinkNoPid);
      return;
    }

    lockUI();
    setStatus(MSG.statusLoadingPost);

    try {
      // ВСЕГДА читаем инвентарь — источник правды
      const obtainedPids = await loadObtainedPids();
      if (obtainedPids.has(pid)) {
        setStatus(MSG.statusAlreadyGot);
        hideLinkBlock();
        return;
      }

      const data = await apiCallWithRetry('post.get', {
        post_id: pid,
        fields: 'id,user_id,posted,forum_id,subject,message',
        limit: 1,
      });
      const arr = responseArray(data);
      const p = arr[0];
      if (!p) { addError(MSG.errPostNotFound); setStatus(''); return; }

      if (String(p.user_id) !== USER_ID) { addError(MSG.errAuthorNotYou); setStatus(''); return; }
      const ts = parseInt(p.posted, 10) * 1000;
      if (ts < START_TS) { addError(fmt(MSG.errTooOld, { date: CFG.START_DATE })); setStatus(''); return; }
      if (!CFG.GAME_FORUMS.includes(parseInt(p.forum_id, 10))) {
        addError(MSG.errForumNotAllowed); setStatus(''); return;
      }

      // subject: пытаемся взять из кэша обнаружений, если там есть
      let subject = p.subject || '';
      if (!subject) {
        const c = readCache();
        if (c && Array.isArray(c.posts)) {
          const found = c.posts.find(x => String(x.postId) === String(pid));
          if (found) subject = found.subject;
        }
      }

      const post = {
        postId: String(pid),
        subject: subject,
        posted: ts,
        text: htmlToText(p.message),
      };

      const ok = await obtainPumpkinForPost(post, obtainedPids);
      if (ok) {
        hideLinkBlock();
        markRowAsObtained(pid);
      }
    } catch (e) {
      console.error('[pumpkin-quest] bring link failed:', e);
      addError(fmt(MSG.errGet, { msg: e.message }));
      setStatus('');
    } finally {
      unlockUI();
    }
  }

  // ============================================================
  //  ИНИЦИАЛИЗАЦИЯ UI
  // ============================================================

  function initUI() {
    $btnBringLink.text(MSG.btnBringLink);
    $btnDiscover.text(fmt(MSG.btnDiscover, { date: CFG.START_DATE }));
    $btnGetThis.text(MSG.btnGetThis);
    $btnCancel.text(MSG.btnCancel);
    $linkInput.attr('placeholder', MSG.linkPlaceholder);
    $collLink.text(MSG.collectionLink);

    $btnBringLink.on('click', () => {
      if ($linkBlock.is(':visible')) hideLinkBlock();
      else showLinkBlock();
    });

    $btnDiscover.on('click', onDiscoverAll);
    $btnGetThis.on('click', onBringLink);
    $btnCancel.on('click', hideLinkBlock);

    $linkInput.on('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onBringLink(); }
    });

    setStatus('');
  }

  $(function () {
    initUI();
  });

})();