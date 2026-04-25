export const CONFIG = {
  ITEMS_URL: 'https://4edo.github.io/javaScript/games/battle/items.json',
  RECIPES_URL: 'https://4edo.github.io/javaScript/games/battle/itemsUpgrade.json',
  BASE_HP: 100,
  HP_PER_CON: 10,
  PLAYER_NAME: 'Герой',
  
  // Вероятности для исследования окрестностей (в процентах, сумма не обязана быть 100%, остаток — пусто)
  EXPLORE_CHANCE_ENEMIES: 15,       // только враги
  EXPLORE_CHANCE_ITEM: 30,          // только предмет
  EXPLORE_CHANCE_ITEM_AND_ENEMIES: 40, // предмет + враги
  // Если ни одно не выпало — пусто (100 - 15 - 30 - 40 = 15%)
  
  // Шанс получить вещь при побеге (от поверженных врагов)
  FLEE_ITEM_CHANCE: 30, // процент
  
  // Процент опыта при побеге
  FLEE_XP_PERCENT: 30
};