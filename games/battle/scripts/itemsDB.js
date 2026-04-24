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

export function getItem(id) {
  return items.find(item => item.id === id) || null;
}

export function getRecipe(index) {
  return recipes[index] || null;
}

export function getAllRecipes() {
  return recipes;
}

export function getItemCount() {
  return items.length;
}

export function getAllItemIds() {
  return items.map(item => item.id);
}