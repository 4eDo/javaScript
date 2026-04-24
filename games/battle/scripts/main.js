import { loadItemsDB, getItemById, getRecipeByIndex, getAllItemIds } from './itemsDB.js';
import { Character } from './character.js';
import * as ui from './ui.js';
import { setupBattle, setBattleEndCallback } from './battle.js';
import { loadEnemyTemplates } from './enemy.js';

const player = new Character();
ui.setCharacter(player);

// ========== ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ==========
function setupDelegatedEvents() {
  const equipView = document.getElementById('equip-view');
  
  // Клик по слотам экипировки
  equipView.addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (!slot || !slot.dataset.slot) return;
    if (slot.classList.contains('twohanded-disabled')) return;
    if (slot.classList.contains('single-disabled')) return;
    onEquipSlotClick(slot.dataset.slot, parseInt(slot.dataset.index));
  });

  // Наведение на слоты экипировки
  equipView.addEventListener('mouseenter', e => {
    const slot = e.target.closest('.slot');
    if (!slot || !slot.dataset.slot) return;
    ui.showEquipSlotTooltip(slot.dataset.slot, parseInt(slot.dataset.index));
  }, true);
  
  equipView.addEventListener('mouseleave', e => {
    const slot = e.target.closest('.slot');
    if (!slot || !slot.dataset.slot) return;
    ui.hideEquipSlotTooltip();
  }, true);

  // Клик по инвентарю
  document.getElementById('items').addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (!slot?.dataset.id) return;
    onInventoryItemClick(slot.dataset.id);
  });

  // Клик по рецептам
  document.getElementById('engineering-recipes').addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (slot?.dataset.recipeIndex === undefined) return;
    onRecipeClick(parseInt(slot.dataset.recipeIndex));
  });

  // Клик по кнопке «Создать»
  document.getElementById('inv-engineering').addEventListener('click', e => {
    if (e.target.id === 'btn-create-item') onCraftClick();
  });

  // Правый клик — снятие
  equipView.addEventListener('contextmenu', e => {
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
}

// ========== ЛОГИКА КЛИКОВ ==========
function onEquipSlotClick(slotName, index) {
  const key = `${slotName}-${index}`;

  if (slotName === 'weapon' && player._isTwoHandedEquipped()) {
    if (ui.getSelectedSlotKey() === 'weapon-0' && !ui.getSelectedItemId()) {
      ui.clearSelection();
    } else if (ui.getSelectedItemId()) {
      const item = getItemById(ui.getSelectedItemId());
      if (item?.slots?.includes('weapon')) {
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

  if (ui.getSelectedSlotKey() === key && !ui.getSelectedItemId()) {
    ui.clearSelection();
  } else if (ui.getSelectedItemId()) {
    const item = getItemById(ui.getSelectedItemId());
    if (item?.slots?.includes(slotName)) {
      player.equip(ui.getSelectedItemId(), key);
      ui.clearSelection();
    }
  } else {
    ui.selectSlot(key);
  }
  ui.renderAll();
  ui.updateItemInfo();
}

function onInventoryItemClick(itemId) {
  if (ui.getSelectedSlotKey()) {
    const [slotName] = ui.getSelectedSlotKey().split('-');
    const item = getItemById(itemId);
    if (item?.slots?.includes(slotName)) {
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
  const recipe = getRecipeByIndex(index);
  if (!recipe) return;

  const resultItem = getItemById(recipe.result);
  
  document.getElementById('itemTitle').textContent = resultItem ? resultItem.name : recipe.result;
  const props = document.getElementById('properties');
  props.innerHTML = '';

  if (resultItem) {
    addPropLocal(props, 'Уровень', resultItem.level, '');
    if (resultItem.slots) addPropLocal(props, 'Слоты', resultItem.slots.join(', '), '');
    if (resultItem.tags?.includes('twoHanded')) addPropLocal(props, 'Особенность', 'Двуручное', '');
    if (resultItem.properties) {
      for (const [k, v] of Object.entries(resultItem.properties)) {
        addPropLocal(props, k, v > 0 ? '+' + v : v, '');
      }
    }
  }

  const dt = document.createElement('dt');
  dt.textContent = 'Требуется:';
  dt.style.marginTop = '8px';
  props.appendChild(dt);

  recipe.ingredients.forEach(ing => {
    const ingItem = getItemById(ing.id);
    const avail = player.countAvailable(ing.id);
    const dd = document.createElement('dd');
    dd.textContent = `${ingItem?.name || ing.id}: ${avail}/${ing.count}`;
    dd.style.color = avail >= ing.count ? '#008000' : '#800000';
    props.appendChild(dd);
  });

  document.getElementById('btn-unequip-left').style.display = 'none';
  
  const can = recipe.ingredients.every(ing => player.countAvailable(ing.id) >= ing.count);
  ui.setPendingRecipe(can ? recipe : null);
}

function onCraftClick() {
  const recipe = ui.getPendingRecipe();
  if (!recipe) return;

  const equipped = player.getEquippedIngredients(recipe);
  
  if (equipped.length > 0) {
    const list = document.getElementById('equipped-warning-list');
    list.innerHTML = '';
    equipped.forEach(eq => {
      const item = getItemById(eq.itemId);
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

// ========== ПРОЧИЕ ОБРАБОТЧИКИ ==========
function setupOtherEvents() {
  document.getElementById('btn-unequip-left').addEventListener('click', () => {
    if (ui.getSelectedSlotKey()) {
      player.unequip(ui.getSelectedSlotKey());
      ui.clearSelection();
      ui.renderAll();
      ui.updateItemInfo();
    }
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

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

  document.getElementById('btn-upgrade').addEventListener('click', () => {
    document.getElementById('modal-upgrade').classList.add('open');
  });

  document.getElementById('btn-confirm-craft').addEventListener('click', () => {
    const recipe = ui.getPendingRecipe();
    if (recipe) finishCraft(recipe);
  });

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

  document.querySelectorAll('modal-window').forEach(win => {
    win.addEventListener('click', e => e.stopPropagation());
  });

  ['filter-type', 'filter-level', 'filter-slot'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => ui.renderInventory());
  });
  ['eng-filter-type', 'eng-filter-level', 'eng-filter-slot', 'eng-filter-available'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => ui.renderRecipes());
  });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function init() {
  await loadItemsDB();
  await loadEnemyTemplates();
  setupDelegatedEvents();
  setupOtherEvents();
  setupBattle(player, ui);
  
  const allIds = getAllItemIds();
  player.testFillInventory(allIds);
  
  ui.renderAll();
  ui.updateItemInfo();
}

document.addEventListener('DOMContentLoaded', init);