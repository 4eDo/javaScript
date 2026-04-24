import { getItemById } from './itemsDB.js';
import { CONFIG } from './config.js';

export class Character {
  constructor() {
    this.inventory = [];
    this.equipment = {};
    this.xp = 0;
    this.level = 1;
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
  getEquippedItem(slotName, index) {
    const key = `${slotName}-${index}`;
    const itemId = this.equipment[key];
    return itemId ? getItemById(itemId) : null;
  }

  getEquippedItemByKey(slotKey) {
    const itemId = this.equipment[slotKey];
    return itemId ? getItemById(itemId) : null;
  }

  isEquipped(itemId) {
    return Object.values(this.equipment).includes(itemId);
  }

  equip(itemId, slotKey) {
    const item = getItemById(itemId);
    if (!item) return false;

    const [slotName, indexStr] = slotKey.split('-');
    const index = parseInt(indexStr);

    // Если слот уже содержит этот предмет — ничего не делаем
    if (this.equipment[slotKey] === itemId) return false;

    // Проверка: предмет должен подходить к слоту
    if (!item.slots || !item.slots.includes(slotName)) return false;

    // Проверка single: в этой части тела уже надет ЛЮБОЙ single-предмет
    if (item.tags && item.tags.includes('single')) {
      for (const [key, equippedId] of Object.entries(this.equipment)) {
        const [eqSlot] = key.split('-');
        if (eqSlot !== slotName) continue;
        if (key === slotKey) continue; // тот же слот — можно заменить
        const equippedItem = getItemById(equippedId);
        if (equippedItem?.tags?.includes('single')) {
          // В другом слоте этой же части тела уже надет single-предмет
          return false;
        }
      }
    }

    // Запоминаем старые предметы для возврата в инвентарь
    const oldItems = [];

    // Двуручное оружие
    if (item.tags && item.tags.includes('twoHanded') && slotName === 'weapon') {
      const w0 = this.equipment['weapon-0'];
      const w1 = this.equipment['weapon-1'];
      
      if (w0 && w1 && w0 === w1 && getItemById(w0)?.tags?.includes('twoHanded')) {
        oldItems.push(w0);
      } else {
        if (w0) oldItems.push(w0);
        if (w1) oldItems.push(w1);
      }
      
      delete this.equipment['weapon-0'];
      delete this.equipment['weapon-1'];
      
      this.equipment['weapon-0'] = itemId;
      this.equipment['weapon-1'] = itemId;
    }
    // Одноручное в слот оружия, когда надето двуручное
    else if (slotName === 'weapon' && this._isTwoHandedEquipped()) {
      const w0 = this.equipment['weapon-0'];
      oldItems.push(w0);
      delete this.equipment['weapon-0'];
      delete this.equipment['weapon-1'];
      
      const otherIdx = index === 0 ? 1 : 0;
      const otherKey = `weapon-${otherIdx}`;
      const otherId = this.equipment[otherKey];
      
      if (item.tags && item.tags.includes('single') && otherId === itemId) {
        if (otherId) oldItems.push(otherId);
        delete this.equipment[otherKey];
      }
      
      if (this.equipment[slotKey]) {
        oldItems.push(this.equipment[slotKey]);
      }
      
      this.equipment[slotKey] = itemId;
    }
    // Пояс
    else if (slotName === 'belt') {
      if (this.equipment[slotKey]) {
        oldItems.push(this.equipment[slotKey]);
      }
      
      if (item.tags && item.tags.includes('single')) {
        for (const [key, equippedId] of Object.entries(this.equipment)) {
          const [eqSlot] = key.split('-');
          if (eqSlot === 'belt' && key !== slotKey) {
            const equippedItem = getItemById(equippedId);
            if (equippedItem?.tags?.includes('single')) {
              oldItems.push(equippedId);
              delete this.equipment[key];
            }
          }
        }
      }
      
      this.equipment[slotKey] = itemId;
      this._redistributeConsumables();
    }
    // Обычный слот
    else {
      if (this.equipment[slotKey]) {
        oldItems.push(this.equipment[slotKey]);
      }
      
      if (item.tags && item.tags.includes('single')) {
        for (const [key, equippedId] of Object.entries(this.equipment)) {
          const [eqSlot] = key.split('-');
          if (eqSlot === slotName && key !== slotKey) {
            const equippedItem = getItemById(equippedId);
            if (equippedItem?.tags?.includes('single')) {
              oldItems.push(equippedId);
              delete this.equipment[key];
            }
          }
        }
      }
      
      this.equipment[slotKey] = itemId;
    }

    // Возвращаем старые предметы в инвентарь
    oldItems.forEach(id => this.addItem(id));

    // Удаляем надетый предмет из инвентаря
    this.removeItem(itemId);
    return true;
  }

  unequip(slotKey) {
    const itemId = this.equipment[slotKey];
    if (!itemId) return;

    const [slotName] = slotKey.split('-');
    const item = getItemById(itemId);

    if (slotName === 'weapon' && item?.tags?.includes('twoHanded')) {
      // Снимаем двуручное (один экземпляр в инвентарь)
      delete this.equipment['weapon-0'];
      delete this.equipment['weapon-1'];
      this.addItem(itemId);
    } else if (slotName === 'belt') {
      delete this.equipment[slotKey];
      this.addItem(itemId);
      this._redistributeConsumables();
    } else {
      delete this.equipment[slotKey];
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

      if (slotName === 'weapon' && getItemById(itemId)?.tags?.includes('twoHanded')) {
        if (countedTwoHanded.has(itemId)) continue;
        countedTwoHanded.add(itemId);
      }

      const props = getItemById(itemId)?.properties || {};
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
      DEF: this._getTotalDEF(),
      DAMAGE_MIN: this._getWeaponDamageMin(),
      DAMAGE_MAX: this._getWeaponDamageMax(),
      dodge: Math.round(dodge),
      doubleAttack: Math.round(doubleAttack),
      damageReduce: Math.round(damageReduce),
      level: this.level,
      xp: this.xp
    };
  }

  // ========== ВСПОМОГАТЕЛЬНОЕ ==========
  getConsumableCapacity() {
    let capacity = 0;
    for (const [key, itemId] of Object.entries(this.equipment)) {
      if (!key.startsWith('belt-') || !itemId) continue;
      capacity += getItemById(itemId)?.properties?.CAPACITY || 0;
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
      if (slotName === 'weapon' && getItemById(id)?.tags?.includes('twoHanded')) {
        if (countedTwoHanded.has(id)) continue;
        countedTwoHanded.add(id);
      }
      count++;
    }
    return count;
  }

  getEquippedIngredients(recipe) {
    const equippedList = [];
    
    for (const ing of recipe.ingredients) {
      let remaining = ing.count;
      const invCount = this.inventory.filter(id => id === ing.id).length;
      remaining -= invCount;
      
      if (remaining > 0) {
        const countedTwoHanded = new Set();
        for (const [key, itemId] of Object.entries(this.equipment)) {
          if (itemId === ing.id && remaining > 0) {
            const [slotName, index] = key.split('-');
            if (slotName === 'consumable') continue;
            
            if (slotName === 'weapon' && getItemById(itemId)?.tags?.includes('twoHanded')) {
              if (countedTwoHanded.has(itemId)) continue;
              countedTwoHanded.add(itemId);
            }
            
            equippedList.push({
              itemId: ing.id,
              slot: slotName,
              index: index,
              key: key
            });
            remaining--;
          }
        }
      }
    }
    
    return equippedList;
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========
  _isTwoHandedEquipped() {
    const w0 = this.equipment['weapon-0'];
    const w1 = this.equipment['weapon-1'];
    return w0 && w1 && w0 === w1 && getItemById(w0)?.tags?.includes('twoHanded');
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

  _getTotalDEF() {
    let def = 0;
    const countedTwoHanded = new Set();
    for (const [key, itemId] of Object.entries(this.equipment)) {
      if (!itemId) continue;
      const [slotName] = key.split('-');
      if (slotName === 'weapon' && getItemById(itemId)?.tags?.includes('twoHanded')) {
        if (countedTwoHanded.has(itemId)) continue;
        countedTwoHanded.add(itemId);
      }
      def += getItemById(itemId)?.properties?.DEF || 0;
    }
    return def;
  }

  _getWeaponDamageMin() {
    const weapon = this.getEquippedItem('weapon', 0) || this.getEquippedItem('weapon', 1);
    return weapon?.properties?.DAMAGE_MIN || 1;
  }

  _getWeaponDamageMax() {
    const weapon = this.getEquippedItem('weapon', 0) || this.getEquippedItem('weapon', 1);
    return weapon?.properties?.DAMAGE_MAX || 5;
  }

  addXP(amount) {
    this.xp += amount;
    // Упрощённая система уровней, можно доработать
    const xpForLevel = this.level * 100;
    while (this.xp >= xpForLevel) {
      this.xp -= xpForLevel;
      this.level++;
    }
  }

  // ========== ТЕСТОВОЕ НАПОЛНЕНИЕ ==========
  testFillInventory(allIds) {
    this.inventory = [];
    this.equipment = {};
    const count = Math.floor(Math.random() * 20) + 15;
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * allIds.length);
      this.addItem(allIds[randomIndex]);
    }
    console.log('Инвентарь наполнен:', this.inventory.length, 'предметов');
  }
}