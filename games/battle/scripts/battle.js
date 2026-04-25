import { loadEnemyTemplates, generateEnemy, generateEnemyCount } from './enemy.js';
import { randomMessage, getRandomEquip } from './battleMessages.js';
import { getItemById, getAllItems } from './itemsDB.js';
import * as ui from './ui.js';
import { CONFIG } from './config.js';

let battleState = null;
let playerCharacter = null;

export function setupBattle(character) {
  playerCharacter = character;
  showIdleState();
}

function showIdleState() {
  battleState = null;
  
  ui.enableAllTabs();
  ui.updateActiveEffects([]);
  
  ui.renderEnemyList([], -1, false);
  ui.hideEnemyInfo();
  
  const stats = getPlayerStats();
  ui.updateBattleHP(stats.HP, stats.HP);
  ui.renderStats();
  
  ui.renderBattleActions(`
    <button id="btn-search">Искать врагов</button>
    <button id="btn-explore">Исследовать окрестности</button>
  `);
  
  document.getElementById('btn-search').addEventListener('click', () => startEncounter('search'));
  document.getElementById('btn-explore').addEventListener('click', () => startEncounter('explore'));
}

function startEncounter(mode) {
  const stats = getPlayerStats();
  const playerLevel = stats.level;
  
  if (mode === 'explore') {
    const roll = Math.random() * 100;
    
    if (roll < CONFIG.EXPLORE_CHANCE_ENEMIES) {
      generateEnemies(mode, playerLevel);
      return;
    }
    
    if (roll < CONFIG.EXPLORE_CHANCE_ENEMIES + CONFIG.EXPLORE_CHANCE_ITEM) {
      const allItems = getAllItems();
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      playerCharacter.addItem(randomItem.id);
      
      ui.renderEnemyList([], -1, false);
      ui.addBattleLogEntry(randomMessage('found_item').replace('{item}', randomItem.name), 'log-system');
      ui.hideEnemyInfo();
      ui.renderAll();
      showIdleActions();
      updateStats();
      return;
    }
    
    if (roll < CONFIG.EXPLORE_CHANCE_ENEMIES + CONFIG.EXPLORE_CHANCE_ITEM + CONFIG.EXPLORE_CHANCE_ITEM_AND_ENEMIES) {
      const allItems = getAllItems();
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      generateEnemies(mode, playerLevel, [randomItem.id]);
      ui.addBattleLogEntry(randomMessage('found_item_enemies').replace('{item}', randomItem.name), 'log-system');
      return;
    }
    
    // Остаток — пусто
    ui.renderEnemyList([], -1, false);
    ui.addBattleLogEntry(randomMessage('nothing_found'), 'log-system');
    ui.hideEnemyInfo();
    showIdleActions();
    updateStats();
    return;
  }
  
  generateEnemies(mode, playerLevel);
}

function showIdleActions() {
  ui.renderBattleActions(`
    <button id="btn-search">Искать врагов</button>
    <button id="btn-explore">Исследовать окрестности</button>
  `);
  
  document.getElementById('btn-search').addEventListener('click', () => startEncounter('search'));
  document.getElementById('btn-explore').addEventListener('click', () => startEncounter('explore'));
}

function generateEnemies(mode, playerLevel, pendingItems = []) {
  const enemyCount = generateEnemyCount(playerLevel);
  const enemies = [];
  
  for (let i = 0; i < enemyCount; i++) {
    enemies.push(generateEnemy(playerLevel));
  }
  
  const stats = getPlayerStats();
  
  battleState = {
    mode,
    enemies,
    currentEnemyIndex: -1,
    battleOver: false,
    playerHP: stats.HP,
    playerMaxHP: stats.HP,
    statModifier: mode === 'explore' ? 0.9 : 1.1,
    isFighting: false,
    pendingItems: pendingItems,
    battleStarted: false,
    turn: 0,
    missStreak: 0,
    hitStreak: 0,
    lastEvent: null,
    activeEffects: [],
    usedConsumables: new Set()
  };
  
  ui.disableCharacterTab();
  ui.updateActiveEffects([]);
  
  ui.renderEnemyList(enemies, battleState.currentEnemyIndex, false);
  ui.addBattleLogEntry(randomMessage('enemy_spotted'), 'log-system');
  ui.hideEnemyInfo();
  ui.renderBattleActions(`
    <button id="btn-flee">Убежать</button>
  `);
  
  document.getElementById('btn-flee').addEventListener('click', () => fleeBattle());
  
  updateStats();
  
  document.querySelectorAll('.enemy').forEach(entry => {
    entry.addEventListener('click', () => {
      const index = parseInt(entry.dataset.index);
      if (battleState.enemies[index].currentHP > 0 && !battleState.isFighting) {
        selectEnemy(index);
      }
    });
  });
}

function selectEnemy(index) {
  if (!battleState || battleState.battleOver || battleState.isFighting) return;
  
  battleState.currentEnemyIndex = index;
  const enemy = battleState.enemies[index];
  
  ui.highlightEnemy(index);
  ui.renderEnemyInfo(enemy);
  
  ui.renderBattleActions(`
    <button id="btn-attack">Атаковать</button>
    <button id="btn-flee">Убежать</button>
  `);
  
  document.getElementById('btn-attack').addEventListener('click', () => startAutoBattle());
  document.getElementById('btn-flee').addEventListener('click', () => fleeBattle());
  
  updateStats();
}

function startAutoBattle() {
  if (!battleState || battleState.battleOver) return;
  if (battleState.enemies[battleState.currentEnemyIndex].currentHP <= 0) return;
  
  battleState.isFighting = true;
  battleState.battleStarted = true;
  
  ui.renderBattleActions(`
    <button id="btn-flee">Убежать</button>
  `);
  
  document.getElementById('btn-flee').addEventListener('click', () => fleeBattle());
  
  ui.disableEnemyClicks();
  ui.renderEnemyList(battleState.enemies, battleState.currentEnemyIndex, true);
  
  battleState.playerTurn = Math.random() < 0.5;
  battleState.turn = 0;
  
  ui.addBattleLogEntry(randomMessage('battle_start'), 'log-system');
  
  autoBattleStep();
}

function autoBattleStep() {
  if (battleState.battleOver) return;
  
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  
  if (enemy.currentHP <= 0) {
    battleState.isFighting = false;
    ui.renderEnemyList(battleState.enemies, -1, false);
    ui.hideEnemyInfo();
    ui.addBattleLogEntry(randomMessage('enemy_defeated'), 'log-system');
    
    document.querySelectorAll('.enemy').forEach(entry => {
      entry.style.pointerEvents = 'auto';
      const index = parseInt(entry.dataset.index);
      if (battleState.enemies[index].currentHP > 0) {
        entry.addEventListener('click', () => selectEnemy(index));
      }
    });
    
    ui.renderBattleActions(`
      <button id="btn-flee">Убежать</button>
    `);
    document.getElementById('btn-flee').addEventListener('click', () => fleeBattle());
    
    const allDead = battleState.enemies.every(e => e.currentHP <= 0);
    if (allDead) {
      endBattle(true);
      return;
    }
    
    updateStats();
    return;
  }
  
  if (battleState.playerTurn) {
    checkConsumables();
    playerAttack();
  } else {
    enemyAttack();
  }
}

function playerAttack() {
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  const pStats = getPlayerStats();
  
  const dodgeChance = enemy.stats.ACC > 0 ? (enemy.stats.AGI / pStats.ACC) * 100 : 0;
  const hitChance = Math.max(5, 100 - dodgeChance);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    battleState.missStreak++;
    battleState.hitStreak = 0;
    battleState.lastEvent = 'player_miss';
    
    const msg = randomMessage('dodge')
      .replace('{defender}', enemy.name)
      .replace('{attacker}', CONFIG.PLAYER_NAME);
    ui.addBattleLogEntry(msg, 'log-system');
    updateStats();
    ui.renderEnemyInfo(enemy);
    finishPlayerTurn();
    return;
  }
  
  battleState.missStreak = 0;
  battleState.hitStreak++;
  battleState.lastEvent = 'player_hit';
  
  const baseDamage = Math.floor(Math.random() * (pStats.DAMAGE_MAX - pStats.DAMAGE_MIN + 1)) + pStats.DAMAGE_MIN;
  
  const blocked = Math.min(enemy.stats.DEF || 0, baseDamage);
  let damage = Math.max(1, baseDamage - blocked);
  
  enemy.currentHP -= damage;
  
  const randomEquip = getRandomEquip(playerCharacter);
  const equipName = randomEquip ? getItemById(randomEquip)?.name || '' : '';
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', CONFIG.PLAYER_NAME)
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage)
      .replace('{blocked}', blocked)
      .replace('{equip}', equipName);
    ui.addBattleLogEntry(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', CONFIG.PLAYER_NAME)
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage)
      .replace('{equip}', equipName);
    ui.addBattleLogEntry(msg);
  }
  
  if (enemy.currentHP <= 0) {
    enemy.currentHP = 0;
    const deathMsg = randomMessage('death').replace('{name}', enemy.name);
    ui.addBattleLogEntry(deathMsg);
  }
  
  ui.renderEnemyList(battleState.enemies, battleState.currentEnemyIndex, true);
  ui.renderEnemyInfo(enemy);
  updateStats();
  finishPlayerTurn();
}

function enemyAttack() {
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  const pStats = getPlayerStats();
  
  if (pStats.REG > 0 && battleState.playerHP < battleState.playerMaxHP) {
    const regenAmount = Math.min(pStats.REG, battleState.playerMaxHP - battleState.playerHP);
    battleState.playerHP += regenAmount;
    const msg = randomMessage('regen')
      .replace('{name}', CONFIG.PLAYER_NAME)
      .replace('{amount}', regenAmount);
    ui.addBattleLogEntry(msg, 'log-system');
  }
  
  const dodgeChance = enemy.stats.ACC > 0 ? (pStats.AGI / enemy.stats.ACC) * 100 : 0;
  const hitChance = Math.max(5, 100 - dodgeChance);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    battleState.lastEvent = 'player_dodge';
    
    const msg = randomMessage('dodge')
      .replace('{defender}', CONFIG.PLAYER_NAME)
      .replace('{attacker}', enemy.name);
    ui.addBattleLogEntry(msg, 'log-system');
    updateStats();
    finishEnemyTurn();
    return;
  }
  
  battleState.lastEvent = 'enemy_hit';
  
  const baseDamage = Math.floor(Math.random() * (enemy.stats.DAMAGE_MAX - enemy.stats.DAMAGE_MIN + 1)) + enemy.stats.DAMAGE_MIN;
  
  const blocked = Math.min(pStats.DEF || 0, baseDamage);
  let damage = Math.max(1, baseDamage - blocked);
  
  battleState.playerHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', CONFIG.PLAYER_NAME)
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    ui.addBattleLogEntry(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', CONFIG.PLAYER_NAME)
      .replace('{damage}', damage);
    ui.addBattleLogEntry(msg);
  }
  
  if (battleState.playerHP <= 0) {
    battleState.playerHP = 0;
    const msg = randomMessage('player_death').replace('{name}', CONFIG.PLAYER_NAME);
    ui.addBattleLogEntry(msg);
    endBattle(false);
    return;
  }
  
  updateStats();
  finishEnemyTurn();
}

function finishPlayerTurn() {
  battleState.playerTurn = false;
  battleState.turn++;
  
  tickActiveEffects();
  
  if (!battleState.battleOver && battleState.isFighting) {
    setTimeout(() => autoBattleStep(), 700);
  }
}

function finishEnemyTurn() {
  battleState.playerTurn = true;
  
  if (!battleState.battleOver && battleState.isFighting) {
    setTimeout(() => autoBattleStep(), 700);
  }
}

function tickActiveEffects() {
  battleState.activeEffects = battleState.activeEffects.filter(effect => {
    if (effect.remaining === Infinity) return true;
    effect.remaining--;
    return effect.remaining > 0;
  });
  
  ui.updateActiveEffects(battleState.activeEffects);
}

function checkConsumables() {
  if (!battleState || battleState.battleOver) return;
  
  const consumableSlots = Object.entries(playerCharacter.equipment)
    .filter(([key, itemId]) => key.startsWith('consumable-') && itemId);
  
  for (const [slotKey, itemId] of consumableSlots) {
    if (battleState.usedConsumables.has(slotKey)) continue;
    
    const item = getItemById(itemId);
    if (!item?.usage) continue;
    
    const enemy = battleState.enemies[battleState.currentEnemyIndex];
    const pStats = getPlayerStats();
    
    if (checkTrigger(item.usage.trigger, battleState, pStats, enemy)) {
      applyConsumable(slotKey, item);
      break;
    }
  }
}

function checkTrigger(trigger, state, pStats, enemy) {
  const { target, val, op = 'eq' } = trigger;
  
  switch (target) {
    case 'hp':
      return compare(state.playerHP, val, op);
    case 'hp_pct':
      return compare((state.playerHP / state.playerMaxHP) * 100, val, op);
    case 'miss_streak':
      return state.missStreak >= val;
    case 'hit_streak':
      return state.hitStreak >= val;
    case 'enemy_count':
      return compare(state.enemies.filter(e => e.currentHP > 0).length, val, op);
    case 'enemy_level':
      if (!enemy) return false;
      return compare(enemy.level, pStats.level + val, op);
    case 'on_dodge':
      return state.lastEvent === 'player_dodge';
    case 'battle_start':
      return state.turn === 0 && state.battleStarted;
    default:
      return false;
  }
}

function compare(a, b, op) {
  switch (op) {
    case 'eq': return a === b;
    case 'lt': return a < b;
    case 'gt': return a > b;
    case 'lte': return a <= b;
    case 'gte': return a >= b;
    default: return false;
  }
}

function applyConsumable(slotKey, item) {
  const { duration, stats } = item.usage;
  
  if (duration === 0) {
    if (stats.HP) {
      const healed = Math.min(stats.HP, battleState.playerMaxHP - battleState.playerHP);
      battleState.playerHP += healed;
      
      const msg = randomMessage('consumable_instant')
        .replace('{name}', CONFIG.PLAYER_NAME)
        .replace('{item}', item.name)
        .replace('{value}', healed);
      ui.addBattleLogEntry(msg, 'log-system');
    }
  } else {
    battleState.activeEffects.push({
      name: item.name,
      stats: { ...stats },
      remaining: duration === 'battle' ? Infinity : duration
    });
    
    const durText = duration === 'battle' ? 'весь бой' : `${duration} ход(ов)`;
    const msgCategory = duration === 'battle' ? 'consumable_effect_battle' : 'consumable_effect';
    const msg = randomMessage(msgCategory)
      .replace('{name}', CONFIG.PLAYER_NAME)
      .replace('{item}', item.name)
      .replace('{duration}', durText);
    ui.addBattleLogEntry(msg, 'log-system');
  }
  
  delete playerCharacter.equipment[slotKey];
  battleState.usedConsumables.add(slotKey);
  
  ui.updateActiveEffects(battleState.activeEffects);
  ui.renderAll();
  updateStats();
}

function endBattle(victory) {
  battleState.battleOver = true;
  battleState.isFighting = false;
  battleState.activeEffects = [];
  
  ui.enableAllTabs();
  ui.updateActiveEffects([]);
  
  if (victory) {
    ui.addBattleLogEntry(randomMessage('all_enemies_defeated'), 'log-system');
    giveRewards();
  } else {
    const lostXP = playerCharacter.xp || 0;
    playerCharacter.xp = 0;
    ui.showBattleResult('Поражение!', `Вы пали в бою. Потеряно опыта: ${lostXP}. Уровень сохранён.`);
  }
  
  setTimeout(() => {
    showIdleState();
  }, 2000);
}

function giveRewards() {
  let totalXP = 0;
  const droppedItems = [];
  
  for (const enemy of battleState.enemies) {
    totalXP += enemy.stats.xp;
    
    if (enemy.equipment) {
      for (const [slotKey, itemId] of Object.entries(enemy.equipment)) {
        const item = getItemById(itemId);
        if (!item) continue;
        
        const baseChance = enemy.template.dropChance;
        const levelPenalty = 1 - (item.level * 0.1);
        const dropChance = Math.max(0.02, baseChance * levelPenalty);
        
        if (Math.random() < dropChance) {
          droppedItems.push(itemId);
        }
      }
    }
  }
  
  if (battleState.pendingItems && battleState.pendingItems.length > 0) {
    battleState.pendingItems.forEach(id => playerCharacter.addItem(id));
  }
  
  playerCharacter.addXP(totalXP);
  droppedItems.forEach(id => playerCharacter.addItem(id));
  ui.renderAll();
  
  let msg = `Все противники повержены!\nПолучено опыта: ${totalXP}.`;
  if (droppedItems.length > 0) {
    msg += `\nДобыча: ${droppedItems.map(id => {
      const item = getItemById(id);
      return item ? item.name : id;
    }).join(', ')}.`;
  }
  
  ui.showBattleResult('Победа!', msg);
  ui.updateXPBar();
}

function fleeBattle() {
  if (!battleState || battleState.battleOver) return;
  
  battleState.battleOver = true;
  battleState.isFighting = false;
  battleState.activeEffects = [];
  
  ui.enableAllTabs();
  ui.updateActiveEffects([]);
  
  ui.addBattleLogEntry(randomMessage('flee'), 'log-system');
  
  // 30% опыта от ПОВЕРЖЕННЫХ врагов
  let totalXP = 0;
  const defeatedEnemies = battleState.enemies.filter(e => e.currentHP <= 0);
  
  for (const enemy of defeatedEnemies) {
    totalXP += Math.round(enemy.stats.xp * (CONFIG.FLEE_XP_PERCENT / 100));
  }
  
  // Шанс 30% на одну случайную вещь с поверженных врагов
  let droppedItem = null;
  if (defeatedEnemies.length > 0 && Math.random() * 100 < CONFIG.FLEE_ITEM_CHANCE) {
    const allDrops = [];
    
    for (const enemy of defeatedEnemies) {
      if (enemy.equipment) {
        for (const [slotKey, itemId] of Object.entries(enemy.equipment)) {
          const item = getItemById(itemId);
          if (item) {
            allDrops.push({ itemId, item, enemyName: enemy.name });
          }
        }
      }
      // Также проверяем pendingItems, если враг был из исследования
      if (battleState.pendingItems && battleState.pendingItems.length > 0) {
        for (const id of battleState.pendingItems) {
          const item = getItemById(id);
          if (item) {
            allDrops.push({ itemId: id, item, enemyName: 'тайника' });
          }
        }
      }
    }
    
    if (allDrops.length > 0) {
      const randomDrop = allDrops[Math.floor(Math.random() * allDrops.length)];
      droppedItem = randomDrop;
      playerCharacter.addItem(droppedItem.itemId);
    }
  }
  
  playerCharacter.addXP(totalXP);
  ui.renderAll();
  
  let msg = `Вы сбежали с поля боя.\n`;
  if (totalXP > 0) {
    msg += `Получено опыта: ${totalXP} (${CONFIG.FLEE_XP_PERCENT}% от поверженных врагов).\n`;
  }
  if (droppedItem) {
    msg += `Успели подобрать: ${droppedItem.item.name}.`;
  } else if (defeatedEnemies.length > 0) {
    msg += `Ничего не успели подобрать.`;
  } else {
    msg += `Ни одного врага не повержено — наград нет.`;
  }
  
  ui.showBattleResult('Побег!', msg);
  
  setTimeout(() => {
    showIdleState();
  }, 2000);
}

function getPlayerStats() {
  const base = playerCharacter.getStats();
  const mod = battleState ? battleState.statModifier : 1;
  
  let stats = {
    ...base,
    STR: Math.round(base.STR * mod * 10) / 10,
    CON: Math.round(base.CON * mod * 10) / 10,
    AGI: Math.round(base.AGI * mod * 10) / 10,
    REG: base.REG,
    ACC: Math.round(base.ACC * mod * 10) / 10,
    DEF: Math.round((base.DEF || 0) * mod),
    DAMAGE_MIN: Math.round((base.DAMAGE_MIN || 1) * mod),
    DAMAGE_MAX: Math.round((base.DAMAGE_MAX || 5) * mod)
  };
  
  if (battleState && battleState.activeEffects) {
    for (const effect of battleState.activeEffects) {
      for (const [key, value] of Object.entries(effect.stats)) {
        if (stats.hasOwnProperty(key)) {
          stats[key] += value;
        }
      }
    }
  }
  
  return stats;
}

function updateStats() {
  const stats = getPlayerStats();
  const currentHP = battleState ? battleState.playerHP : stats.HP;
  const maxHP = stats.HP;
  
  ui.updateBattleHP(currentHP, maxHP);
  ui.renderStats();
}