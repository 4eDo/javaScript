import { CONFIG } from './config.js';

let items = [];
let recipes = [];

export async function loadItemsDB() {
  const [itemsResp, recipesResp] = await Promise.all([
    fetch(CONFIG.ITEMS_URL),
    fetch(CONFIG.RECIPES_URL),
  ]);
  items = await itemsResp.json();
  recipes = await recipesResp.json();
}

export function getItemById(id) {
  return items.find(item => item.id === id) || null;
}

export function getRecipeByIndex(index) {
  return recipes[index] || null;
}

export function getAllRecipes() {
  return recipes;
}

export function getAllItems() {
  return items;
}

export function getAllItemIds() {
  return items.map(item => item.id);
}

export function getItemsCount() {
  return items.length;
}