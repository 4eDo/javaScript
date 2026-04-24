import { loadEnemyTemplates, generateEnemy, generateEnemyCount } from './enemy.js';
import { randomMessage } from './battleMessages.js';
import { getItemById, getAllItems } from './itemsDB.js';

// Состояние боя
let battleState = null;
let player = null;
let playerCharacter = null; // ссылка на Character
let ui = null;
let onBattleEnd = null; // колбэк при завершении боя

// Ссылки на DOM (кэшируются при setupBattle)
let enemyListEl, battleLogEl, battleActionsEl, resultTitle, resultText, modalResult;

export function setupBattle(character, uiModule) {
  playerCharacter = character;
  ui = uiModule;
  
  enemyListEl = document.getElementById('enemy-list');
  battleLogEl = document.getElementById('battle-log');
  battleActionsEl = document.getElementById('battle-actions');
  resultTitle = document.getElementById('result-title');
  resultText = document.getElementById('result-text');
  modalResult = document.getElementById('modal-result');
  
  showIdleState();
}

function showIdleState() {
  enemyListEl.innerHTML = '<p style="padding: 10px;">Противников поблизости нет.</p>';
  battleLogEl.innerHTML = '<p class="log-entry log-system">— Вы на разведке —</p>';
  battleActionsEl.innerHTML = `
    <button id="btn-search">Искать врагов</button>
    <button id="btn-explore">Исследовать окрестности</button>
  `;
  
  document.getElementById('btn-search').addEventListener('click', () => startBattle('search'));
  document.getElementById('btn-explore').addEventListener('click', () => startBattle('explore'));
}

function startBattle(mode) {
  const playerLevel = playerCharacter.getStats().level || 1;
  const enemyCount = generateEnemyCount(playerLevel);
  const enemies = [];
  
  for (let i = 0; i < enemyCount; i++) {
    enemies.push(generateEnemy(playerLevel));
  }
  
  battleState = {
    mode, // 'search' или 'explore'
    enemies,
    currentEnemyIndex: 0,
    playerTurn: Math.random() < 0.5,
    battleOver: false,
    log: [],
    playerHP: playerCharacter.getStats().HP,
    statModifier: mode === 'explore' ? 0.9 : 1.1 // -10% или +10%
  };
  
  renderEnemyList();
  renderBattleLog();
  showBattleActions();
  
  if (!battleState.playerTurn) {
    setTimeout(() => enemyTurn(), 800);
  }
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
    
    if (enemy.currentHP > 0) {
      entry.addEventListener('click', () => selectEnemy(index));
    }
    
    enemyListEl.appendChild(entry);
  });
}

function selectEnemy(index) {
  if (battleState.battleOver) return;
  if (battleState.enemies[index].currentHP <= 0) return;
  
  battleState.currentEnemyIndex = index;
  document.querySelectorAll('.enemy').forEach(e => e.style.outline = '');
  document.querySelector(`.enemy[data-index="${index}"]`).style.outline = '2px solid #000';
  
  if (battleState.playerTurn) {
    playerAttack(index);
  }
}

function showBattleActions() {
  battleActionsEl.innerHTML = '';
  
  if (!battleState.battleOver) {
    const fleeBtn = document.createElement('button');
    fleeBtn.id = 'btn-flee';
    fleeBtn.textContent = 'Убежать';
    fleeBtn.addEventListener('click', () => fleeBattle());
    battleActionsEl.appendChild(fleeBtn);
  }
}

function getPlayerStats() {
  const base = playerCharacter.getStats();
  const mod = battleState.statModifier;
  
  return {
    HP: Math.round(base.HP * mod),
    STR: Math.round(base.STR * mod * 10) / 10,
    CON: Math.round(base.CON * mod * 10) / 10,
    AGI: Math.round(base.AGI * mod * 10) / 10,
    REG: Math.round(base.REG * mod * 10) / 10,
    ACC: Math.round(base.ACC * mod),
    DEF: Math.round((base.DEF || 0) * mod),
    DAMAGE_MIN: Math.round((base.DAMAGE_MIN || 1) * mod),
    DAMAGE_MAX: Math.round((base.DAMAGE_MAX || 5) * mod),
    dodge: Math.round(base.dodge * mod),
    damageReduce: Math.round(base.damageReduce * mod)
  };
}

function playerAttack(enemyIndex) {
  if (!battleState.playerTurn || battleState.battleOver) return;
  
  const enemy = battleState.enemies[enemyIndex];
  const pStats = getPlayerStats();
  
  // Проверка попадания: меткость игрока - ловкость врага
  const hitChance = Math.max(10, pStats.ACC - enemy.stats.AGI * 2);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    const msg = randomMessage('dodge')
      .replace('{defender}', enemy.name)
      .replace('{attacker}', 'Вы');
    addLog(msg, 'log-system');
    endPlayerTurn();
    return;
  }
  
  // Базовый урон + оружие
  const baseDamage = Math.floor(Math.random() * (pStats.DAMAGE_MAX - pStats.DAMAGE_MIN + 1)) + pStats.DAMAGE_MIN;
  const strBonus = Math.floor(pStats.STR * 0.5);
  let rawDamage = baseDamage + strBonus;
  
  // Защита врага
  const blocked = Math.min(enemy.stats.DEF, Math.floor(rawDamage * 0.7));
  let damage = rawDamage - blocked;
  
  // Снижение урона врага (процент)
  if (enemy.stats.damageReduce) {
    damage = Math.round(damage * (1 - enemy.stats.damageReduce / 100));
  }
  
  damage = Math.max(1, damage);
  
  enemy.currentHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', 'Вы')
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    addLog(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', 'Вы')
      .replace('{defender}', enemy.name)
      .replace('{damage}', damage);
    addLog(msg);
  }
  
  if (enemy.currentHP <= 0) {
    enemy.currentHP = 0;
    const deathMsg = randomMessage('death').replace('{name}', enemy.name);
    addLog(deathMsg);
    checkAllEnemiesDead();
  }
  
  renderEnemyList();
  endPlayerTurn();
}

function enemyTurn() {
  if (battleState.battleOver) return;
  
  // Регенерация игрока
  const pStats = getPlayerStats();
  if (pStats.REG > 0 && battleState.playerHP < pStats.HP) {
    const regenAmount = Math.min(pStats.REG, pStats.HP - battleState.playerHP);
    battleState.playerHP += regenAmount;
    const msg = randomMessage('regen')
      .replace('{name}', 'Вы')
      .replace('{amount}', regenAmount);
    addLog(msg, 'log-system');
  }
  
  // Атака одного живого врага (текущего или случайного)
  const aliveEnemies = battleState.enemies.filter(e => e.currentHP > 0);
  if (aliveEnemies.length === 0) return;
  
  const enemy = aliveEnemies.includes(battleState.enemies[battleState.currentEnemyIndex]) 
    ? battleState.enemies[battleState.currentEnemyIndex] 
    : aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
  
  // Промах?
  const hitChance = Math.max(10, enemy.stats.ACC - pStats.dodge);
  const hit = Math.random() * 100 < hitChance;
  
  if (!hit) {
    const msg = randomMessage('dodge')
      .replace('{defender}', 'Вы')
      .replace('{attacker}', enemy.name);
    addLog(msg, 'log-system');
    endEnemyTurn();
    return;
  }
  
  // Урон врага
  const baseDamage = Math.floor(Math.random() * (enemy.stats.DAMAGE_MAX - enemy.stats.DAMAGE_MIN + 1)) + enemy.stats.DAMAGE_MIN;
  const strBonus = Math.floor(enemy.stats.STR * 0.5);
  let rawDamage = baseDamage + strBonus;
  
  // Защита игрока
  const blocked = Math.min(pStats.DEF, Math.floor(rawDamage * 0.7));
  let damage = rawDamage - blocked;
  
  // Снижение урона игрока
  if (pStats.damageReduce) {
    damage = Math.round(damage * (1 - pStats.damageReduce / 100));
  }
  
  damage = Math.max(1, damage);
  
  battleState.playerHP -= damage;
  
  if (blocked > 0) {
    const msg = randomMessage('blocked')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', 'Вас')
      .replace('{damage}', damage)
      .replace('{blocked}', blocked);
    addLog(msg);
  } else {
    const msg = randomMessage('attack')
      .replace('{attacker}', enemy.name)
      .replace('{defender}', 'Вас')
      .replace('{damage}', damage);
    addLog(msg);
  }
  
  if (battleState.playerHP <= 0) {
    battleState.playerHP = 0;
    addLog('Вы пали в бою...');
    endBattle(false);
    return;
  }
  
  endEnemyTurn();
}

function endPlayerTurn() {
  battleState.playerTurn = false;
  if (!battleState.battleOver) {
    setTimeout(() => enemyTurn(), 600);
  }
}

function endEnemyTurn() {
  battleState.playerTurn = true;
}

function checkAllEnemiesDead() {
  const allDead = battleState.enemies.every(e => e.currentHP <= 0);
  if (allDead) {
    endBattle(true);
  }
}

function endBattle(victory) {
  battleState.battleOver = true;
  
  if (victory) {
    giveRewards();
  }
  
  setTimeout(() => {
    if (onBattleEnd) onBattleEnd();
    showIdleState();
  }, 1500);
}

function giveRewards() {
  let totalXP = 0;
  const droppedItems = [];
  
  for (const enemy of battleState.enemies) {
    totalXP += enemy.xp;
    
    // Шанс дропа с каждого слота экипировки
    if (enemy.equipment) {
      for (const [slotKey, itemId] of Object.entries(enemy.equipment)) {
        const item = getItemById(itemId);
        if (!item) continue;
        
        // Базовый шанс дропа * обратная зависимость от уровня предмета
        const baseChance = enemy.template.dropChance;
        const levelPenalty = 1 - (item.level * 0.1);
        const dropChance = Math.max(0.02, baseChance * levelPenalty);
        
        if (Math.random() < dropChance) {
          droppedItems.push(itemId);
        }
      }
    }
  }
  
  // Применяем награды
  playerCharacter.addXP?.(totalXP);
  droppedItems.forEach(id => playerCharacter.addItem(id));
  
  const msg = `Победа! Получено ${totalXP} опыта.`;
  const itemMsg = droppedItems.length > 0 
    ? `\nДобыча: ${droppedItems.map(id => getItemById(id)?.name || id).join(', ')}` 
    : '';
  
  resultTitle.textContent = 'Победа!';
  resultText.textContent = msg + itemMsg;
  modalResult.classList.add('open');
}

function fleeBattle() {
  if (battleState.battleOver) return;
  
  battleState.battleOver = true;
  
  // 30% наград
  let totalXP = 0;
  for (const enemy of battleState.enemies) {
    totalXP += Math.round(enemy.xp * 0.3);
  }
  
  playerCharacter.addXP?.(totalXP);
  
  resultTitle.textContent = 'Побег!';
  resultText.textContent = `Вы сбежали. Получено ${totalXP} опыта (30%).`;
  modalResult.classList.add('open');
  
  setTimeout(() => {
    if (onBattleEnd) onBattleEnd();
    showIdleState();
  }, 1000);
}

function addLog(message, className = '') {
  const entry = document.createElement('p');
  entry.className = 'log-entry' + (className ? ' ' + className : '');
  entry.textContent = message;
  battleLogEl.appendChild(entry);
  battleLogEl.scrollTop = battleLogEl.scrollHeight;
}

function renderBattleLog() {
  battleLogEl.innerHTML = '<p class="log-entry log-system">— Бой начался —</p>';
}

export function setBattleEndCallback(cb) {
  onBattleEnd = cb;
}