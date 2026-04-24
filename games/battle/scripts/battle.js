export function setupBattle() {
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