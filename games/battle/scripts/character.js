import { getItem } from './itemsDB.js';
import { CONFIG } from './config.js';

export class Character {
  constructor() {
    this.inventory = [];
    this.equipment = {}; // { 'head-0': itemId, ... }
  }

  // ========== ИНВЕНТАРЬ ==========
  addItem(itemId) {
    this.inventory.push(itemId);
  }

  removeItem(itemId) {
    const idx = this.inventory.indexOf(itemId);
    if (idx !== -1) this.inventory.splice(idx, 1);
  }

  hasItem(itemId) {
    return this.inventory.includes(itemId);
  }

  // ========== ЭКИПИРОВКА ==========
  getEquipped(slotKey) {
    const itemId = this.equipment[slotKey];
    return itemId ? getItem(itemId) : null;
  }

  isEquipped(itemId) {
    return Object.values(this.equipment).includes(itemId);
  }

  equip(itemId, slotKey) {
    const item = getItem(itemId);
    if (!item) return false;

    const [slotName, indexStr] = slotKey.split('-');
    const index = parseInt(indexStr);

    // Двуручное оружие
    if (item.isTwoHanded && slotName === 'weapon') {
      this._unequipSlotRaw('weapon-0');
      this._unequipSlotRaw('weapon-1');
      this.equipment['weapon-0'] = itemId;
      this.equipment['weapon-1'] = itemId;
    }
    // Одноручное в слот оружия при надетом двуручном
    else if (slotName === 'weapon' && this._isTwoHandedEquipped()) {
      this._unequipSlotRaw('weapon-0');
      this._unequipSlotRaw('weapon-1');
      this._handleSingleConflict(item, slotName, index, slotKey);
      this.equipment[slotKey] = itemId;
    }
    // Пояс
    else if (slotName === 'belt') {
      this._unequipSlotRaw(slotKey);
      this._handleSingleConflict(item, slotName, index, slotKey);
      this.equipment[slotKey] = itemId;
      this._redistributeConsumables();
    }
    // Обычный слот
    else {
      this._unequipSlotRaw(slotKey);
      this._handleSingleConflict(item, slotName, index, slotKey);
      this.equipment[slotKey] = itemId;
    }

    this.removeItem(itemId);
    return true;
  }

  unequip(slotKey) {
    const [slotName] = slotKey.split('-');
    const itemId = this.equipment[slotKey];
    if (!itemId) return;

    if (slotName === 'weapon' && getItem(itemId)?.isTwoHanded) {
      this._unequipSlotRaw('weapon-0');
      this._unequipSlotRaw('weapon-1');
      this.addItem(itemId);
    } else if (slotName === 'belt') {
      this._unequipSlotRaw(slotKey);
      this.addItem(itemId);
      this._redistributeConsumables();
    } else {
      this._unequipSlotRaw(slotKey);
      this.addItem(itemId);
    }
  }

  // ========== СТАТЫ ==========
  getStats() {
    let STR = 1, CON = 1, AGI = 1, REG = 1, ACC = 1;
    const countedTwoHanded = new Set();

    for (const [key, itemId] of Object.entries(this.equipment)) {
      if (!itemId) continue;
      const [slotName] = key.split('-');

      if (slotName === 'weapon' && getItem(itemId)?.isTwoHanded) {
        if (countedTwoHanded.has(itemId)) continue;
        countedTwoHanded.add(itemId);
      }

      const props = getItem(itemId)?.properties || {};
      STR += props.STR || 0;
      CON += props.CON || 0;
      AGI += props.AGI || 0;
      REG += props.REG || 0;
      ACC += props.ACC || 0;
    }

    const hp = CONFIG.BASE_HP + CON * CONFIG.HP_PER_CON;
    const dodge = Math.min(AGI * CONFIG.DODGE_PER_AGI, CONFIG.MAX_DODGE);
    const doubleAttack = Math.min(AGI * CONFIG.DOUBLE_PER_AGI, CONFIG.MAX_DOUBLE_ATTACK);
    const damageReduce = Math.min(CON * CONFIG.REDUCE_PER_CON, CONFIG.MAX_DAMAGE_REDUCE);

    return {
      STR, CON, AGI, REG, ACC,
      HP: Math.round(hp),
      dodge: Math.round(dodge),
      doubleAttack: Math.round(doubleAttack),
      damageReduce: Math.round(damageReduce),
    };
  }

  // ========== ВСПОМОГАТЕЛЬНОЕ ==========
  getConsumableCapacity() {
    let capacity = 0;
    for (const [key, itemId] of Object.entries(this.equipment)) {
      if (!key.startsWith('belt-') || !itemId) continue;
      capacity += getItem(itemId)?.properties?.CAPACITY || 0;
    }
    return capacity;
  }

  countAvailable(itemId) {
    let count = this.inventory.filter(id => id === itemId).length;
    const countedTwoHanded = new Set();

    for (const [key, id] of Object.entries(this.equipment)) {
      if (id !== itemId) continue;
      const [slotName] = key.split('-');
      if (slotName === 'consumable') continue;
      if (slotName === 'weapon' && getItem(id)?.isTwoHanded) {
        if (countedTwoHanded.has(id)) continue;
        countedTwoHanded.add(id);
      }
      count++;
    }
    return count;
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========
  _unequipSlotRaw(slotKey) {
    const itemId = this.equipment[slotKey];
    if (itemId) {
      this.addItem(itemId);
      delete this.equipment[slotKey];
    }
  }

  _isTwoHandedEquipped() {
    const w0 = this.equipment['weapon-0'];
    const w1 = this.equipment['weapon-1'];
    return w0 && w1 && w0 === w1 && getItem(w0)?.isTwoHanded;
  }

  _handleSingleConflict(newItem, slotName, targetIndex, targetKey) {
    if (!newItem.isSingle) return;
    for (const [key, equippedId] of Object.entries(this.equipment)) {
      const [eqSlot, eqIdx] = key.split('-');
      if (eqSlot === slotName && equippedId === newItem.id && key !== targetKey) {
        this._unequipSlotRaw(key);
        break;
      }
    }
  }

  _redistributeConsumables() {
    const capacity = this.getConsumableCapacity();
    const consumableItems = [];

    for (const [key, itemId] of Object.entries(this.equipment)) {
      if (key.startsWith('consumable-')) {
        consumableItems.push(itemId);
        delete this.equipment[key];
      }
    }

    for (let i = 0; i < capacity; i++) {
      const key = `consumable-${i}`;
      if (i < consumableItems.length) {
        this.equipment[key] = consumableItems[i];
      }
    }

    for (let i = capacity; i < consumableItems.length; i++) {
      this.addItem(consumableItems[i]);
    }
  }

  // ========== ТЕСТОВОЕ НАПОЛНЕНИЕ ==========
  testFillInventory(itemList) {
    this.inventory = [];
    this.equipment = {};
    const count = Math.floor(Math.random() * 20) + 15;
    for (let i = 0; i < count; i++) {
      const randomId = itemList[Math.floor(Math.random() * itemList.length)];
      this.addItem(randomId);
    }
  }
}