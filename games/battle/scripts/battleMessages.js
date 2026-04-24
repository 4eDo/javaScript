// Шаблоны сообщений для боя
// {attacker} — имя атакующего
// {defender} — имя защищающегося
// {damage} — нанесённый урон
// {blocked} — поглощено защитой
// {hp} — оставшееся ХП
// {dodge} — имя увернувшегося

export const BATTLE_MESSAGES = {
  attack: [
    '{attacker} бьёт {defender} — {damage} урона.',
    '{attacker} наносит удар по {defender} на {damage} ед.',
    '{attacker} атакует {defender}, нанося {damage} урона.',
    'Удар {attacker} по {defender} — {damage} ед. урона!'
  ],
  blocked: [
    '{attacker} бьёт {defender} — {damage} урона (поглощено: {blocked}).',
    '{attacker} атакует {defender}: {damage} урона, защита поглотила {blocked}.',
    'Попадание по {defender}: {damage} урона, -{blocked} защитой.'
  ],
  dodge: [
    '{defender} уворачивается от атаки {attacker}!',
    '{attacker} промахивается — {defender} ловко уклоняется.',
    '{defender} уходит из-под удара {attacker}.'
  ],
  regen: [
    '{name} восстанавливает {amount} HP.',
    '{name} регенерирует +{amount} здоровья.'
  ],
  death: [
    '{name} повержен!',
    '{name} падает замертво.'
  ]
};

export function randomMessage(category) {
  const messages = BATTLE_MESSAGES[category];
  if (!messages || messages.length === 0) return '';
  return messages[Math.floor(Math.random() * messages.length)];
}