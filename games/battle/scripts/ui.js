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

  // Заполняем надетые предметы
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

  // Блокировка двуручного
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
      if (slot1) slot1.classList.add('twohanded-disabled');
    }
  }

  // Блокировка слотов: пустой слот недоступен только если выбран single-предмет,
  // а рядом уже надет single
  allSlots.forEach(el => {
    const slotName = el.dataset.slot;
    const index = el.dataset.index;
    const key = `${slotName}-${index}`;
    
    // Занятые слоты не блокируем
    if (character.equipment[key]) return;
    
    // Если выбран предмет и он single
    if (selectedItemId) {
      const selectedItem = getItemById(selectedItemId);
      if (selectedItem?.tags?.includes('single')) {
        // Проверяем, нет ли рядом надетого single
        for (const [eqKey, equippedId] of Object.entries(character.equipment)) {
          const [eqSlot] = eqKey.split('-');
          if (eqSlot !== slotName || eqKey === key) continue;
          
          const equippedItem = getItemById(equippedId);
          if (equippedItem?.tags?.includes('single')) {
            el.classList.add('single-disabled');
            break;
          }
        }
      }
    }
  });

  // Подсветка выбранного слота
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

  // Подсветка слотов при выбранном предмете
  if (selectedItemId && !selectedSlotKey) {
    const item = getItemById(selectedItemId);
    if (item && item.slots) {
      allSlots.forEach(el => {
        const slotName = el.dataset.slot;
        const index = el.dataset.index;
        const key = `${slotName}-${index}`;
        
        if (!item.slots.includes(slotName)) return;
        
        // Используем единый метод проверки
        if (character.canEquipInSlot(selectedItemId, key)) {
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

function canCraftRecipe(recipe) {
  return recipe.ingredients.every(ing => character.countAvailable(ing.id) >= ing.count);
}

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

// ========== ВСПЛЫВАЮЩИЕ ПОДСКАЗКИ ==========
export function showEquipSlotTooltip(slotName, index) {
  const key = `${slotName}-${index}`;
  const itemId = character.equipment[key];
  
  if (!itemId) {
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
    const selectedItem = getItemById(selectedItemId);
    if (selectedItem) {
      showComparisonWithEquipped(selectedItem, item);
    }
  } else if (!selectedItemId) {
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
  document.getElementById('stat-def').textContent = s.DEF;
  
  updateXPBar();
}

export function renderStats() {
  const s = character.getStats();
  
  document.getElementById('stat-str').textContent = s.STR;
  document.getElementById('stat-con').textContent = s.CON;
  document.getElementById('stat-agi').textContent = s.AGI;
  document.getElementById('stat-reg').textContent = s.REG;
  document.getElementById('stat-acc').textContent = s.ACC;
  document.getElementById('stat-hp').textContent = s.HP;
  document.getElementById('stat-def').textContent = s.DEF;
  
  updateXPBar();
}

export function updateBattleCharacterStats(stats = null, currentHP = null) {
  const s = stats || character.getStats();
  const hp = currentHP !== null ? currentHP : s.HP;
  
  const hpEl = document.getElementById('stat-hp');
  if (hpEl) {
    hpEl.textContent = currentHP !== null ? `${currentHP}/${s.HP}` : s.HP;
    if (currentHP !== null && currentHP < s.HP * 0.3) {
      hpEl.classList.add('hp-critical');
    } else {
      hpEl.classList.remove('hp-critical');
    }
  }
  
  document.getElementById('stat-str').textContent = s.STR;
  document.getElementById('stat-con').textContent = s.CON;
  document.getElementById('stat-agi').textContent = s.AGI;
  document.getElementById('stat-reg').textContent = s.REG;
  document.getElementById('stat-acc').textContent = s.ACC;
  document.getElementById('stat-def').textContent = s.DEF;
  
  updateXPBar();
}

export function updateXPBar() {
  const s = character.getStats();
  const xpForLevel = s.level * 100;
  const percent = Math.min(100, (s.xp / xpForLevel) * 100);
  
  const fill = document.querySelector('.level-bar-fill');
  const text = document.querySelector('.level-bar-text');
  const levelValue = document.querySelector('.stat-value');
  
  if (fill) fill.style.width = percent + '%';
  if (text) text.textContent = `${s.xp} / ${xpForLevel}`;
  if (levelValue) levelValue.textContent = s.level;
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

// ========== БОЕВЫЕ ФУНКЦИИ ОТОБРАЖЕНИЯ ==========

export function renderEnemyList(enemies, currentIndex, isFighting) {
  const container = document.getElementById('enemy-list');
  if (!container) return;
  container.innerHTML = '';
  
  enemies.forEach((enemy, index) => {
    const entry = document.createElement('enemy-entry');
    entry.className = 'enemy';
    entry.dataset.index = index;
    
    if (enemy.currentHP <= 0) {
      entry.classList.add('dead');
    }
    
    if (index === currentIndex && isFighting && enemy.currentHP > 0) {
      entry.classList.add('fighting');
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'enemy-name';
    nameSpan.textContent = `${enemy.name} [ур.${enemy.level}]`;
    
    const hpSpan = document.createElement('span');
    hpSpan.className = 'enemy-hp';
    hpSpan.textContent = `${enemy.currentHP}/${enemy.stats.HP}`;
    
    entry.appendChild(nameSpan);
    entry.appendChild(hpSpan);
    container.appendChild(entry);
  });
}

export function renderEnemyInfo(enemy) {
  const container = document.getElementById('enemy-info');
  if (!container) return;
  
  container.innerHTML = '';
  container.classList.add('visible');
  
  const title = document.createElement('h3');
  title.textContent = `${enemy.name} [уровень ${enemy.level}]`;
  container.appendChild(title);
  
  const statsDl = document.createElement('dl');
  statsDl.className = 'enemy-stats';
  
  const statsData = [
    { label: 'HP', value: `${enemy.currentHP}/${enemy.stats.HP}`, critical: enemy.currentHP < enemy.stats.HP * 0.3 },
    { label: 'Сила', value: enemy.stats.STR },
    { label: 'Стойкость', value: enemy.stats.CON },
    { label: 'Ловкость', value: enemy.stats.AGI },
    { label: 'Меткость', value: enemy.stats.ACC },
    { label: 'Защита', value: enemy.stats.DEF },
    { label: 'Урон', value: `${enemy.stats.DAMAGE_MIN}-${enemy.stats.DAMAGE_MAX}` },
    { label: 'Опыт', value: enemy.stats.xp }
  ];
  
  statsData.forEach(stat => {
    const dt = document.createElement('dt');
    dt.textContent = stat.label;
    
    const dd = document.createElement('dd');
    dd.textContent = stat.value;
    if (stat.critical) {
      dd.classList.add('hp-critical');
    }
    
    statsDl.appendChild(dt);
    statsDl.appendChild(dd);
  });
  
  container.appendChild(statsDl);
  
  if (enemy.equipment && Object.keys(enemy.equipment).length > 0) {
    const eqTitle = document.createElement('p');
    eqTitle.className = 'enemy-equipment';
    eqTitle.textContent = 'Экипировка:';
    container.appendChild(eqTitle);
    
    const eqList = document.createElement('ul');
    eqList.className = 'enemy-equipment-list';
    
    Object.entries(enemy.equipment).forEach(([slot, itemId]) => {
      const item = getItemById(itemId);
      const li = document.createElement('li');
      li.textContent = `${slot}: ${item ? item.name : itemId}`;
      eqList.appendChild(li);
    });
    
    container.appendChild(eqList);
  }
}

export function hideEnemyInfo() {
  const container = document.getElementById('enemy-info');
  if (container) {
    container.innerHTML = '';
    container.classList.remove('visible');
  }
}

export function renderBattleActions(html) {
  const container = document.getElementById('battle-actions');
  if (container) container.innerHTML = html;
}

export function renderBattleLog(html) {
  const log = document.getElementById('battle-log');
  if (log) log.innerHTML = html;
}

export function addBattleLogEntry(message, className = '') {
  const log = document.getElementById('battle-log');
  if (!log) return;
  
  const entry = document.createElement('p');
  entry.className = 'log-entry' + (className ? ' ' + className : '');
  entry.textContent = message;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

export function showBattleResult(title, message) {
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-text').textContent = message;
  document.getElementById('modal-result').classList.add('open');
}

export function highlightEnemy(index) {
  document.querySelectorAll('.enemy').forEach(e => {
    e.classList.remove('selected');
  });
  const enemy = document.querySelector(`.enemy[data-index="${index}"]`);
  if (enemy) enemy.classList.add('selected');
}

export function disableEnemyClicks() {
  document.querySelectorAll('.enemy').forEach(e => {
    e.style.pointerEvents = 'none';
  });
}