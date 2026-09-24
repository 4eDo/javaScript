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

  // ---- конфиг и его валидация ----
  const CFG = window.PUMPKIN_QUEST_CONFIG;
  if (!CFG) {
    console.error('[pumpkin-quest] Конфиг PUMPKIN_QUEST_CONFIG не найден');
    return;
  }

  // ---- DOM ----
  const $status    = $('#pqStatus');
  const $errors    = $('#pqErrors');
  const $table     = $('#pqTable');
  const $tbody     = $('#pqTableBody');
  const $preview   = $('#pqPreviewBlock');
  const $previewW  = $('#pqPreviewWrap');
  const $collLink  = $('#pqCollectionLink');

  // ---- базовые проверки ----
  if (typeof UserID === 'undefined' || !UserID) {
    console.error('[pumpkin-quest] UserID не найден');
    return;
  }

  const USER_ID = String(UserID);
  const BASE_URL = window.location.origin + '/api.php?method=';
  const START_TS = new Date(CFG.START_DATE + 'T00:00:00').getTime();

  // ---- фоновый Pumpkin без видимого canvas ----
  const $hiddenCanvas = document.createElement('canvas');
  $hiddenCanvas.width = 512;
  $hiddenCanvas.height = 512;
  const pumpkin = new Pumpkin($hiddenCanvas);

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================

  function setStatus(text) {
    $status.text(text);
  }

  function addError(text) {
    $errors.append('<div>' + text + '</div>');
  }

  function clearErrors() {
    $errors.empty();
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function apiCall(method, params) {
    const url = BASE_URL + method + '&format=json&' + $.param(params || {});
    return new Promise((resolve, reject) => {
      $.getJSON(url)
        .done(resolve)
        .fail((jqXHR, textStatus) => {
          reject(new Error(textStatus || 'HTTP ' + (jqXHR && jqXHR.status)));
        });
    });
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
    // API отдаёт либо { response: [...] }, либо сразу [...]
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.response)) return data.response;
    return [];
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // HTML → чистый текст
  function htmlToText(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // уберём script/style на всякий случай
    tmp.querySelectorAll('script, style').forEach(n => n.remove());
    const text = tmp.textContent || tmp.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // ============================================================
  //  STORAGE: КЛЮЧИ УЖЕ ПОЛУЧЕННЫХ ТЫКВ
  // ============================================================

  async function getObtainedKeys() {
    try {
      const res = await apiCallWithRetry('storage.keys', {});
      // Ожидаем { response: { storage: { keys: [...] } } } или похожее
      const raw = res?.response?.storage?.keys
        || res?.response?.keys
        || res?.keys
        || [];
      const prefix = 'pumpkin_' + USER_ID + '_';
      const set = new Set();
      for (const k of raw) {
        if (typeof k === 'string' && k.startsWith(prefix)) set.add(k);
      }
      return set;
    } catch (e) {
      // Если storage.keys не сработал — не падаем, работаем без отметок
      console.warn('[pumpkin-quest] storage.keys failed:', e);
      return new Set();
    }
  }

  async function markObtained(postId) {
    const key = 'pumpkin_' + USER_ID + '_' + postId;
    try {
      await apiCallWithRetry('storage.set', {
        key: key,
        value: new Date().toISOString(),
        timer: CFG.STORAGE_TTL_MINUTES,
      });
    } catch (e) {
      addError('Не удалось сохранить отметку о получении тыквы: ' + e.message);
    }
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
          postId: p.id,
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
        addError('Ошибка при обработке темы ' + t.id + ': ' + e.message);
      }
    }
    // сортировка по дате: свежие сверху
    out.sort((a, b) => b.posted - a.posted);
    return out;
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
  //  ИНВЕНТАРЬ
  // ============================================================

  async function findInventoryPost() {
    try {
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
    } catch (e) {
      console.warn('[pumpkin-quest] findInventoryPost failed:', e);
      return null;
    }
  }

  function extractExistingItems(htmlContent) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const usrInv = doc.querySelector('.usr_inv');
      if (!usrInv) return '';
      let html = '';
      usrInv.querySelectorAll('.inv_item').forEach(item => {
        html += item.outerHTML;
      });
      return html;
    } catch (e) {
      return '';
    }
  }

  function parseInventoryItems(message) {
    const start = message.indexOf('[html]');
    const end = message.indexOf('[/html]');
    if (start === -1 || end === -1) return '';
    const inner = message.substring(start + 6, end);
    return extractExistingItems(inner);
  }

  function buildInventoryMessage(allItemsHtml) {
    const currentTime = new Date().toLocaleString();
    const uniq = Date.now().toString(36) + Math.random().toString(36).substring(2);
    return CFG.TEMPLATES.INVENTORY
      .replaceAll('{{uniq}}', uniq)
      .replace('{{items}}', allItemsHtml)
      .replace('{{currentTime}}', currentTime);
  }

  function buildItemHtml(imageUrl, name) {
    return CFG.TEMPLATES.IMAGE_IN_INVENTORY
      .replace(/{{src}}/g, imageUrl)
      .replace(/{{name}}/g, name);
  }

  // Получение формы edit.php и отправка
  async function getFormObjectFromPage(url, formId) {
    const html = await new Promise((resolve, reject) => {
      $.ajax({
        url: url,
        method: 'GET',
        success: resolve,
        error: (jqXHR, textStatus) => reject(new Error(textStatus)),
      });
    });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const form = doc.querySelector(formId);
    if (!form) throw new Error('Форма ' + formId + ' не найдена на ' + url);
    const data = {};
    const formData = new FormData(form);
    for (const [k, v] of formData.entries()) data[k] = v;
    return data;
  }

  async function sendForm(url, data) {
    const $fake = $('<form>');
    for (const k in data) {
      $fake.append($('<input>').attr({ type: 'hidden', name: k, value: data[k] }));
    }
    const body = $fake.serialize();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    });
    return res.ok;
  }

  async function appendToInventory(imageUrl, name) {
    const existing = await findInventoryPost();

    if (existing) {
      const editUrl = '/edit.php?id=' + existing.id;
      const formData = await getFormObjectFromPage(editUrl, '#post');
      const key = 'req_message';
      const oldMsg = formData[key] || '';
      const existingItems = parseInventoryItems(oldMsg);
      const newItemHtml = buildItemHtml(imageUrl, name);
      const allItems = existingItems + newItemHtml;
      formData[key] = buildInventoryMessage(allItems);
      const ok = await sendForm(editUrl, formData);
      if (!ok) throw new Error('Не удалось отредактировать пост инвентаря');
      return existing.id;
    } else {
      // создаём новый пост
      // идём на viewtopic.php?id=PUMPKINS_TOPIC, берём форму ответа
      const topicUrl = '/viewtopic.php?id=' + CFG.PUMPKINS_TOPIC;
      const html = await new Promise((resolve, reject) => {
        $.ajax({
          url: topicUrl,
          method: 'GET',
          success: resolve,
          error: (jqXHR, textStatus) => reject(new Error(textStatus)),
        });
      });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const form = doc.querySelector('#post, form[action*="posting.php"]');
      if (!form) throw new Error('Форма ответа в топике инвентаря не найдена');

      const data = {};
      const fd = new FormData(form);
      for (const [k, v] of fd.entries()) data[k] = v;

      // имя поля сообщения у форума обычно req_message
      const msgKey = ('req_message' in data) ? 'req_message' : Object.keys(data).find(k => /message/i.test(k));
      if (!msgKey) throw new Error('Не найдено поле сообщения в форме ответа');

      const newItemHtml = buildItemHtml(imageUrl, name);
      data[msgKey] = buildInventoryMessage(newItemHtml);

      const action = form.getAttribute('action') || '/posting.php';
      const postUrl = new URL(action, window.location.origin).pathname +
                      '?id=' + CFG.PUMPKINS_TOPIC;
      const ok = await sendForm(postUrl, data);
      if (!ok) throw new Error('Не удалось создать пост инвентаря');
      return null; // id неизвестен без парсинга ответа
    }
  }

  // ============================================================
  //  UI: ТАБЛИЦА
  // ============================================================

  function renderTable(posts) {
    $tbody.empty();
    if (!posts.length) {
      $table.hide();
      setStatus('Новых постов нет.');
      return;
    }

    posts.forEach((p, idx) => {
      const url = '/viewtopic.php?pid=' + p.postId + '#p' + p.postId;
      const $row = $('<tr>');
      $row.append($('<td>').text(idx + 1));
      $row.append(
        $('<td>').append(
          $('<a>').attr('href', url).text(p.subject || ('Пост #' + p.postId))
        )
      );
      $row.append($('<td>').text(formatDate(p.posted)));

      const $action = $('<td>');
      const $btn = $('<button>').text('Получить тыкву').attr('type', 'button');
      $btn.on('click', () => onGetPumpkin(p, $btn, $action));
      $action.append($btn);
      $row.append($action);

      $tbody.append($row);
    });

    $table.show();
    setStatus('');
  }

  function renderPreview(imageUrl, postId) {
    $previewW.empty();
    $previewW.append(
      $('<img>')
        .attr('src', imageUrl)
        .attr('alt', 'Тыква')
        .attr('width', CFG.PREVIEW_SIZE)
        .attr('height', CFG.PREVIEW_SIZE)
        .css({ display: 'block', margin: '0 auto' })
    );
    const topicUrl = '/viewtopic.php?id=' + CFG.PUMPKINS_TOPIC;
    $collLink.attr('href', topicUrl);
    $preview.show();
  }

  // ============================================================
  //  ГЛАВНОЕ ДЕЙСТВИЕ: ПОЛУЧИТЬ ТЫКВУ
  // ============================================================

  async function onGetPumpkin(post, $btn, $actionCell) {
    $btn.prop('disabled', true).text('...');

    try {
      // 1. Параметры тыквы из текста поста
      const analysis = PumpkinCore.analyzeText(post.text);
      const params = PumpkinCore.computeParams(analysis);

      const forPumpkin = { ...params };
      delete forPumpkin.exportHeight;
      delete forPumpkin._emotion;

      pumpkin.setParams(forPumpkin);

      // 2. Рендер и экспорт
      const result = pumpkin.exportWithHeight(params.exportHeight, {
        format: 'webp',
        quality: 1.0,
        renderSize: PumpkinCore.RENDER_SIZE,
      });

      // 3. Загрузка на imgbb
      const fileName = USER_ID + '_' + post.postId;
      const imageUrl = await uploadToImgbb(result.dataURL, fileName);

      // 4. Показываем превью
      renderPreview(imageUrl, post.postId);

      // 5. Добавляем в инвентарь
      await appendToInventory(imageUrl, 'Тыква эпизода');

      // 6. Отметка в Storage
      await markObtained(post.postId);

      // 7. Обновляем кнопку
      $btn.replaceWith($('<span>').text('✓ Получена').css('color', '#3a3'));
      $actionCell.css('vertical-align', 'middle');
    } catch (e) {
      console.error('[pumpkin-quest]', e);
      addError('Не удалось получить тыкву для поста ' + post.postId + ': ' + e.message);
      $btn.prop('disabled', false).text('Получить тыкву');
    }
  }

  // ============================================================
  //  СТАРТ
  // ============================================================

  async function init() {
    setStatus('Ищем новые посты...');
    clearErrors();

    try {
      // 1. Получаем список уже полученных
      const obtained = await getObtainedKeys();

      // 2. Собираем посты
      const posts = await collectPosts();

      // 3. Фильтруем уже полученные
      const prefix = 'pumpkin_' + USER_ID + '_';
      const fresh = posts.filter(p => !obtained.has(prefix + p.postId));

      // 4. Рисуем
      renderTable(fresh);
    } catch (e) {
      console.error('[pumpkin-quest] init failed:', e);
      setStatus('Ошибка загрузки');
      addError('Не удалось загрузить список: ' + e.message);
    }
  }

  $(function () {
    init();
  });

})();