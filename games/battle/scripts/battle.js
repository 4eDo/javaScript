import { loadEnemyTemplates, generateEnemy, generateEnemyCount } from './enemy.js';
import { randomMessage } from './battleMessages.js';
import { getItemById, getAllItems } from './itemsDB.js';
import * as ui from './ui.js';

let battleState = null;
let playerCharacter = null;

export function setupBattle(character) {
  playerCharacter = character;
  showIdleState();
}

function showIdleState() {
  battleState = null;
  
  ui.renderEnemyList([], -1, false);
  ui.renderBattleLog('<p class="log-entry log-system">— Ожидание действий —</p>');
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
    
    if (roll < 15) {
      ui.renderEnemyList([], -1, false);
      ui.addBattleLogEntry('Вы осмотрели окрестности, но ничего не нашли.', 'log-system');
      ui.hideEnemyInfo();
      showIdleActions();
      updateStats();
      return;
    }
    
    if (roll < 30) {
      generateEnemies(mode, playerLevel);
      return;
    }
    
    if (roll < 60) {
      const allItems = getAllItems();
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      playerCharacter.addItem(randomItem.id);
      
      ui.renderEnemyList([], -1, false);
      ui.addBattleLogEntry(`Исследуя местность, вы нашли: ${randomItem.name}!`, 'log-system');
      ui.hideEnemyInfo();
      ui.renderAll();
      showIdleActions();
      updateStats();
      return;
    }
    
    if (roll >= 60) {
      // 40% — предмет + враги
      const allItems = getAllItems();
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      generateEnemies(mode, playerLevel, [randomItem.id]);
      ui.addBattleLogEntry(`Вы нашли: ${randomItem.name}, но привлекли внимание врагов!`, 'log-system');
      return;
    }
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
    pendingItems: pendingItems // предметы, которые ждут конца боя
  };
  
  ui.renderEnemyList(enemies, battleState.currentEnemyIndex, false);
  ui.renderBattleLog('<p class="log-entry log-system">— Обнаружены противники! Выберите цель —</p>');
  ui.hideEnemyInfo();
  ui.renderBattleActions('');
  updateStats();
  
  // Вешаем клики на врагов
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
  ui.renderBattleActions('');
  ui.disableEnemyClicks();
  ui.renderEnemyList(battleState.enemies, battleState.currentEnemyIndex, true);
  
  battleState.playerTurn = Math.random() < 0.5;
  
  ui.addBattleLogEntry('— Бой начался —', 'log-system');
  
  autoBattleStep();
}

function autoBattleStep() {
  if (battleState.battleOver) return;
  
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  
  if (enemy.currentHP <= 0) {
    const nextAlive = battleState.enemies.findIndex((e, i) => e.currentHP > 0 && i !== battleState.currentEnemyIndex);
    if (nextAlive === -1) {
      endBattle(true);
      return;
    }
    battleState.currentEnemyIndex = nextAlive;
    ui.renderEnemyList(battleState.enemies, battleState.currentEnemyIndex, true);
    ui.renderEnemyInfo(battleState.enemies[nextAlive]);
    autoBattleStep();
    return;
  }
  
  if (battleState.playerTurn) {
    playerAttack();
  } else {
    enemyAttack();
  }
}

function playerAttack() {
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  const pStats = getPlayerStats();
  
  // Шанс попадания = 100 - (AGI врага / ACC игрока) * 100
  const dodgeChance = pStats.ACC > 0 ? (enemy.stats.AGI / pStats.ACC) * 100 : 100;
  const hitChance = Math.max(5, 100 - dodgeChance);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    const msg = randomMessage('dodge')
      .replace('{defender}', enemy.name)
      .replace('{attacker}', 'Вы');
    ui.addBattleLogEntry(msg, 'log-system');
    updateStats();
    ui.renderEnemyInfo(enemy);
    finishPlayerTurn();
    return;
  }
  
  // Урон = случайный в диапазоне DAMAGE_MIN..DAMAGE_MAX + бонус силы
  const baseDamage = Math.floor(Math.random() * (pStats.DAMAGE_MAX - pStats.DAMAGE_MIN + 1)) + pStats.DAMAGE_MIN;
  const strBonus = pStats.STR;
  let rawDamage = baseDamage + strBonus;
  
  // Защита врага поглощает часть урона
  const blocked = Math.min(enemy.stats.DEF || 0, rawDamage);
  let damage = Math.max(1, rawDamage - blocked);
  
  enemy.currentHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', 'Вы')
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    ui.addBattleLogEntry(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', 'Вы')
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage);
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
  
  // Регенерация игрока — раз в ход врага
  if (pStats.REG > 0 && battleState.playerHP < battleState.playerMaxHP) {
    const regenAmount = Math.min(pStats.REG, battleState.playerMaxHP - battleState.playerHP);
    battleState.playerHP += regenAmount;
    const msg = randomMessage('regen')
      .replace('{name}', 'Вы')
      .replace('{amount}', regenAmount);
    ui.addBattleLogEntry(msg, 'log-system');
  }
  
  // Шанс попадания = 100 - (AGI игрока / ACC врага) * 100
  const dodgeChance = enemy.stats.ACC > 0 ? (pStats.AGI / enemy.stats.ACC) * 100 : 100;
  const hitChance = Math.max(5, 100 - dodgeChance);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    const msg = randomMessage('dodge')
      .replace('{defender}', 'Вы')
      .replace('{attacker}', enemy.name);
    ui.addBattleLogEntry(msg, 'log-system');
    updateStats();
    finishEnemyTurn();
    return;
  }
  
  // Урон врага
  const baseDamage = Math.floor(Math.random() * (enemy.stats.DAMAGE_MAX - enemy.stats.DAMAGE_MIN + 1)) + enemy.stats.DAMAGE_MIN;
  const strBonus = enemy.stats.STR;
  let rawDamage = baseDamage + strBonus;
  
  // Защита игрока поглощает часть урона
  const blocked = Math.min(pStats.DEF || 0, rawDamage);
  let damage = Math.max(1, rawDamage - blocked);
  
  battleState.playerHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', 'Вас')
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    ui.addBattleLogEntry(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', 'Вас')
      .replace('{damage}', damage);
    ui.addBattleLogEntry(msg);
  }
  
  if (battleState.playerHP <= 0) {
    battleState.playerHP = 0;
    ui.addBattleLogEntry('Вы пали в бою...');
    endBattle(false);
    return;
  }
  
  updateStats();
  finishEnemyTurn();
}

function finishPlayerTurn() {
  battleState.playerTurn = false;
  if (!battleState.battleOver) {
    setTimeout(() => autoBattleStep(), 700);
  }
}

function finishEnemyTurn() {
  battleState.playerTurn = true;
  if (!battleState.battleOver) {
    setTimeout(() => autoBattleStep(), 700);
  }
}

function endBattle(victory) {
  battleState.battleOver = true;
  battleState.isFighting = false;
  
  if (victory) {
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

  // Добавляем отложенные предметы
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
  if (!battleState || battleState.battleOver || battleState.isFighting) return;
  
  battleState.battleOver = true;
  
  let totalXP = 0;
  for (const enemy of battleState.enemies) {
    totalXP += Math.round(enemy.stats.xp * 0.3);
  }
  
  playerCharacter.addXP(totalXP);
  ui.renderAll();
  ui.showBattleResult('Побег!', `Вы сбежали с поля боя.\nПолучено опыта: ${totalXP} (30% от возможного).`);
  
  setTimeout(() => {
    showIdleState();
  }, 2000);
}

function getPlayerStats() {
  const base = playerCharacter.getStats();
  const mod = battleState ? battleState.statModifier : 1;
  
  return {
    ...base,
    HP: base.HP,
    STR: Math.round(base.STR * mod * 10) / 10,
    CON: Math.round(base.CON * mod * 10) / 10,
    AGI: Math.round(base.AGI * mod * 10) / 10,
    REG: base.REG,
    ACC: Math.round(base.ACC * mod * 10) / 10,
    DEF: Math.round((base.DEF || 0) * mod),
    DAMAGE_MIN: Math.round((base.DAMAGE_MIN || 1) * mod),
    DAMAGE_MAX: Math.round((base.DAMAGE_MAX || 5) * mod)
  };
}

function updateStats() {
  const stats = getPlayerStats();
  const currentHP = battleState ? battleState.playerHP : stats.HP;
  const maxHP = stats.HP;
  
  ui.updateBattleHP(currentHP, maxHP);
  ui.renderStats();
}