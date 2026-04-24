import { loadEnemyTemplates, generateEnemy, generateEnemyCount } from './enemy.js';
import { randomMessage } from './battleMessages.js';
import { getItemById } from './itemsDB.js';

let battleState = null;
let player = null;
let playerCharacter = null;
let ui = null;
let onBattleEnd = null;

let enemyListEl, battleLogEl, battleActionsEl, enemyInfoEl;
let resultTitle, resultText, modalResult;

export function setupBattle(character, uiModule) {
  playerCharacter = character;
  ui = uiModule;
  
  enemyListEl = document.getElementById('enemy-list');
  battleLogEl = document.getElementById('battle-log');
  battleActionsEl = document.getElementById('battle-actions');
  enemyInfoEl = document.getElementById('enemy-info');
  resultTitle = document.getElementById('result-title');
  resultText = document.getElementById('result-text');
  modalResult = document.getElementById('modal-result');
  
  showIdleState();
}

function showIdleState() {
  enemyListEl.innerHTML = '<p style="padding: 10px; font-style: italic;">Противников поблизости нет.</p>';
  battleLogEl.innerHTML = '<p class="log-entry log-system">— Ожидание действий —</p>';
  enemyInfoEl.innerHTML = '';
  enemyInfoEl.style.display = 'none';
  battleActionsEl.innerHTML = `
    <button id="btn-search">Искать врагов</button>
    <button id="btn-explore">Исследовать окрестности</button>
  `;
  
  document.getElementById('btn-search').addEventListener('click', () => startEncounter('search'));
  document.getElementById('btn-explore').addEventListener('click', () => startEncounter('explore'));
}

function startEncounter(mode) {
  const stats = getPlayerStats();
  const playerLevel = stats.level;
  
  // Исследование окрестностей
  if (mode === 'explore') {
    const roll = Math.random() * 100; // 0-100
    
    if (roll < 15) {
      // Ничего не нашли
      enemyListEl.innerHTML = '';
      battleLogEl.innerHTML = '<p class="log-entry log-system">Вы осмотрели окрестности, но ничего не нашли.</p>';
      enemyInfoEl.innerHTML = '';
      enemyInfoEl.style.display = 'none';
      battleActionsEl.innerHTML = `
        <button id="btn-search">Искать врагов</button>
        <button id="btn-explore">Исследовать окрестности</button>
      `;
      document.getElementById('btn-search').addEventListener('click', () => startEncounter('search'));
      document.getElementById('btn-explore').addEventListener('click', () => startEncounter('explore'));
      return;
    }
    
    if (roll < 30) {
      // 15% — только враги
      generateEnemies(mode, playerLevel);
      return;
    }
    
    if (roll < 60) {
      // 30% — только предмет
      const allItems = getAllItems();
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      playerCharacter.addItem(randomItem.id);
      
      enemyListEl.innerHTML = '';
      battleLogEl.innerHTML = `<p class="log-entry log-system">Исследуя местность, вы нашли: ${randomItem.name}!</p>`;
      enemyInfoEl.innerHTML = '';
      enemyInfoEl.style.display = 'none';
      battleActionsEl.innerHTML = `
        <button id="btn-search">Искать врагов</button>
        <button id="btn-explore">Исследовать окрестности</button>
      `;
      document.getElementById('btn-search').addEventListener('click', () => startEncounter('search'));
      document.getElementById('btn-explore').addEventListener('click', () => startEncounter('explore'));
      ui.renderAll();
      return;
    }
    
    // 40% — предмет + враги
    const allItems = getAllItems();
    const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
    playerCharacter.addItem(randomItem.id);
    ui.renderAll();
    generateEnemies(mode, playerLevel);
    addBattleLog(`Вы нашли: ${randomItem.name}, но привлекли внимание врагов!`, 'log-system');
    return;
  }
  
  // Поиск врагов — гарантированно враги
  generateEnemies(mode, playerLevel);
}

import { getAllItems } from './itemsDB.js';

function generateEnemies(mode, playerLevel) {
  const enemyCount = generateEnemyCount(playerLevel);
  const enemies = [];
  
  for (let i = 0; i < enemyCount; i++) {
    enemies.push(generateEnemy(playerLevel));
  }
  
  battleState = {
    mode,
    enemies,
    currentEnemyIndex: -1, // враг не выбран
    battleOver: false,
    playerHP: getPlayerStats().HP,
    playerMaxHP: getPlayerStats().HP,
    statModifier: mode === 'explore' ? 0.9 : 1.1,
    isFighting: false // идёт ли автоматический бой
  };
  
  renderEnemyList();
  battleLogEl.innerHTML = '<p class="log-entry log-system">— Обнаружены противники! Выберите цель —</p>';
  enemyInfoEl.innerHTML = '';
  enemyInfoEl.style.display = 'none';
  battleActionsEl.innerHTML = '';
}

function renderEnemyList() {
  enemyListEl.innerHTML = '';
  battleState.enemies.forEach((enemy, index) => {
    const entry = document.createElement('enemy-entry');
    entry.className = 'enemy';
    if (enemy.currentHP <= 0) entry.classList.add('dead');
    entry.dataset.index = index;
    entry.innerHTML = `
      <span class="enemy-name">${enemy.name} [ур.${enemy.level}]</span>
      <span class="enemy-hp">${enemy.currentHP}/${enemy.stats.HP}</span>
    `;
    
    if (enemy.currentHP > 0 && !battleState.isFighting) {
      entry.addEventListener('click', () => selectEnemy(index));
    }
    
    // Подсветка текущего врага во время боя
    if (index === battleState.currentEnemyIndex && battleState.isFighting) {
      entry.style.outline = '2px solid #000';
    }
    
    enemyListEl.appendChild(entry);
  });
}

function selectEnemy(index) {
  if (battleState.battleOver || battleState.isFighting) return;
  
  battleState.currentEnemyIndex = index;
  const enemy = battleState.enemies[index];
  
  // Показываем информацию о враге
  renderEnemyInfo(enemy);
  
  // Подсветка
  document.querySelectorAll('.enemy').forEach(e => e.style.outline = '');
  document.querySelector(`.enemy[data-index="${index}"]`).style.outline = '2px solid #000';
  
  // Кнопки действий
  battleActionsEl.innerHTML = `
    <button id="btn-attack">Атаковать</button>
    <button id="btn-flee">Убежать</button>
  `;
  document.getElementById('btn-attack').addEventListener('click', () => startAutoBattle());
  document.getElementById('btn-flee').addEventListener('click', () => fleeBattle());
}

function renderEnemyInfo(enemy) {
  enemyInfoEl.style.display = 'block';
  enemyInfoEl.innerHTML = `
    <h3 style="margin-bottom: 8px;">${enemy.name} [уровень ${enemy.level}]</h3>
    <dl style="display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 12px;">
      <dt>HP</dt><dd>${enemy.currentHP}/${enemy.stats.HP}</dd>
      <dt>Сила</dt><dd>${enemy.stats.STR}</dd>
      <dt>Стойкость</dt><dd>${enemy.stats.CON}</dd>
      <dt>Ловкость</dt><dd>${enemy.stats.AGI}</dd>
      <dt>Меткость</dt><dd>${enemy.stats.ACC}</dd>
      <dt>Защита</dt><dd>${enemy.stats.DEF}</dd>
      <dt>Урон</dt><dd>${enemy.stats.DAMAGE_MIN}-${enemy.stats.DAMAGE_MAX}</dd>
      <dt>Опыт</dt><dd>${enemy.stats.xp}</dd>
    </dl>
    ${enemy.equipment && Object.keys(enemy.equipment).length > 0 ? `
      <p style="margin-top: 6px; font-size: 11px; font-weight: bold;">Экипировка:</p>
      <ul style="font-size: 11px; padding-left: 15px;">
        ${Object.entries(enemy.equipment).map(([slot, itemId]) => {
          const item = getItemById(itemId);
          return `<li>${slot}: ${item ? item.name : itemId}</li>`;
        }).join('')}
      </ul>
    ` : ''}
  `;
}

function startAutoBattle() {
  if (!battleState || battleState.battleOver) return;
  if (battleState.enemies[battleState.currentEnemyIndex].currentHP <= 0) return;
  
  battleState.isFighting = true;
  battleActionsEl.innerHTML = '';
  
  // Убираем клики с врагов
  document.querySelectorAll('.enemy').forEach(e => {
    e.style.pointerEvents = 'none';
  });
  
  // Кто ходит первым — случайно
  battleState.playerTurn = Math.random() < 0.5;
  
  addBattleLog('— Бой начался —', 'log-system');
  
  autoBattleStep();
}

function autoBattleStep() {
  if (battleState.battleOver) return;
  
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  
  // Если текущий враг мёртв — ищем следующего живого
  if (enemy.currentHP <= 0) {
    const nextAlive = battleState.enemies.findIndex((e, i) => e.currentHP > 0 && i !== battleState.currentEnemyIndex);
    if (nextAlive === -1) {
      // Все мертвы
      endBattle(true);
      return;
    }
    battleState.currentEnemyIndex = nextAlive;
    renderEnemyList();
    renderEnemyInfo(battleState.enemies[nextAlive]);
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
  
  const hitChance = Math.max(10, pStats.ACC - enemy.stats.AGI * 2);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    const msg = randomMessage('dodge')
      .replace('{defender}', enemy.name)
      .replace('{attacker}', 'Вы');
    addBattleLog(msg, 'log-system');
    finishPlayerTurn();
    return;
  }
  
  const baseDamage = Math.floor(Math.random() * (pStats.DAMAGE_MAX - pStats.DAMAGE_MIN + 1)) + pStats.DAMAGE_MIN;
  const strBonus = Math.floor(pStats.STR * 0.5);
  let rawDamage = baseDamage + strBonus;
  
  const blocked = Math.min(enemy.stats.DEF || 0, Math.floor(rawDamage * 0.7));
  let damage = rawDamage - blocked;
  
  if (enemy.stats.damageReduce) {
    damage = Math.round(damage * (1 - (enemy.stats.damageReduce || 0) / 100));
  }
  
  damage = Math.max(1, damage);
  enemy.currentHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', 'Вы')
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    addBattleLog(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', 'Вы')
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage);
    addBattleLog(msg);
  }
  
  if (enemy.currentHP <= 0) {
    enemy.currentHP = 0;
    const deathMsg = randomMessage('death').replace('{name}', enemy.name);
    addBattleLog(deathMsg);
  }
  
  renderEnemyList();
  renderEnemyInfo(enemy);
  finishPlayerTurn();
}

function enemyAttack() {
  const enemy = battleState.enemies[battleState.currentEnemyIndex];
  const pStats = getPlayerStats();
  
  // Регенерация игрока
  if (pStats.REG > 0 && battleState.playerHP < battleState.playerMaxHP) {
    const regenAmount = Math.min(pStats.REG, battleState.playerMaxHP - battleState.playerHP);
    battleState.playerHP += regenAmount;
    const msg = randomMessage('regen')
      .replace('{name}', 'Вы')
      .replace('{amount}', regenAmount);
    addBattleLog(msg, 'log-system');
  }
  
  const hitChance = Math.max(10, enemy.stats.ACC - (pStats.dodge || 0));
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    const msg = randomMessage('dodge')
      .replace('{defender}', 'Вы')
      .replace('{attacker}', enemy.name);
    addBattleLog(msg, 'log-system');
    finishEnemyTurn();
    return;
  }
  
  const baseDamage = Math.floor(Math.random() * (enemy.stats.DAMAGE_MAX - enemy.stats.DAMAGE_MIN + 1)) + enemy.stats.DAMAGE_MIN;
  const strBonus = Math.floor(enemy.stats.STR * 0.5);
  let rawDamage = baseDamage + strBonus;
  
  const blocked = Math.min(pStats.DEF || 0, Math.floor(rawDamage * 0.7));
  let damage = rawDamage - blocked;
  
  if (pStats.damageReduce) {
    damage = Math.round(damage * (1 - (pStats.damageReduce || 0) / 100));
  }
  
  damage = Math.max(1, damage);
  battleState.playerHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', 'Вас')
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    addBattleLog(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', 'Вас')
      .replace('{damage}', damage);
    addBattleLog(msg);
  }
  
  if (battleState.playerHP <= 0) {
    battleState.playerHP = 0;
    addBattleLog('Вы пали в бою...');
    endBattle(false);
    return;
  }
  
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
    // Смерть — потеря всего опыта
    const lostXP = playerCharacter.xp || 0;
    playerCharacter.xp = 0;
    
    resultTitle.textContent = 'Поражение!';
    resultText.textContent = `Вы пали в бою. Потеряно опыта: ${lostXP}. Уровень сохранён.`;
    modalResult.classList.add('open');
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
  
  // Начисление опыта
  playerCharacter.addXP(totalXP);
  
  // Добавление предметов в инвентарь
  droppedItems.forEach(id => playerCharacter.addItem(id));
  
  // Обновление UI
  ui.renderAll();
  
  resultTitle.textContent = 'Победа!';
  let msg = `Все противники повержены!\nПолучено опыта: ${totalXP}.`;
  if (droppedItems.length > 0) {
    msg += `\nДобыча: ${droppedItems.map(id => {
      const item = getItemById(id);
      return item ? item.name : id;
    }).join(', ')}.`;
  }
  resultText.textContent = msg;
  modalResult.classList.add('open');
  
  // Обновляем шкалу опыта в UI
  if (typeof ui.updateXPBar === 'function') {
    ui.updateXPBar();
  }
}

function fleeBattle() {
  if (!battleState || battleState.battleOver || battleState.isFighting) return;
  
  battleState.battleOver = true;
  
  // Считаем награды: 30% опыта, без предметов
  let totalXP = 0;
  for (const enemy of battleState.enemies) {
    totalXP += Math.round(enemy.stats.xp * 0.3);
  }
  
  playerCharacter.addXP(totalXP);
  ui.renderAll();
  
  resultTitle.textContent = 'Побег!';
  resultText.textContent = `Вы сбежали с поля боя.\nПолучено опыта: ${totalXP} (30% от возможного).`;
  modalResult.classList.add('open');
  
  setTimeout(() => {
    showIdleState();
  }, 2000);
}

function getPlayerStats() {
  const base = playerCharacter.getStats();
  const mod = battleState ? battleState.statModifier : 1;
  
  return {
    ...base,
    HP: Math.round(base.HP * mod),
    STR: Math.round(base.STR * mod * 10) / 10,
    CON: Math.round(base.CON * mod * 10) / 10,
    AGI: Math.round(base.AGI * mod * 10) / 10,
    REG: Math.round(base.REG * mod * 10) / 10,
    ACC: Math.round(base.ACC * mod),
    DEF: Math.round((base.DEF || 0) * mod),
    DAMAGE_MIN: Math.round((base.DAMAGE_MIN || 1) * mod),
    DAMAGE_MAX: Math.round((base.DAMAGE_MAX || 5) * mod),
    dodge: Math.round((base.dodge || 0) * mod),
    damageReduce: Math.round((base.damageReduce || 0) * mod)
  };
}

function addBattleLog(message, className = '') {
  const entry = document.createElement('p');
  entry.className = 'log-entry' + (className ? ' ' + className : '');
  entry.textContent = message;
  battleLogEl.appendChild(entry);
  battleLogEl.scrollTop = battleLogEl.scrollHeight;
}

export function setBattleEndCallback(cb) {
  onBattleEnd = cb;
}