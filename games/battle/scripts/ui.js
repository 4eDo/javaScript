import { getItemById, getRecipeByIndex, getAllRecipes } from './itemsDB.js';

// UI-состояние
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
    const item = getItemById(id);
    if (!item) return;
    
    if (filterType && (!item.tags || !item.tags.includes(filterType))) return;
    if (filterLevel !== '' && item.level !== parseInt(filterLevel)) return;
    if (filterSlot && (!item.slots || !item.slots.includes(filterSlot))) return;

    if (!grouped[id]) {
      grouped[id] = { item, count: 0 };
    }
    grouped[id].count++;
  });

  Object.values(grouped).forEach(({ item, count }) => {
    const slot = document.createElement('item-slot');
    slot.className = 'slot';
    if (item.img) {
      slot.classList.add('filled');
      slot.style.backgroundImage = `url(${item.img})`;
    }
    if (count > 1) {
      slot.dataset.count = count;
    }
    slot.dataset.id = item.id;

    if (selectedSlotKey && !selectedItemId) {
      const [slotName] = selectedSlotKey.split('-');
      if (item.slots && item.slots.includes(slotName)) {
        slot.classList.add('highlight-inv');
      }
    }

    if (selectedItemId === item.id) {
      slot.classList.add('selected');
    }

    slot.addEventListener('mouseenter', () => {
      if (selectedItemId && selectedItemId !== item.id && isInvItemsTabActive()) {
        showComparisonInfo(selectedItemId, item);
      } else {
        showItemInfo(item, 'info-right', 'itemTitleHover', 'propertiesHover');
      }
    });
    slot.addEventListener('mouseleave', () => {
      hideItemInfo('info-right');
    });

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

  for (const [key, itemId] of Object.entries(character.equipment)) {
    if (!itemId) continue;
    const [slotName, index] = key.split('-');
    const item = getItemById(itemId);
    if (!item) continue;

    const slotEl = document.querySelector(`.slot[data-slot="${slotName}"][data-index="${index}"]`);
    if (slotEl) {
      slotEl.classList.add('filled');
      if (item.img) {
        slotEl.style.backgroundImage = `url(${item.img})`;
      }
    }
  }

  const w0 = character.equipment['weapon-0'];
  const w1 = character.equipment['weapon-1'];
  const twoHandedEquipped = (w0 && w1 && w0 === w1 && getItemById(w0)?.tags?.includes('twoHanded'));

  if (twoHandedEquipped) {
    const slot0 = document.querySelector('.slot[data-slot="weapon"][data-index="0"]');
    const slot1 = document.querySelector('.slot[data-slot="weapon"][data-index="1"]');

    if (selectedSlotKey && selectedSlotKey.startsWith('weapon-')) {
      if (slot0) slot0.classList.remove('twohanded-disabled');
      if (slot1) slot1.classList.remove('twohanded-disabled');
    } else {
      if (w0 && !w1) {
        if (slot1) slot1.classList.add('twohanded-disabled');
      } else if (!w0 && w1) {
        if (slot0) slot0.classList.add('twohanded-disabled');
      } else if (w0 && w1 && w0 === w1) {
        if (slot1) slot1.classList.add('twohanded-disabled');
      }
    }
  }

  const singleBySlot = _getSingleEquippedBySlot();
  for (const [slotName, itemIds] of Object.entries(singleBySlot)) {
    allSlots.forEach(el => {
      if (el.dataset.slot !== slotName) return;
      const key = `${slotName}-${el.dataset.index}`;
      
      if (!character.equipment[key]) {
        let shouldBlock = true;
        
        if (selectedSlotKey === key && !selectedItemId) {
          shouldBlock = false;
        }
        
        if (selectedItemId && !itemIds.has(selectedItemId)) {
          shouldBlock = false;
        }
        
        if (selectedItemId && itemIds.has(selectedItemId)) {
          shouldBlock = true;
        }
        
        if (shouldBlock) {
          el.classList.add('single-disabled');
        }
      }
    });
  }

  if (selectedSlotKey && !selectedItemId) {
    const [sName, sIdx] = selectedSlotKey.split('-');
    const itemId = character.equipment[selectedSlotKey];
    
    if (sName === 'weapon' && itemId && getItemById(itemId)?.tags?.includes('twoHanded')) {
      ['0', '1'].forEach(i => {
        const el = document.querySelector(`.slot[data-slot="weapon"][data-index="${i}"]`);
        if (el) {
          el.classList.add('selected');
          el.classList.remove('twohanded-disabled', 'single-disabled');
          el.style.pointerEvents = 'auto';
          el.style.opacity = '1';
        }
      });
    } else {
      const el = document.querySelector(`.slot[data-slot="${sName}"][data-index="${sIdx}"]`);
      if (el) {
        el.classList.add('selected');
        el.classList.remove('twohanded-disabled', 'single-disabled');
        el.style.pointerEvents = 'auto';
        el.style.opacity = '1';
      }
    }
  }

  if (selectedItemId && !selectedSlotKey) {
    const item = getItemById(selectedItemId);
    if (item && item.slots) {
      allSlots.forEach(el => {
        if (!item.slots.includes(el.dataset.slot)) return;
        const key = `${el.dataset.slot}-${el.dataset.index}`;
        
        if (character.equipment[key]) {
          el.classList.add('highlight-slot');
        } else if (item.tags?.includes('single') && singleBySlot[el.dataset.slot]?.has(selectedItemId)) {
          // заблокирован single
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
    const item = getItemById(itemId);
    if (item?.tags?.includes('single')) {
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
  
  if (capacity > 0) {
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
        const item = getItemById(itemId);
        slot.classList.add('filled');
        if (item?.img) {
          slot.style.backgroundImage = `url(${item.img})`;
        }
      }
      
      if (selectedSlotKey === key && !selectedItemId) {
        slot.classList.add('selected');
      }
      
      if (selectedItemId && !selectedSlotKey && getItemById(selectedItemId)?.slots?.includes('consumable')) {
        slot.classList.add('highlight-slot');
      }
      
      part.appendChild(slot);
    }
  } else {
    part.style.display = 'none';
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

  getAllRecipes().forEach((recipe, index) => {
    const resultItem = getItemById(recipe.result);
    if (!resultItem) return;

    if (filterType && (!resultItem.tags || !resultItem.tags.includes(filterType))) return;
    if (filterLevel !== '' && resultItem.level !== parseInt(filterLevel)) return;
    if (filterSlot && (!resultItem.slots || !resultItem.slots.includes(filterSlot))) return;

    const canCraft = canCraftRecipe(recipe);
    if (filterAvail === 'yes' && !canCraft) return;
    if (filterAvail === 'no' && canCraft) return;

    const slot = document.createElement('recipe-slot');
    slot.className = 'slot';
    if (resultItem.img) {
      slot.classList.add('filled');
      slot.style.backgroundImage = `url(${resultItem.img})`;
    }
    slot.dataset.recipeIndex = index;

    if (!canCraft) {
      slot.classList.add('unavailable');
    }

    slot.addEventListener('mouseenter', () => {
      showRecipeInfo(recipe);
    });
    slot.addEventListener('mouseleave', () => {
      hideItemInfo('info-right');
    });

    grid.appendChild(slot);
  });

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

// ========== ПРОВЕРКА КРАФТА ==========
function canCraftRecipe(recipe) {
  return recipe.ingredients.every(ing => character.countAvailable(ing.id) >= ing.count);
}

// ========== ВЫПОЛНЕНИЕ КРАФТА ==========
export function executeCraft(recipe) {
  for (const ing of recipe.ingredients) {
    let remaining = ing.count;
    
    while (remaining > 0 && character.hasItem(ing.id)) {
      character.removeItem(ing.id);
      remaining--;
    }
    
    if (remaining > 0) {
      const keysToRemove = [];
      const countedTwoHanded = new Set();
      
      for (const [key, itemId] of Object.entries(character.equipment)) {
        if (itemId !== ing.id || remaining <= 0) continue;
        const [slotName] = key.split('-');
        if (slotName === 'consumable') continue;
        
        if (slotName === 'weapon' && getItemById(itemId)?.tags?.includes('twoHanded')) {
          if (countedTwoHanded.has(itemId)) continue;
          countedTwoHanded.add(itemId);
          keysToRemove.push('weapon-0', 'weapon-1');
        } else {
          keysToRemove.push(key);
        }
        remaining--;
      }
      
      keysToRemove.forEach(k => delete character.equipment[k]);
      
      if (keysToRemove.some(k => k.startsWith('belt-'))) {
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
  hideItemInfo('info-right');
  document.getElementById('btn-unequip-left').style.display = 'none';

  if (selectedItemId) {
    const item = getItemById(selectedItemId);
    if (item) {
      showItemInfoStatic(item, 'info-left', 'itemTitle', 'properties');
    }
  } else if (selectedSlotKey) {
    const [sName, sIdx] = selectedSlotKey.split('-');
    const item = character.getEquippedItemByKey(selectedSlotKey);
    
    if (item) {
      showItemInfoStatic(item, 'info-left', 'itemTitle', 'properties');
      const suffix = item.tags?.includes('twoHanded') ? ' (надето, двуручное)' : ' (надето)';
      document.getElementById('itemTitle').textContent = item.name + suffix;
      
      document.getElementById('btn-unequip-left').style.display = 'block';
    } else {
      document.getElementById('itemTitle').textContent = `Слот: ${sName} [${sIdx}] (пусто)`;
    }
  }
}

// ========== ВСПЛЫВАЮЩИЕ ПОДСКАЗКИ (правая панель) ==========
export function showEquipSlotTooltip(slotName, index) {
  const key = `${slotName}-${index}`;
  const itemId = character.equipment[key];
  
  if (!itemId) {
    // Пустой слот
    if (selectedItemId) {
      const selectedItem = getItemById(selectedItemId);
      if (selectedItem?.slots?.includes(slotName)) {
        showEmptySlotHint(slotName, index, selectedItem);
      }
    }
    return;
  }
  
  const item = getItemById(itemId);
  if (!item) return;
  
  if (selectedItemId && selectedItemId !== itemId) {
    // Сравнение выбранного предмета с надетым
    const selectedItem = getItemById(selectedItemId);
    if (selectedItem) {
      showComparisonWithEquipped(selectedItem, item);
    }
  } else if (!selectedItemId) {
    // Просто показываем надетый предмет
    showEquippedItemTooltip(item);
  }
}

export function hideEquipSlotTooltip() {
  hideItemInfo('info-right');
}

function showEmptySlotHint(slotName, index, selectedItem) {
  const container = document.getElementById('info-right');
  if (!container) return;
  container.style.display = 'block';
  
  document.getElementById('itemTitleHover').textContent = `Слот: ${slotName} [${index}]`;
  
  const props = document.getElementById('propertiesHover');
  props.innerHTML = '';
  
  const dt = document.createElement('dt');
  dt.textContent = 'Выбранный предмет:';
  props.appendChild(dt);
  
  const dd = document.createElement('dd');
  dd.textContent = selectedItem.name;
  dd.style.color = '#888';
  props.appendChild(dd);
  
  const dt2 = document.createElement('dt');
  dt2.textContent = 'Клик — надеть';
  dt2.style.color = '#888';
  dt2.style.fontSize = '0.9em';
  props.appendChild(dt2);
}

function showEquippedItemTooltip(item) {
  showItemInfo(item, 'info-right', 'itemTitleHover', 'propertiesHover');
  document.getElementById('itemTitleHover').textContent += ' (надето)';
}

function showComparisonWithEquipped(selectedItem, equippedItem) {
  const container = document.getElementById('info-right');
  if (!container) return;
  container.style.display = 'block';
  
  document.getElementById('itemTitleHover').textContent = equippedItem.name + ' (надето)';
  
  const props = document.getElementById('propertiesHover');
  props.innerHTML = '';
  
  const levelClass = getCompareClass(selectedItem.level, equippedItem.level);
  const levelDiff = getDiffString(selectedItem.level, equippedItem.level);
  addProp(props, 'Уровень', equippedItem.level + levelDiff, levelClass);
  
  if (equippedItem.slots) {
    addProp(props, 'Слоты', equippedItem.slots.join(', '), '');
  }
  
  if (equippedItem.tags?.includes('twoHanded')) {
    addProp(props, 'Особенность', 'Двуручное', '');
  }
  
  const allKeys = new Set([
    ...Object.keys(selectedItem.properties || {}),
    ...Object.keys(equippedItem.properties || {})
  ]);
  
  allKeys.forEach(key => {
    const selectedVal = selectedItem.properties?.[key] || 0;
    const equippedVal = equippedItem.properties?.[key] || 0;
    const cls = getCompareClass(selectedVal, equippedVal);
    const diff = equippedVal - selectedVal;
    const sign = diff > 0 ? '+' : '';
    const diffText = diff !== 0 ? ` (${sign}${diff})` : '';
    const displayVal = (equippedVal > 0 ? '+' : '') + equippedVal + diffText;
    
    addProp(props, key, displayVal, cls);
  });
}

function showItemInfo(item, containerId, titleId, propsId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.display = 'block';
  
  document.getElementById(titleId).textContent = item.name;
  
  const props = document.getElementById(propsId);
  props.innerHTML = '';
  
  addProp(props, 'Уровень', item.level, '');
  
  if (item.slots) {
    addProp(props, 'Слоты', item.slots.join(', '), '');
  }
  
  if (item.tags && item.tags.includes('twoHanded')) {
    addProp(props, 'Особенность', 'Двуручное', '');
  }
  
  if (item.properties) {
    for (const [key, value] of Object.entries(item.properties)) {
      addProp(props, key, value > 0 ? '+' + value : value, '');
    }
  }
}

function showItemInfoStatic(item, containerId, titleId, propsId) {
  showItemInfo(item, containerId, titleId, propsId);
}

function showComparisonInfo(selectedId, hoveredItem) {
  const selectedItem = getItemById(selectedId);
  if (!selectedItem) return;
  
  const container = document.getElementById('info-right');
  if (!container) return;
  container.style.display = 'block';
  
  document.getElementById('itemTitleHover').textContent = hoveredItem.name;
  
  const props = document.getElementById('propertiesHover');
  props.innerHTML = '';
  
  const levelClass = getCompareClass(selectedItem.level, hoveredItem.level);
  const levelDiff = getDiffString(selectedItem.level, hoveredItem.level);
  addProp(props, 'Уровень', hoveredItem.level + levelDiff, levelClass);
  
  if (hoveredItem.slots) {
    addProp(props, 'Слоты', hoveredItem.slots.join(', '), '');
  }
  
  if (hoveredItem.tags && hoveredItem.tags.includes('twoHanded')) {
    addProp(props, 'Особенность', 'Двуручное', '');
  }
  
  if (hoveredItem.properties) {
    const allKeys = new Set([
      ...Object.keys(selectedItem.properties || {}),
      ...Object.keys(hoveredItem.properties || {})
    ]);
    
    allKeys.forEach(key => {
      const selectedVal = selectedItem.properties?.[key] || 0;
      const hoveredVal = hoveredItem.properties?.[key] || 0;
      const cls = getCompareClass(selectedVal, hoveredVal);
      const diff = hoveredVal - selectedVal;
      const sign = diff > 0 ? '+' : '';
      const diffText = diff !== 0 ? ` (${sign}${diff})` : '';
      const displayVal = (hoveredVal > 0 ? '+' : '') + hoveredVal + diffText;
      
      addProp(props, key, displayVal, cls);
    });
  }
}

function showRecipeInfo(recipe) {
  const resultItem = getItemById(recipe.result);
  if (!resultItem) return;
  
  const container = document.getElementById('info-right');
  if (!container) return;
  container.style.display = 'block';
  
  document.getElementById('itemTitleHover').textContent = resultItem.name;
  
  const props = document.getElementById('propertiesHover');
  props.innerHTML = '';
  
  addProp(props, 'Уровень', resultItem.level, '');
  if (resultItem.slots) addProp(props, 'Слоты', resultItem.slots.join(', '), '');
  
  if (resultItem.tags && resultItem.tags.includes('twoHanded')) {
    addProp(props, 'Особенность', 'Двуручное', '');
  }
  
  const dt = document.createElement('dt');
  dt.textContent = 'Требуется:';
  dt.style.marginTop = '6px';
  props.appendChild(dt);
  
  recipe.ingredients.forEach(ing => {
    const ingItem = getItemById(ing.id);
    const available = character.countAvailable(ing.id);
    
    const dd = document.createElement('dd');
    dd.textContent = `${ingItem ? ingItem.name : ing.id}: ${available}/${ing.count}`;
    dd.style.color = available >= ing.count ? '#008000' : '#800000';
    props.appendChild(dd);
  });
}

function hideItemInfo(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.style.display = 'none';
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

function getCompareClass(baseValue, compareValue) {
  if (compareValue > baseValue) return 'prop-better';
  if (compareValue < baseValue) return 'prop-worse';
  return 'prop-equal';
}

function getDiffString(baseValue, compareValue) {
  const diff = compareValue - baseValue;
  if (diff === 0) return '';
  const sign = diff > 0 ? '+' : '';
  return ` (${sign}${diff})`;
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
  document.getElementById('stat-def').textContent = s.DEF;
}

export function renderAll() {
  renderEquipment();
  renderInventory();
  renderRecipes();
  renderStats();
}

function isInvItemsTabActive() {
  const activeTab = document.querySelector('.inv-tab.active');
  return activeTab && activeTab.dataset.invtab === 'items';
}