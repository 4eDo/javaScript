import { loadItemsDB, getItem, getRecipe, getAllRecipes, getItemCount, getAllItemIds } from './itemsDB.js';
import { Character } from './character.js';
import * as ui from './ui.js';

const player = new Character();
ui.setCharacter(player);

// ========== ОБРАБОТЧИКИ КЛИКОВ (делегирование) ==========
function setupDelegatedEvents() {
  // Клик по слотам экипировки (статические + consumable динамические)
  document.getElementById('equip-view').addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (!slot || !slot.dataset.slot) return;
    if (slot.classList.contains('twohanded-disabled')) return;
    onEquipSlotClick(slot.dataset.slot, parseInt(slot.dataset.index));
  });

  // Клик по инвентарю
  document.getElementById('items').addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (!slot?.dataset.id) return;
    onInventoryClick(slot.dataset.id);
  });

  // Клик по рецептам
  document.getElementById('engineering-recipes').addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (slot?.dataset.recipeIndex === undefined) return;
    onRecipeClick(parseInt(slot.dataset.recipeIndex));
  });

  // Клик «Создать»
  document.getElementById('inv-engineering').addEventListener('click', e => {
    if (e.target.id === 'btn-create-item') onCraftClick();
  });
}

// ========== ЛОГИКА КЛИКОВ ==========
function onEquipSlotClick(slotName, index) {
  const key = `${slotName}-${index}`;

  // Двуручное в слоте 0 — клик по любому слоту оружия
  if (slotName === 'weapon' && player._isTwoHandedEquipped()) {
    if (ui.getSelectedSlotKey() === 'weapon-0' && !ui.getSelectedItemId()) {
      ui.clearSelection();
    } else if (ui.getSelectedItemId()) {
      if (getItem(ui.getSelectedItemId())?.slots?.includes('weapon')) {
        player.equip(ui.getSelectedItemId(), 'weapon-0');
        ui.clearSelection();
      } else {
        ui.selectSlot('weapon-0');
      }
    } else {
      ui.selectSlot('weapon-0');
    }
    ui.renderAll();
    ui.updateItemInfo();
    return;
  }

  // Обычное поведение
  if (ui.getSelectedSlotKey() === key && !ui.getSelectedItemId()) {
    ui.clearSelection();
  } else if (ui.getSelectedItemId()) {
    if (getItem(ui.getSelectedItemId())?.slots?.includes(slotName)) {
      player.equip(ui.getSelectedItemId(), key);
      ui.clearSelection();
    }
  } else {
    ui.selectSlot(key);
  }
  ui.renderAll();
  ui.updateItemInfo();
}

function onInventoryClick(itemId) {
  if (ui.getSelectedSlotKey()) {
    const [slotName] = ui.getSelectedSlotKey().split('-');
    if (getItem(itemId)?.slots?.includes(slotName)) {
      player.equip(itemId, ui.getSelectedSlotKey());
      ui.clearSelection();
      ui.renderAll();
      ui.updateItemInfo();
      return;
    }
  }
  if (ui.getSelectedItemId() === itemId) {
    ui.clearSelection();
  } else {
    ui.selectItem(itemId);
  }
  ui.renderAll();
  ui.updateItemInfo();
}

function onRecipeClick(index) {
  const recipe = getRecipe(index);
  if (!recipe) return;

  const item = getItem(recipe.result);
  document.getElementById('itemTitle').textContent = item?.name || recipe.result;
  const props = document.getElementById('properties');
  props.innerHTML = '';
  if (item) {
    addPropLocal(props, 'Уровень', item.level, '');
    if (item.slots) addPropLocal(props, 'Слоты', item.slots.join(', '), '');
    if (item.isTwoHanded) addPropLocal(props, 'Особенность', 'Двуручное', '');
    if (item.properties) {
      for (const [k, v] of Object.entries(item.properties)) {
        addPropLocal(props, k, v > 0 ? '+' + v : v, '');
      }
    }
  }

  const dt = document.createElement('dt');
  dt.textContent = 'Требуется:';
  dt.style.marginTop = '8px';
  props.appendChild(dt);

  recipe.ingredients.forEach(ing => {
    const ingItem = getItem(ing.id);
    const avail = player.countAvailable(ing.id);
    const dd = document.createElement('dd');
    dd.textContent = `${ingItem?.name || ing.id}: ${avail}/${ing.count}`;
    dd.style.color = avail >= ing.count ? '#008000' : '#800000';
    props.appendChild(dd);
  });

  document.getElementById('btn-unequip-left').style.display = 'none';
  const canCraft = recipe.ingredients.every(ing => player.countAvailable(ing.id) >= ing.count);
  ui.setPendingRecipe(canCraft ? recipe : null);
}

function onCraftClick() {
  const recipe = ui.getPendingRecipe();
  if (!recipe) return;

  const equipped = ui.getEquippedIngredients(recipe);
  if (equipped.length > 0) {
    const list = document.getElementById('equipped-warning-list');
    list.innerHTML = '';
    equipped.forEach(eq => {
      const item = getItem(eq.itemId);
      const li = document.createElement('li');
      li.textContent = `${item?.name || eq.itemId} — слот: ${eq.slot}[${eq.index}]`;
      list.appendChild(li);
    });
    document.getElementById('modal-equipped-warning').classList.add('open');
  } else {
    finishCraft(recipe);
  }
}

function finishCraft(recipe) {
  ui.executeCraft(recipe);
  ui.setPendingRecipe(null);
  document.getElementById('modal-equipped-warning').classList.remove('open');
  ui.clearSelection();
  ui.renderAll();
  ui.updateItemInfo();
}

function addPropLocal(container, key, value, className) {
  const dt = document.createElement('dt');
  dt.textContent = key;
  if (className) dt.className = className;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (className) dd.className = className;
  container.appendChild(dt);
  container.appendChild(dd);
}

// ========== СНЯТИЕ ПРЕДМЕТА (кнопка и правая кнопка) ==========
document.getElementById('btn-unequip-left').addEventListener('click', () => {
  if (ui.getSelectedSlotKey()) {
    player.unequip(ui.getSelectedSlotKey());
    ui.clearSelection();
    ui.renderAll();
    ui.updateItemInfo();
  }
});

// ========== ОБРАБОТЧИКИ ПРОЧЕГО ==========
function setupOtherEvents() {
  // Снятие по правому клику на слот экипировки
  document.getElementById('equip-view').addEventListener('contextmenu', e => {
    const slot = e.target.closest('.slot');
    if (!slot?.dataset.slot) return;
    e.preventDefault();
    const key = `${slot.dataset.slot}-${slot.dataset.index}`;
    if (player.equipment[key]) {
      player.unequip(key);
      ui.clearSelection();
      ui.renderAll();
      ui.updateItemInfo();
    }
  });

  // Табы Персонаж / Бой
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Экипировка / Характеристики
  document.getElementById('btn-show-equip').addEventListener('click', () => {
    document.getElementById('btn-show-equip').classList.add('active');
    document.getElementById('btn-show-stats').classList.remove('active');
    document.getElementById('equip-view').classList.add('active');
    document.getElementById('stats-view').classList.remove('active');
  });
  document.getElementById('btn-show-stats').addEventListener('click', () => {
    document.getElementById('btn-show-stats').classList.add('active');
    document.getElementById('btn-show-equip').classList.remove('active');
    document.getElementById('stats-view').classList.add('active');
    document.getElementById('equip-view').classList.remove('active');
  });

  // Вкладки инвентаря
  document.querySelectorAll('.inv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.inv-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('inv-' + tab.dataset.invtab).classList.add('active');
      ui.clearSelection();
      ui.updateItemInfo();
    });
  });

  // Прокачка за пост
  document.getElementById('btn-upgrade').addEventListener('click', () => {
    document.getElementById('modal-upgrade').classList.add('open');
  });

  // Подтверждение крафта
  document.getElementById('btn-confirm-craft').addEventListener('click', () => {
    const recipe = ui.getPendingRecipe();
    if (recipe) finishCraft(recipe);
  });

  // Закрытие модалок
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.close).classList.remove('open');
    });
  });
  document.querySelectorAll('modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  // Предотвращаем всплытие с modal-window
  document.querySelectorAll('modal-window').forEach(win => {
    win.addEventListener('click', e => e.stopPropagation());
  });

  // Фильтры
  ['filter-type', 'filter-level', 'filter-slot'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => ui.renderInventory());
  });
  ['eng-filter-type', 'eng-filter-level', 'eng-filter-slot', 'eng-filter-available'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => ui.renderRecipes());
  });

  // Бой (заглушка)
  document.getElementById('btn-attack').addEventListener('click', () => {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('p');
    entry.className = 'log-entry';
    entry.textContent = 'Вы атакуете — ' + Math.floor(Math.random() * 20 + 5) + ' урона.';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    if (Math.random() < 0.3) {
      setTimeout(() => {
        document.getElementById('result-title').textContent = 'Победа!';
        document.getElementById('result-text').textContent = 'Вы победили противника! Получено 50 опыта.';
        document.getElementById('modal-result').classList.add('open');
      }, 500);
    }
  });
  document.getElementById('btn-flee').addEventListener('click', () => {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('p');
    entry.className = 'log-entry log-system';
    entry.textContent = 'Вы пытаетесь убежать...';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    setTimeout(() => {
      document.getElementById('result-title').textContent = 'Побег!';
      document.getElementById('result-text').textContent = 'Вы успешно сбежали с поля боя.';
      document.getElementById('modal-result').classList.add('open');
    }, 800);
  });
  document.querySelectorAll('.enemy').forEach(enemy => {
    enemy.addEventListener('click', () => {
      document.querySelectorAll('.enemy').forEach(e => e.style.outline = '');
      enemy.style.outline = '2px solid #000';
    });
  });
}

// ========== ТЕСТОВОЕ НАПОЛНЕНИЕ ==========
function testFillInventory() {
  const allIds = getAllItemIds();
  player.testFillInventory(allIds);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function init() {
  await loadItemsDB();
  setupDelegatedEvents();
  setupOtherEvents();
  
  testFillInventory();
  
  ui.renderAll();
  ui.updateItemInfo();
}

document.addEventListener('DOMContentLoaded', init);