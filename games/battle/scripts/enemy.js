import { getItemById, getAllItems } from './itemsDB.js';

let enemyTemplates = [];

export async function loadEnemyTemplates() {
  const resp = await fetch('./enemy.json');
  enemyTemplates = await resp.json();
}

export function generateEnemy(playerLevel) {
  const template = enemyTemplates[Math.floor(Math.random() * enemyTemplates.length)];
  const level = generateEnemyLevel(playerLevel);
  const stats = calculateEnemyStats(template, level);
  const equipment = generateEnemyEquipment(template, level);
  
  // Применяем бонусы экипировки к статам
  applyEquipmentStats(stats, equipment);
  
  return {
    id: template.id + '_' + Date.now() + '_' + Math.random(),
    name: template.name,
    level,
    template: template,
    stats,
    equipment,
    currentHP: stats.HP,
    xp: stats.xp
  };
}

function generateEnemyLevel(playerLevel) {
  // Уровень: от playerLevel-2 до playerLevel+2, минимум 1
  const min = Math.max(1, playerLevel - 2);
  const max = playerLevel + 2;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateEnemyStats(template, level) {
  const stats = { ...template.baseStats };
  
  if (level > 1) {
    const levelsAbove = level - 1;
    for (const key of Object.keys(template.levelUps)) {
      if (key === 'xp') continue;
      const increase = stats[key] * (template.levelUps[key] / 100) * levelsAbove;
      stats[key] = Math.round(stats[key] + increase);
    }
    const xpIncrease = stats.xp * (template.levelUps.xp / 100) * levelsAbove;
    stats.xp = Math.round(stats.xp + xpIncrease);
  }
  
  // Урон врага = базовый урон + сила
  stats.DAMAGE_MIN = stats.DAMAGE_MIN + stats.STR;
  stats.DAMAGE_MAX = stats.DAMAGE_MAX + stats.STR;
  
  return stats;
}

function generateEnemyEquipment(template, level) {
  const equipment = {};
  const allItems = getAllItems();
  const eligibleItems = allItems.filter(item => {
    // Без оружия
    if (!item.slots || item.slots.includes('weapon')) return false;
    // Слоты, доступные этому типу врага
    return item.slots.some(slot => template.equipSlots.includes(slot));
  });
  
  // Шанс надетой экипировки зависит от уровня
  const equipChance = Math.min(0.7, 0.2 + level * 0.05);
  
  for (const slot of template.equipSlots) {
    if (Math.random() < equipChance) {
      const slotItems = eligibleItems.filter(item => item.slots.includes(slot));
      if (slotItems.length > 0) {
        const item = slotItems[Math.floor(Math.random() * slotItems.length)];
        equipment[slot + '-0'] = item.id;
      }
    }
  }
  
  return equipment;
}

function applyEquipmentStats(stats, equipment) {
  const countedTwoHanded = new Set();
  
  for (const [key, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;
    const item = getItemById(itemId);
    if (!item?.properties) continue;
    
    for (const [prop, value] of Object.entries(item.properties)) {
      if (prop === 'DAMAGE_MIN' || prop === 'DAMAGE_MAX' || prop === 'CAPACITY') continue;
      if (stats.hasOwnProperty(prop)) {
        stats[prop] += value;
      }
    }
  }
}

export function generateEnemyCount(playerLevel) {
  // От 1 до 3 противников, с ростом уровня — больше шанс на 2-3
  const rand = Math.random();
  if (playerLevel <= 3) {
    return rand < 0.6 ? 1 : 2;
  } else if (playerLevel <= 6) {
    return rand < 0.3 ? 1 : (rand < 0.8 ? 2 : 3);
  } else {
    return rand < 0.15 ? 1 : (rand < 0.6 ? 2 : 3);
  }
}