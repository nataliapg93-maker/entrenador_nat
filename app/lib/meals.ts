"use client";

import { restFetch } from "./supabase";

export type FoodIngredient = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  reason: string;
};

export type FoodAnalysis = {
  mealName: string;
  confidence: number;
  notes: string;
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  ingredients: FoodIngredient[];
};

export type MealEntry = FoodAnalysis & {
  id: string;
  createdAt: string;
};

export type Targets = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const defaultTargets: Targets = { kcal: 1537, protein: 141, carbs: 147, fat: 43 };

type MealRow = {
  id: string;
  eaten_at: string;
  name: string;
  notes: string | null;
  confidence: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_ingredients?: IngredientRow[];
};

type IngredientRow = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number | null;
  reason: string | null;
  position: number;
};

function rowToEntry(row: MealRow): MealEntry {
  const ingredients = (row.meal_ingredients || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((ingredient) => ({
      name: ingredient.name,
      grams: Number(ingredient.grams),
      kcal: Number(ingredient.kcal),
      protein: Number(ingredient.protein),
      carbs: Number(ingredient.carbs),
      fat: Number(ingredient.fat),
      confidence: Number(ingredient.confidence ?? 1),
      reason: ingredient.reason || ""
    }));

  return {
    id: row.id,
    createdAt: row.eaten_at,
    mealName: row.name,
    notes: row.notes || "",
    confidence: Number(row.confidence ?? 1),
    totals: {
      kcal: Number(row.kcal),
      protein: Number(row.protein),
      carbs: Number(row.carbs),
      fat: Number(row.fat)
    },
    ingredients
  };
}

// Limites del dia en la hora local del movil. Esto es lo que arregla
// el contador que antes sumaba todas las comidas de todos los dias.
export function dayBounds(reference: Date = new Date()) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function fetchTargets(): Promise<Targets> {
  const rows = (await restFetch(
    "profiles?select=target_kcal,target_protein,target_carbs,target_fat&limit=1"
  )) as Array<Record<string, number>> | null;

  if (!rows || rows.length === 0) {
    return defaultTargets;
  }

  const row = rows[0];
  return {
    kcal: Number(row.target_kcal) || defaultTargets.kcal,
    protein: Number(row.target_protein) || defaultTargets.protein,
    carbs: Number(row.target_carbs) || defaultTargets.carbs,
    fat: Number(row.target_fat) || defaultTargets.fat
  };
}

export async function fetchMealsForDay(reference: Date = new Date()): Promise<MealEntry[]> {
  const { start, end } = dayBounds(reference);
  const query = [
    "meals?select=id,eaten_at,name,notes,confidence,kcal,protein,carbs,fat,meal_ingredients(*)",
    `eaten_at=gte.${start.toISOString()}`,
    `eaten_at=lt.${end.toISOString()}`,
    "order=eaten_at.desc"
  ].join("&");

  const rows = (await restFetch(query)) as MealRow[] | null;
  return (rows || []).map(rowToEntry);
}

export async function insertMeal(
  userId: string,
  analysis: FoodAnalysis,
  eatenAt: Date = new Date()
): Promise<MealEntry> {
  const inserted = (await restFetch("meals", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      eaten_at: eatenAt.toISOString(),
      name: analysis.mealName,
      notes: analysis.notes,
      confidence: analysis.confidence,
      kcal: analysis.totals.kcal,
      protein: analysis.totals.protein,
      carbs: analysis.totals.carbs,
      fat: analysis.totals.fat,
      source: "foto"
    })
  })) as MealRow[];

  const meal = inserted[0];

  if (analysis.ingredients.length > 0) {
    await restFetch("meal_ingredients", {
      method: "POST",
      body: JSON.stringify(
        analysis.ingredients.map((ingredient, index) => ({
          meal_id: meal.id,
          position: index,
          name: ingredient.name,
          grams: ingredient.grams,
          kcal: ingredient.kcal,
          protein: ingredient.protein,
          carbs: ingredient.carbs,
          fat: ingredient.fat,
          confidence: ingredient.confidence,
          reason: ingredient.reason
        }))
      )
    });
  }

  return { ...analysis, id: meal.id, createdAt: meal.eaten_at };
}

export async function deleteMeal(id: string) {
  await restFetch(`meals?id=eq.${id}`, { method: "DELETE" });
}

// Sube al servidor las comidas que quedaron guardadas solo en el navegador.
const LEGACY_KEY = "natalia-fit-meals";
const MIGRATED_KEY = "natalia-fit-meals-migrated";

export async function migrateLocalMeals(userId: string): Promise<number> {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    if (window.localStorage.getItem(MIGRATED_KEY)) {
      return 0;
    }

    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      window.localStorage.setItem(MIGRATED_KEY, "1");
      return 0;
    }

    const legacy = JSON.parse(raw) as MealEntry[];
    let moved = 0;

    for (const meal of legacy) {
      await insertMeal(userId, meal, new Date(meal.createdAt));
      moved += 1;
    }

    window.localStorage.setItem(MIGRATED_KEY, "1");
    return moved;
  } catch {
    return 0;
  }
}
