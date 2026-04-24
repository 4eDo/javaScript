import { getItem, getRecipe, getAllRecipes } from './itemsDB.js';

// UI-состояние (только для отображения)
let selectedItemId = null;
let selectedSlotKey = null;
let pendingRecipe = null;

export function getSelectedItemId() { return selectedItemId; }
export function getSelectedSlotKey() { return selectedSlotKey; }
export function selectItem(id) { selectedItemId = id; selectedSlotKey = null; }
export function selectSlot(key) { selectedSlotKey = key; selectedItemId = null; }
export function clearSelection() { selectedItemId = null; selectedSlotKey = null; }
export function setPendingRecipe(r) { pendingRecipe = r; }
export function getPendingRecipe() { return pendingRecipe; }

// Ссылка на персонажа (устанавливается извне)
let character = null;
export function setCharacter(ch) { character = ch; }

// ========== РЕНДЕР ИНВЕНТАРЯ ==========
export function renderInventory() {
  const grid = document.getElementById('items');
  if (!grid) return;
  grid.innerHTML = '';

  const filterType = document.getElementById('filter-type')?.value || '';
  const filterLevel = document.getElementById('filter-level')?.value || '';
  const filterSlot = document.getElementById('filter-slot')?.value || '';

  const grouped = {};
  character.inventory.forEach(id => {
    const item = getItem(id);
    if (!item) return;
    if (filterType && !item.tags.includes(filterType)) return;
    if (filterLevel !== '' && item.level !== parseInt(filterLevel)) return;
    if (filterSlot && (!item.slots || !item.slots.includes(filterSlot))) return;

    if (!grouped[id]) grouped[id] = { item, count: 0 };
    grouped[id].count++;
  });

  Object.values(grouped).forEach(({ item, count }) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (item.img) {
      slot.classList.add('filled');
      slot.style.backgroundImage = `url(${item.img})`;
    }
    if (count > 1) slot.dataset.count = count;
    slot.dataset.id = item.id;

    if (selectedSlotKey && !selectedItemId) {
      const [slotName] = selectedSlotKey.split('-');
      if (item.slots?.includes(slotName)) slot.classList.add('highlight-inv');
    }

    if (selectedItemId === item.id) slot.classList.add('selected');

    slot.addEventListener('mouseenter', () => {
      if (selectedItemId && selectedItemId !== item.id && isInvItemsTabActive()) {
        showComparisonInfo(selectedItemId, item);
      } else {
        showItemInfo(item, 'info-right', 'itemTitleHover', 'propertiesHover');
      }
    });
    slot.addEventListener('mouseleave', () => hideInfoRight());
    grid.appendChild(slot);
  });
}

// ========== РЕНДЕР ЭКИПИРОВКИ ==========
export function renderEquipment() {
  const allSlots = document.querySelectorAll('#equip-view .slot');
  allSlots.forEach(el => {
    el.classList.remove('filled', 'selected', 'highlight-slot', 'twohanded-disabled', 'single-disabled');
    el.style.backgroundImage = '';
    el.style.pointerEvents = 'auto';
    el.style.opacity = '1';
  });

  // Заполняем надетые
  for (const [key, itemId] of Object.entries(character.equipment)) {
    const [slotName, index] = key.split('-');
    const item = getItem(itemId);
    if (!item) continue;
    const el = document.querySelector(`.slot[data-slot="${slotName}"][data-index="${index}"]`);
    if (el) {
      el.classList.add('filled');
      if (item.img) el.style.backgroundImage = `url(${item.img})`;
    }
  }

  // Блокировка двуручного
  if (character._isTwoHandedEquipped()) {
    const w0 = character.equipment['weapon-0'];
    if (selectedSlotKey?.startsWith('weapon-')) {
      // Разблокированы оба
    } else {
      const slot1 = document.querySelector('.slot[data-slot="weapon"][data-index="1"]');
      if (slot1) slot1.classList.add('twohanded-disabled');
    }
  }

  // Блокировка single
  const singleBySlot = _getSingleEquippedBySlot();
  for (const [slotName, itemIds] of Object.entries(singleBySlot)) {
    allSlots.forEach(el => {
      if (el.dataset.slot !== slotName) return;
      const key = `${slotName}-${el.dataset.index}`;
      if (character.equipment[key]) return; // занят — не блокируем
      let block = true;
      if (selectedSlotKey === key && !selectedItemId) block = false;
      if (selectedItemId && !itemIds.has(selectedItemId)) block = false;
      if (selectedItemId && itemIds.has(selectedItemId)) block = true;
      if (block) el.classList.add('single-disabled');
    });
  }

  // Подсветка выбранного слота
  if (selectedSlotKey && !selectedItemId) {
    const [sName, sIdx] = selectedSlotKey.split('-');
    const itemId = character.equipment[selectedSlotKey];
    if (sName === 'weapon' && itemId && getItem(itemId)?.isTwoHanded) {
      ['0', '1'].forEach(i => {
        const el = document.querySelector(`.slot[data-slot="weapon"][data-index="${i}"]`);
        if (el) { el.classList.add('selected'); el.style.pointerEvents = 'auto'; el.style.opacity = '1'; }
      });
    } else {
      const el = document.querySelector(`.slot[data-slot="${sName}"][data-index="${sIdx}"]`);
      if (el) { el.classList.add('selected'); el.style.pointerEvents = 'auto'; el.style.opacity = '1'; }
    }
  }

  // Подсветка слотов под выбранный предмет
  if (selectedItemId && !selectedSlotKey) {
    const item = getItem(selectedItemId);
    if (item?.slots) {
      allSlots.forEach(el => {
        if (!item.slots.includes(el.dataset.slot)) return;
        const key = `${el.dataset.slot}-${el.dataset.index}`;
        if (character.equipment[key]) {
          el.classList.add('highlight-slot');
        } else if (item.isSingle && singleBySlot[el.dataset.slot]?.has(selectedItemId)) {
          // заблокирован, не подсвечиваем
        } else {
          el.classList.add('highlight-slot');
        }
      });
    }
  }

  updateConsumableSlots();
}

function _getSingleEquippedBySlot() {
  const map = {};
  for (const [key, itemId] of Object.entries(character.equipment)) {
    if (!itemId) continue;
    const [slotName] = key.split('-');
    const item = getItem(itemId);
    if (item?.isSingle) {
      if (!map[slotName]) map[slotName] = new Set();
      map[slotName].add(itemId);
    }
  }
  return map;
}

function updateConsumableSlots() {
  const part = document.getElementById('consumable-part');
  if (!part) return;
  const capacity = character.getConsumableCapacity();
  if (capacity === 0) {
    part.style.display = 'none';
    return;
  }
  part.style.display = 'block';
  part.innerHTML = '';
  for (let i = 0; i < capacity; i++) {
    const key = `consumable-${i}`;
    const itemId = character.equipment[key];
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = 'consumable';
    slot.dataset.index = i;
    if (itemId) {
      const item = getItem(itemId);
      slot.classList.add('filled');
      if (item?.img) slot.style.backgroundImage = `url(${item.img})`;
    }
    if (selectedSlotKey === key && !selectedItemId) slot.classList.add('selected');
    if (selectedItemId && !selectedSlotKey && getItem(selectedItemId)?.slots?.includes('consumable')) {
      slot.classList.add('highlight-slot');
    }
    part.appendChild(slot);
  }
}

// ========== РЕНДЕР РЕЦЕПТОВ ==========
export function renderRecipes() {
  const grid = document.getElementById('engineering-recipes');
  if (!grid) return;
  grid.innerHTML = '';

  const filterType = document.getElementById('eng-filter-type')?.value || '';
  const filterLevel = document.getElementById('eng-filter-level')?.value || '';
  const filterSlot = document.getElementById('eng-filter-slot')?.value || '';
  const filterAvail = document.getElementById('eng-filter-available')?.value || '';

  getAllRecipes().forEach((recipe, idx) => {
    const item = getItem(recipe.result);
    if (!item) return;
    if (filterType && !item.tags.includes(filterType)) return;
    if (filterLevel !== '' && item.level !== parseInt(filterLevel)) return;
    if (filterSlot && (!item.slots || !item.slots.includes(filterSlot))) return;

    const can = canCraft(recipe);
    if (filterAvail === 'yes' && !can) return;
    if (filterAvail === 'no' && can) return;

    const slot = document.createElement('div');
    slot.className = 'slot';
    if (item.img) {
      slot.classList.add('filled');
      slot.style.backgroundImage = `url(${item.img})`;
    }
    slot.dataset.recipeIndex = idx;
    if (!can) slot.classList.add('unavailable');
    slot.addEventListener('mouseenter', () => showRecipeInfo(recipe));
    slot.addEventListener('mouseleave', () => hideInfoRight());
    grid.appendChild(slot);
  });

  // Кнопка создать
  let btn = document.getElementById('btn-create-item');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-create-item';
    btn.className = 'btn-full';
    btn.textContent = 'Создать';
    const eng = document.getElementById('inv-engineering');
    if (eng) eng.appendChild(btn);
  }
}

// ========== КРАФТ ==========
function canCraft(recipe) {
  return recipe.ingredients.every(ing => character.countAvailable(ing.id) >= ing.count);
}

export function getEquippedIngredients(recipe) {
  const list = [];
  for (const ing of recipe.ingredients) {
    let remaining = ing.count - character.inventory.filter(id => id === ing.id).length;
    if (remaining <= 0) continue;
    const counted = new Set();
    for (const [key, itemId] of Object.entries(character.equipment)) {
      if (itemId !== ing.id || remaining <= 0) continue;
      const [slotName] = key.split('-');
      if (slotName === 'consumable') continue;
      if (slotName === 'weapon' && getItem(itemId)?.isTwoHanded) {
        if (counted.has(itemId)) continue;
        counted.add(itemId);
      }
      list.push({ itemId: ing.id, slot: slotName, index: key.split('-')[1], key });
      remaining--;
    }
  }
  return list;
}

export function executeCraft(recipe) {
  for (const ing of recipe.ingredients) {
    let remaining = ing.count;
    while (remaining > 0 && character.hasItem(ing.id)) {
      character.removeItem(ing.id);
      remaining--;
    }
    if (remaining > 0) {
      const toRemove = [];
      const counted = new Set();
      for (const [key, itemId] of Object.entries(character.equipment)) {
        if (itemId !== ing.id || remaining <= 0) continue;
        const [slotName] = key.split('-');
        if (slotName === 'consumable') continue;
        if (slotName === 'weapon' && getItem(itemId)?.isTwoHanded) {
          if (counted.has(itemId)) continue;
          counted.add(itemId);
          toRemove.push('weapon-0', 'weapon-1');
        } else {
          toRemove.push(key);
        }
        remaining--;
      }
      toRemove.forEach(k => delete character.equipment[k]);
      if (toRemove.some(k => k.startsWith('belt-'))) {
        character._redistributeConsumables();
      }
    }
  }
  for (let i = 0; i < (recipe.count || 1); i++) {
    character.addItem(recipe.result);
  }
}

// ========== ИНФО-ПАНЕЛИ ==========
export function updateItemInfo() {
  document.getElementById('itemTitle').textContent = 'Выберите предмет';
  document.getElementById('properties').innerHTML = '';
  hideInfoRight();
  document.getElementById('btn-unequip-left').style.display = 'none';

  if (selectedItemId) {
    const item = getItem(selectedItemId);
    if (item) showItemInfo(item, 'info-left', 'itemTitle', 'properties');
  } else if (selectedSlotKey) {
    const [sName, sIdx] = selectedSlotKey.split('-');
    const item = character.getEquipped(selectedSlotKey);
    if (item) {
      showItemInfo(item, 'info-left', 'itemTitle', 'properties');
      const suffix = item.isTwoHanded ? ' (надето, двуручное)' : ' (надето)';
      document.getElementById('itemTitle').textContent = item.name + suffix;
      document.getElementById('btn-unequip-left').style.display = 'block';
    } else {
      document.getElementById('itemTitle').textContent = `Слот: ${sName} [${sIdx}] (пусто)`;
    }
  }
}

function showItemInfo(item, containerId, titleId, propsId) {
  document.getElementById(containerId).style.display = 'block';
  document.getElementById(titleId).textContent = item.name;
  const props = document.getElementById(propsId);
  props.innerHTML = '';
  addProp(props, 'Уровень', item.level, '');
  if (item.slots) addProp(props, 'Слоты', item.slots.join(', '), '');
  if (item.isTwoHanded) addProp(props, 'Особенность', 'Двуручное', '');
  if (item.properties) {
    for (const [k, v] of Object.entries(item.properties)) {
      addProp(props, k, v > 0 ? '+' + v : v, '');
    }
  }
}

function showComparisonInfo(selectedId, hoveredItem) {
  const selected = getItem(selectedId);
  if (!selected) return;
  document.getElementById('info-right').style.display = 'block';
  document.getElementById('itemTitleHover').textContent = hoveredItem.name;
  const props = document.getElementById('propertiesHover');
  props.innerHTML = '';

  addProp(props, 'Уровень', hoveredItem.level + _diffStr(selected.level, hoveredItem.level), _cmpClass(selected.level, hoveredItem.level));
  if (hoveredItem.slots) addProp(props, 'Слоты', hoveredItem.slots.join(', '), '');

  const allKeys = new Set([
    ...Object.keys(selected.properties || {}),
    ...Object.keys(hoveredItem.properties || {}),
  ]);
  allKeys.forEach(key => {
    const sv = selected.properties?.[key] || 0;
    const hv = hoveredItem.properties?.[key] || 0;
    const cls = _cmpClass(sv, hv);
    const diff = hv - sv;
    const sign = diff > 0 ? '+' : '';
    const val = (hv > 0 ? '+' : '') + hv + (diff !== 0 ? ` (${sign}${diff})` : '');
    addProp(props, key, val, cls);
  });
}

function showRecipeInfo(recipe) {
  const item = getItem(recipe.result);
  if (!item) return;
  document.getElementById('info-right').style.display = 'block';
  document.getElementById('itemTitleHover').textContent = item.name;
  const props = document.getElementById('propertiesHover');
  props.innerHTML = '';
  addProp(props, 'Уровень', item.level, '');
  if (item.slots) addProp(props, 'Слоты', item.slots.join(', '), '');

  const dt = document.createElement('dt');
  dt.textContent = 'Требуется:';
  dt.style.marginTop = '6px';
  props.appendChild(dt);

  recipe.ingredients.forEach(ing => {
    const ingItem = getItem(ing.id);
    const avail = character.countAvailable(ing.id);
    const dd = document.createElement('dd');
    dd.textContent = `${ingItem?.name || ing.id}: ${avail}/${ing.count}`;
    dd.style.color = avail >= ing.count ? '#008000' : '#800000';
    props.appendChild(dd);
  });
}

function hideInfoRight() {
  document.getElementById('info-right').style.display = 'none';
}

function addProp(container, key, value, className) {
  const dt = document.createElement('dt');
  dt.textContent = key;
  if (className) dt.className = className;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (className) dd.className = className;
  container.appendChild(dt);
  container.appendChild(dd);
}

function _cmpClass(a, b) {
  if (b > a) return 'prop-better';
  if (b < a) return 'prop-worse';
  return 'prop-equal';
}

function _diffStr(a, b) {
  const d = b - a;
  if (d === 0) return '';
  return ` (${d > 0 ? '+' : ''}${d})`;
}

// ========== ХАРАКТЕРИСТИКИ ==========
export function renderStats() {
  const s = character.getStats();
  document.getElementById('stat-str').textContent = s.STR;
  document.getElementById('stat-con').textContent = s.CON;
  document.getElementById('stat-agi').textContent = s.AGI;
  document.getElementById('stat-reg').textContent = s.REG;
  document.getElementById('stat-acc').textContent = s.ACC;
  document.getElementById('stat-hp').textContent = s.HP;
  document.getElementById('stat-dodge').textContent = s.dodge + '%';
  document.getElementById('stat-double').textContent = s.doubleAttack + '%';
  document.getElementById('stat-reduce').textContent = s.damageReduce + '%';
}

export function renderAll() {
  renderEquipment();
  renderInventory();
  renderRecipes();
  renderStats();
}

function isInvItemsTabActive() {
  const tab = document.querySelector('.inv-tab.active');
  return tab?.dataset.invtab === 'items';
}