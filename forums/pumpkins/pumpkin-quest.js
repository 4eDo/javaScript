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
 *
 *  Работа с инвентарём — через iframe с реальной формой форума
 *  (имитация пользователя: GET страницы, клик submit).
 * ============================================================ */

(function () {
  'use strict';

  // Если мы внутри iframe (нас запустил родитель для submit'а) —
  // ничего не делаем. Родитель сам взаимодействует с contentDocument.
  if (window.self !== window.top) {
    return;
  }

  // ---- конфиг ----
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

  if (typeof UserID === 'undefined' || !UserID) {
    console.error('[pumpkin-quest] UserID не найден');
    return;
  }

  const USER_ID  = String(UserID);
  const BASE_URL = window.location.origin + '/api.php';
  const START_TS = new Date(CFG.START_DATE + 'T00:00:00').getTime();

  // ---- фоновый Pumpkin без видимого canvas ----
  const $hiddenCanvas = document.createElement('canvas');
  $hiddenCanvas.width = 512;
  $hiddenCanvas.height = 512;
  const pumpkin = new Pumpkin($hiddenCanvas);

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================

  function setStatus(text) { $status.text(text); }
  function addError(text)  { $errors.append('<div>' + text + '</div>'); }
  function clearErrors()   { $errors.empty(); }
  function delay(ms)       { return new Promise(r => setTimeout(r, ms)); }

  function formatDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function htmlToText(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('script, style').forEach(n => n.remove());
    const text = tmp.textContent || tmp.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // ============================================================
  //  API
  // ============================================================

  const POST_METHODS = new Set([
    'storage.set',
    'storage.delete',
    'storage.flush',
  ]);

  function apiCall(method, params) {
    const query = $.param(params || {});

    if (POST_METHODS.has(method)) {
      return new Promise((resolve, reject) => {
        $.ajax({
          url: BASE_URL + '?method=' + method + '&format=json',
          method: 'POST',
          data: params || {},
          dataType: 'json',
          success: resolve,
          error: (jqXHR, textStatus) => {
            reject(new Error(textStatus || ('HTTP ' + (jqXHR && jqXHR.status))));
          },
        });
      });
    }

    return new Promise((resolve, reject) => {
      $.getJSON(BASE_URL + '?method=' + method + '&format=json&' + query)
        .done(resolve)
        .fail((jqXHR, textStatus) => {
          reject(new Error(textStatus || ('HTTP ' + (jqXHR && jqXHR.status))));
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
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.response)) return data.response;
    return [];
  }

  // ============================================================
  //  STORAGE
  // ============================================================

  async function getObtainedKeys() {
    try {
      const res = await apiCallWithRetry('storage.keys', {});
      const raw = (res && res.response && res.response.storage && res.response.storage.keys)
               || (res && res.response && res.response.keys)
               || (res && res.keys)
               || [];
      const prefix = 'pumpkin_' + USER_ID + '_';
      const set = new Set();
      for (const k of raw) {
        if (typeof k === 'string' && k.startsWith(prefix)) set.add(k);
      }
      return set;
    } catch (e) {
      console.warn('[pumpkin-quest] storage.keys failed:', e);
      return new Set();
    }
  }

  async function markObtained(postId) {
    const key = 'pumpkin_' + USER_ID + '_' + postId;
    return await apiCallWithRetry('storage.set', {
      key: key,
      value: new Date().toISOString(),
      timer: CFG.STORAGE_TTL_MINUTES,
    });
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
  //  ИНВЕНТАРЬ ЧЕРЕЗ IFRAME
  // ============================================================

  // Ищет мой пост-инвентарь в PUMPKINS_TOPIC
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

  // ---------- iframe-based submit ----------

  /**
   * Открывает url в скрытом iframe, ждёт загрузку, находит форму,
   * подставляет значения полей, кликает submit, ждёт второй load,
   * удаляет iframe, резолвится true.
   *
   * @param {string} url
   * @param {string} formSelector
   * @param {object} fields — { name: value, ... }
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  function submitViaIframe(url, formSelector, fields, timeoutMs = 15000) {
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

      let stage = 0; // 0 = ждём первую загрузку, 1 = ждём загрузку после submit
      let finished = false;

      const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { iframe.remove(); } catch (e) {}
      };

      const fail = (msg) => { cleanup(); reject(new Error(msg)); };
      const ok   = () => { cleanup(); resolve(true); };

      const timer = setTimeout(() => fail('Таймаут ожидания ответа от ' + url), timeoutMs);

      iframe.addEventListener('load', () => {
        if (finished) return;

        if (stage === 0) {
          // Первая загрузка — ищем форму, подставляем значения
          let doc = null;
          try {
            doc = iframe.contentDocument || iframe.contentWindow.document;
          } catch (e) {
            fail('Нет доступа к содержимому iframe (X-Frame-Options?): ' + e.message);
            return;
          }
          if (!doc) {
            fail('iframe загрузился без документа');
            return;
          }

          const form = doc.querySelector(formSelector);
          if (!form) {
            fail('Форма "' + formSelector + '" не найдена на ' + url);
            return;
          }

          // Заполняем поля
          for (const name in fields) {
            const el = form.querySelector('[name="' + name + '"]');
            if (el) {
              el.value = fields[name];
            }
          }

          // Ищем кнопку submit
          const submitBtn =
            form.querySelector('input[type="submit"][name="submit"]') ||
            form.querySelector('input[type="submit"]') ||
            form.querySelector('button[type="submit"]') ||
            form.querySelector('input[name="submit"]');

          if (!submitBtn) {
            fail('Кнопка submit не найдена в форме "' + formSelector + '"');
            return;
          }

          stage = 1;
          // Небольшая пауза, чтобы браузер точно применил значения
          setTimeout(() => {
            try {
              submitBtn.click();
            } catch (e) {
              fail('Не удалось кликнуть submit: ' + e.message);
            }
          }, 50);

        } else if (stage === 1) {
          // Второй load — форма ушла, ответ пришёл.
          // Формально: считаем успехом. Если сервер вернул ошибку валидации,
          // его можно распарсить и показать в #pqErrors, но пока просто ОК.
          ok();
        }
      });

      iframe.src = url;
    });
  }

  /**
   * Редактирует существующий пост-инвентарь: открывает edit.php,
   * заменяет req_message, кликает submit.
   */
  async function editExistingInventoryPost(postId, imageUrl, itemName) {
    // Сначала GET-ом подтянем содержимое поста, чтобы не зависеть от iframe'а
    // в части парсинга старого инвентаря. Так надёжнее.
    const data = await apiCallWithRetry('post.get', {
      post_id: postId,
      fields: 'id,message',
      limit: 1,
    });
    const arr = responseArray(data);
    const post = arr[0];
    if (!post || !post.message) {
      throw new Error('Не удалось прочитать старый пост инвентаря');
    }

    const existingItems = parseInventoryItems(post.message);
    const newItemHtml = buildItemHtml(imageUrl, itemName);
    const newMessage = buildInventoryMessage(existingItems + newItemHtml);

    // А теперь через iframe откроем edit.php и подставим в форму.
    // Поле сообщения у phpBB-подобных движков обычно req_message.
    // Если поле называется иначе — подберём по содержимому.
    const fieldName = await detectMessageFieldName('/edit.php?id=' + postId, '#post');
    const fields = {};
    fields[fieldName] = newMessage;

    const url = '/edit.php?id=' + postId;
    const okDone = await submitViaIframe(url, '#post', fields, 20000);
    if (!okDone) throw new Error('iframe-редактирование не завершилось');
    return postId;
  }

  /**
   * Создаёт новый пост-инвентарь: открывает viewtopic.php?id=PUMPKINS_TOPIC,
   * находит форму ответа, подставляет message, кликает submit.
   */
  async function createNewInventoryPost(imageUrl, itemName) {
    const newItemHtml = buildItemHtml(imageUrl, itemName);
    const newMessage = buildInventoryMessage(newItemHtml);

    const url = '/viewtopic.php?id=' + CFG.PUMPKINS_TOPIC;
    const formSelector = '#post, form[action*="posting.php"]';

    // Определяем имя поля сообщения в форме ответа
    const fieldName = await detectMessageFieldName(url, formSelector);

    const fields = {};
    fields[fieldName] = newMessage;

    // Иногда форме нужен topic id в скрытых полях. Обычно он уже есть
    // в форме как name="t" или name="id", но на всякий случай подставим,
    // если поля нет — submit всё равно уйдёт с тем, что есть.
    // Мы не знаем точно, есть ли они, поэтому не форсируем.

    const okDone = await submitViaIframe(url, formSelector, fields, 20000);
    if (!okDone) throw new Error('iframe-создание поста не завершилось');
    return null;
  }

  /**
   * Загружает страницу через fetch, находит форму и определяет имя
   * поля сообщения. Возвращает имя поля.
   */
  async function detectMessageFieldName(url, formSelector) {
    const html = await new Promise((resolve, reject) => {
      $.ajax({
        url: url,
        method: 'GET',
        success: resolve,
        error: (jqXHR, textStatus) => reject(new Error('Ошибка загрузки ' + url + ': ' + textStatus)),
      });
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const form = doc.querySelector(formSelector);
    if (!form) throw new Error('Форма "' + formSelector + '" не найдена на ' + url);

    const names = [...form.querySelectorAll('[name]')].map(el => el.name);
    // Приоритет: req_message, потом что-то с message
    if (names.includes('req_message')) return 'req_message';
    const msgName = names.find(n => /message/i.test(n));
    if (msgName) return msgName;
    throw new Error('В форме нет поля для сообщения');
  }

  async function appendToInventory(imageUrl, itemName) {
    const existing = await findInventoryPost();
    if (existing) {
      return await editExistingInventoryPost(existing.id, imageUrl, itemName);
    }
    return await createNewInventoryPost(imageUrl, itemName);
  }

  // ============================================================
  //  UI
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
      $btn.on('click', () => onGetPumpkin(p, $btn));
      $action.append($btn);
      $row.append($action);

      $tbody.append($row);
    });

    $table.show();
    setStatus('');
  }

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
    $preview.show();
  }

  // ============================================================
  //  ГЛАВНОЕ ДЕЙСТВИЕ
  // ============================================================

  async function onGetPumpkin(post, $btn) {
    $btn.prop('disabled', true).text('...');

    try {
      // 1. Параметры тыквы из текста поста
      const analysis = PumpkinCore.analyzeText(post.text);
      const params = PumpkinCore.computeParams(analysis);

      const forPumpkin = { ...params };
      delete forPumpkin.exportHeight;
      delete forPumpkin._emotion;

      pumpkin.setParams(forPumpkin);

      // 2. Рендер в data URL
      const result = pumpkin.exportWithHeight(params.exportHeight, {
        format: 'webp',
        quality: 1.0,
        renderSize: PumpkinCore.RENDER_SIZE,
      });

      // 3. Загрузка на imgbb
      const fileName = USER_ID + '_' + post.postId;
      const imageUrl = await uploadToImgbb(result.dataURL, fileName);

      // 4. Инвентарь — через iframe с реальной формой форума
      await appendToInventory(imageUrl, 'Тыква эпизода');

      // 5. Отметка в Storage
      await markObtained(post.postId);

      // 6. Превью + кнопка
      renderPreview(imageUrl);
      $btn.replaceWith($('<span>').text('✓ Получена').css('color', '#3a3'));
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
      const obtained = await getObtainedKeys();
      const posts = await collectPosts();

      const prefix = 'pumpkin_' + USER_ID + '_';
      const fresh = posts.filter(p => !obtained.has(prefix + p.postId));

      renderTable(fresh);
    } catch (e) {
      console.error('[pumpkin-quest] init failed:', e);
      setStatus('Ошибка загрузки');
      addError('Не удалось загрузить список: ' + e.message);
    }
  }

  $(function () { init(); });

})();