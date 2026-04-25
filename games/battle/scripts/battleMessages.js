export const BATTLE_MESSAGES = {
  attack: [
    '{attacker} бьёт {defender} — {damage} урона.',
    '{attacker} наносит удар по {defender} на {damage} ед.',
    '{attacker} атакует {defender}, нанося {damage} урона.',
    'Удар {attacker} по {defender} — {damage} ед. урона!',
    '{attacker} замахивается и попадает по {defender} — {damage} урона.',
    'Хороший удар! {attacker} выбивает {damage} HP у {defender}.',
    'Благодаря {equip}, {attacker} наносит {damage} урона по {defender}!'
  ],
  blocked: [
    '{attacker} бьёт {defender} — {damage} урона (поглощено: {blocked}).',
    '{attacker} атакует {defender}: {damage} урона, защита поглотила {blocked}.',
    'Попадание по {defender}: {damage} урона, -{blocked} защитой.',
    'Удар достигает цели, но броня {defender} смягчает — {damage} урона (-{blocked}).'
  ],
  dodge: [
    '{defender} уворачивается от атаки {attacker}!',
    '{attacker} промахивается — {defender} ловко уклоняется.',
    '{defender} уходит из-под удара {attacker}.',
    '{attacker} бьёт мимо — {defender} предвидел этот выпад!',
    'Промах! {defender} не дал {attacker} попасть.'
  ],
  regen: [
    '{name} восстанавливает {amount} HP.',
    '{name} регенерирует +{amount} здоровья.',
    'Раны {name} затягиваются — +{amount} HP.',
    'Организм {name} восстанавливается на {amount} HP.'
  ],
  death: [
    '{name} повержен!',
    '{name} падает замертво.',
    '{name} рушится на землю.',
    '{name} издаёт последний вздох.',
    'С {name} покончено!'
  ],
  player_death: [
    '{name} падает без сил... Поражение.',
    '{name} не выдержал напора врагов.',
    'Это конец для {name}. Бой проигран.'
  ],
  consumable_instant: [
    '{name} использует {item} — +{value} HP!',
    '{name} применяет {item}: восстановлено {value} здоровья.',
    'Быстрое применение {item} — {name} получает +{value} HP.',
    '{item} мгновенно поднимает здоровье {name} на {value}!'
  ],
  consumable_effect: [
    '{name} использует {item} — эффект на {duration}.',
    '{name} применяет {item}: бонус на {duration}.',
    '{item} активирован! Действие: {duration}.',
    '{name} чувствует прилив сил от {item} — хватит на {duration}.'
  ],
  consumable_effect_battle: [
    '{name} использует {item} — эффект до конца боя!',
    '{name} применяет {item}: бонус на весь бой.',
    '{item} активирован! Действие: до конца боя.',
    'Мощь {item} наполняет {name} до конца схватки!'
  ],
  enemy_spotted: [
    '— Обнаружены противники! Выберите цель —',
    '— Враги замечены! Укажите цель —',
    '— Противники на горизонте! Кого атакуем? —',
    '— Вражеский отряд в зоне видимости! —'
  ],
  enemy_defeated: [
    '— Противник повержен. Выберите следующую цель —',
    '— Враг пал. Кто следующий? —',
    '— Цель уничтожена. Укажите новую —',
    '— Ещё один готов. Добиваем остальных! —'
  ],
  all_enemies_defeated: [
    '— Все противники повержены! Победа! —',
    '— Бой окончен! Враги уничтожены! —',
    '— Поле боя зачищено! Отличная работа! —'
  ],
  battle_start: [
    '— Бой начался —',
    '— В бой! —',
    '— Схватка начинается! —',
    '— Клинки наголо! —'
  ],
  found_item: [
    'Исследуя местность, вы нашли: {item}!',
    'Вы заметили {item} среди обломков.',
    'В кустах что-то блестит... Это {item}!',
    'Удача! Вы обнаружили {item}.'
  ],
  found_item_enemies: [
    'Вы нашли: {item}, но привлекли внимание врагов!',
    '{item} у вас, но кажется вы не одни... Враги рядом!',
    'Находка: {item}. Однако шум привлёк противников!',
    'Вы подобрали {item}, и тут из тени выходят враги...'
  ],
  nothing_found: [
    'Вы осмотрели окрестности, но ничего не нашли.',
    'Пусто. Ничего интересного поблизости.',
    'Вы прочесали местность — ничего.',
    'Тишина и запустение. Никаких находок.'
  ],
  flee: [
    'Вы сбегаете с поля боя, пока враги отвлеклись.',
    'Быстрый рывок — и вы уже далеко от противников.',
    'Тактическое отступление! Враги теряют вас из виду.',
    'Ноги в руки — и вы успешно скрываетесь!'
  ],
  no_equip: [
    'чистое везение',
    'удача',
    'успешный успех',
    'костюм Адама',
    'природное обаяние',
    'голые руки',
    'смекалка',
    'врождённый талант',
    'сила духа',
    'крутость',
    'наглая морда',
    'второе дыхание',
    'здоровый сон',
    'мамина радость',
    'дедовский наказ'
  ]
};

export function randomMessage(category) {
  const messages = BATTLE_MESSAGES[category];
  if (!messages || messages.length === 0) return '';
  return messages[Math.floor(Math.random() * messages.length)];
}

// Возвращает случайный ID предмета из экипировки персонажа
export function getRandomEquip(character) {
  if (!character || !character.equipment) return null;
  
  const equipped = Object.entries(character.equipment)
    .filter(([key, itemId]) => {
      if (!itemId) return false;
      const [slot] = key.split('-');
      return slot !== 'consumable';
    })
    .map(([, itemId]) => itemId);
  
  if (equipped.length === 0) return null;
  return equipped[Math.floor(Math.random() * equipped.length)];
}