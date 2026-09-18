"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type StravaStatus = {
  connected: boolean;
  athlete?: {
    firstname?: string;
    lastname?: string;
    profile?: string;
  } | null;
  connectedAt?: string;
  scope?: string;
};

type Activity = {
  id: number;
  name: string;
  type: string;
  date: string;
  minutes: number;
  distanceKm: number;
  elevation: number;
  calories: number | null;
};

type Exercise = {
  id: string;
  name: string;
  sets: string;
  note: string;
  image: string;
  description: string;
  tips: [string, string];
};

type FoodIngredient = {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  reason: string;
};

type FoodAnalysis = {
  mealName: string;
  confidence: number;
  notes: string;
  totals: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: FoodIngredient[];
};

type MealEntry = FoodAnalysis & {
  id: string;
  createdAt: string;
};

const targets = {
  kcal: 1537,
  protein: 141,
  carbs: 147,
  fat: 43
};

const exercises: Exercise[] = [
  {
    id: "leg-press",
    name: "Prensa inclinada",
    sets: "3 x 10-12",
    note: "Espalda apoyada",
    image: "/exercises/leg-press.jpg",
    description: "Empuja desde media planta, sin despegar la pelvis del respaldo.",
    tips: ["Rodillas alineadas con los pies.", "Para antes de que la lumbar se redondee."]
  },
  {
    id: "chest-row",
    name: "Remo pecho apoyado",
    sets: "3 x 10",
    note: "Torso estable",
    image: "/exercises/chest-row.jpg",
    description: "Remo con apoyo para trabajar espalda sin cargar la zona lumbar.",
    tips: ["Pecho pegado al banco.", "Lleva los codos hacia atras sin encoger hombros."]
  },
  {
    id: "hip-thrust",
    name: "Hip thrust controlado",
    sets: "3 x 8-10",
    note: "Pausa arriba",
    image: "/exercises/hip-thrust.jpg",
    description: "Extiende cadera con abdomen activo y barbilla ligeramente recogida.",
    tips: ["Costillas abajo durante toda la serie.", "Sube con gluteo, no arqueando la espalda."]
  },
  {
    id: "pallof-press",
    name: "Pallof press",
    sets: "3 x 12/lado",
    note: "Anti-rotacion",
    image: "/exercises/pallof-press.jpg",
    description: "Trabajo de core para resistir rotacion y proteger la zona lumbar.",
    tips: ["Cadera y costillas mirando al frente.", "Empuja lento y vuelve lento."]
  },
  {
    id: "lat-pulldown",
    name: "Jalon al pecho",
    sets: "3 x 10",
    note: "Control escapular",
    image: "/exercises/lat-pulldown.jpg",
    description: "Tira la barra hacia la parte alta del pecho con tronco estable.",
    tips: ["Baja hombros antes de tirar.", "No compenses inclinando la espalda."]
  },
  {
    id: "machine-chest",
    name: "Press pecho maquina",
    sets: "3 x 10",
    note: "Soporte total",
    image: "/exercises/machine-chest-press.jpg",
    description: "Empuje guiado para entrenar pecho con buena estabilidad.",
    tips: ["Escapulas apoyadas.", "Mantiene munecas neutras."]
  },
  {
    id: "leg-curl",
    name: "Curl femoral sentado",
    sets: "3 x 12",
    note: "Control atras",
    image: "/exercises/leg-curl.jpg",
    description: "Fortalece isquios sin bisagra lumbar ni carga axial.",
    tips: ["No rebotes al final.", "Aprieta un segundo en cada repeticion."]
  },
  {
    id: "goblet-box",
    name: "Goblet squat a caja",
    sets: "3 x 8",
    note: "Rango seguro",
    image: "/exercises/goblet-box-squat.jpg",
    description: "Sentadilla controlada hasta una caja para limitar rango y mejorar tecnica.",
    tips: ["Baja como si te sentaras atras.", "Mantiene el peso cerca del pecho."]
  },
  {
    id: "face-pull",
    name: "Face pull",
    sets: "3 x 12-15",
    note: "Postura",
    image: "/exercises/face-pull.jpg",
    description: "Trabajo de hombro posterior y espalda alta para equilibrar postura.",
    tips: ["Codos altos y abiertos.", "Termina con manos cerca de la cara."]
  },
  {
    id: "dead-bug",
    name: "Dead bug",
    sets: "3 x 8/lado",
    note: "Core suave",
    image: "/exercises/dead-bug.jpg",
    description: "Control abdominal sin flexionar ni extender en exceso la columna.",
    tips: ["Lumbar neutra contra el suelo.", "Mueve lento brazo y pierna contraria."]
  },
  {
    id: "step-up",
    name: "Step-up bajo",
    sets: "3 x 10/lado",
    note: "Estabilidad",
    image: "/exercises/step-up.jpg",
    description: "Subida a cajon bajo para pierna y gluteo con carga moderada.",
    tips: ["Empuja con la pierna de arriba.", "Evita impulsarte con la pierna de abajo."]
  },
  {
    id: "side-plank",
    name: "Plancha lateral",
    sets: "3 x 25 s/lado",
    note: "Anti-inclinacion",
    image: "/exercises/side-plank.jpg",
    description: "Core lateral para estabilidad de pelvis y columna.",
    tips: ["Cuerpo en linea recta.", "Baja si aparece molestia lumbar."]
  }
];

const monthPlan = [
  {
    title: "Semana 1",
    label: "Base tecnica",
    sessions: [
      ["leg-press", "chest-row", "hip-thrust", "pallof-press"],
      ["lat-pulldown", "machine-chest", "leg-curl", "dead-bug"],
      ["goblet-box", "face-pull", "step-up", "side-plank"]
    ]
  },
  {
    title: "Semana 2",
    label: "Consistencia",
    sessions: [
      ["leg-press", "lat-pulldown", "hip-thrust", "dead-bug"],
      ["goblet-box", "chest-row", "leg-curl", "pallof-press"],
      ["machine-chest", "face-pull", "step-up", "side-plank"],
      ["lat-pulldown", "leg-curl", "dead-bug"]
    ]
  },
  {
    title: "Semana 3",
    label: "Semana fuerte",
    sessions: [
      ["leg-press", "chest-row", "hip-thrust", "pallof-press"],
      ["goblet-box", "lat-pulldown", "machine-chest", "dead-bug"],
      ["step-up", "face-pull", "leg-curl", "side-plank"],
      ["chest-row", "hip-thrust", "pallof-press"]
    ]
  },
  {
    title: "Semana 4",
    label: "Descarga activa",
    sessions: [
      ["leg-press", "chest-row", "dead-bug"],
      ["lat-pulldown", "machine-chest", "leg-curl"],
      ["goblet-box", "face-pull", "side-plank"]
    ]
  }
];

function findExercise(id: string) {
  return exercises.find((exercise) => exercise.id === id) || exercises[0];
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short" }).format(new Date(date));
}

export default function NataliaApp() {
  const [activeTab, setActiveTab] = useState<"hoy" | "nutricion" | "entreno" | "progreso">("hoy");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [status, setStatus] = useState<StravaStatus>({ connected: false });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingStrava, setLoadingStrava] = useState(true);
  const [foodAnalysis, setFoodAnalysis] = useState<FoodAnalysis | null>(null);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");
  const [foodPhotoPreview, setFoodPhotoPreview] = useState<string | null>(null);
  const [savedMeals, setSavedMeals] = useState<MealEntry[]>([]);

  useEffect(() => {
    async function loadStrava() {
      try {
        const statusResponse = await fetch("/api/strava/status", { cache: "no-store" });
        const statusData = (await statusResponse.json()) as StravaStatus;
        setStatus(statusData);

        if (statusData.connected) {
          const activityResponse = await fetch("/api/strava/activities", { cache: "no-store" });
          if (activityResponse.ok) {
            const activityData = (await activityResponse.json()) as { activities: Activity[] };
            setActivities(activityData.activities || []);
          }
        }
      } finally {
        setLoadingStrava(false);
      }
    }

    loadStrava();
  }, []);

  useEffect(() => {
    const storedMeals = window.localStorage.getItem("natalia-fit-meals");
    if (storedMeals) {
      setSavedMeals(JSON.parse(storedMeals) as MealEntry[]);
    }
  }, []);

  const dailyTotals = useMemo(() => calculateMealEntryTotals(savedMeals), [savedMeals]);

  const weeklyLoad = useMemo(() => {
    const minutes = activities.reduce((total, activity) => total + activity.minutes, 0);
    const calories = activities.reduce((total, activity) => total + (activity.calories || 0), 0);
    const bike = activities.filter((activity) => activity.type.toLowerCase().includes("ride")).length;
    const other = activities.length - bike;
    return { minutes, calories, bike, other };
  }, [activities]);

  async function analyzeFoodPhoto(file: File | null) {
    if (!file) {
      return;
    }

    setFoodLoading(true);
    setFoodError("");
    setFoodPhotoPreview(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.set("photo", file);
      const response = await fetch("/api/food/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se ha podido analizar la foto.");
      }

      setFoodAnalysis(data as FoodAnalysis);
    } catch (error) {
      setFoodError(error instanceof Error ? error.message : "No se ha podido analizar la foto.");
    } finally {
      setFoodLoading(false);
    }
  }

  function updateIngredient(index: number, field: keyof FoodIngredient, value: string) {
    if (!foodAnalysis) {
      return;
    }

    const ingredients = foodAnalysis.ingredients.map((ingredient, ingredientIndex) => {
      if (ingredientIndex !== index) {
        return ingredient;
      }

      return {
        ...ingredient,
        [field]: field === "name" || field === "reason" ? value : Number(value) || 0
      };
    });

    setFoodAnalysis({
      ...foodAnalysis,
      ingredients,
      totals: calculateFoodTotals(ingredients)
    });
  }

  function addIngredient() {
    const newIngredient: FoodIngredient = {
      name: "Nuevo ingrediente",
      grams: 0,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      confidence: 1,
      reason: "Anadido manualmente"
    };

    const ingredients = [...(foodAnalysis?.ingredients || []), newIngredient];

    setFoodAnalysis({
      mealName: foodAnalysis?.mealName || "Comida nueva",
      confidence: foodAnalysis?.confidence || 1,
      notes: foodAnalysis?.notes || "Revisa pesos y macros antes de guardar.",
      ingredients,
      totals: calculateFoodTotals(ingredients)
    });
  }

  function saveMeal() {
    if (!foodAnalysis) {
      return;
    }

    const nextMeals = [
      {
        ...foodAnalysis,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      },
      ...savedMeals
    ];

    setSavedMeals(nextMeals);
    window.localStorage.setItem("natalia-fit-meals", JSON.stringify(nextMeals));
    setFoodAnalysis(null);
    setFoodPhotoPreview(null);
    setActiveTab("hoy");
  }

  return (
    <main className="app-shell">
      <section className="phone">
        <header className="topbar">
          <span>9:41</span>
          <div className="status-dots">
            <span />
            <span />
            <span />
          </div>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">Natalia Fit</p>
            <h1>Hoy</h1>
            <p>1537 kcal · 141P · 147C · 43G</p>
          </div>
          <button className="home-button" onClick={() => setActiveTab("hoy")} aria-label="Ir al inicio">
            Casa
          </button>
        </section>

        {activeTab === "hoy" && (
          <section className="screen">
            <div className="summary-card gradient-card">
              <div>
                <span className="label">Consumidas</span>
                <strong>{Math.round(dailyTotals.kcal)}</strong>
              </div>
              <div className="ring">
                <span>{Math.max(0, Math.round(targets.kcal - dailyTotals.kcal))}</span>
                <small>restantes</small>
              </div>
              <div>
                <span className="label">Proteina</span>
                <strong>{Math.round(dailyTotals.protein)}/{targets.protein}g</strong>
              </div>
            </div>

            <StravaPanel
              activities={activities}
              loading={loadingStrava}
              status={status}
              weeklyLoad={weeklyLoad}
              compact={false}
            />

            <div className="quick-grid">
              <button onClick={() => setActiveTab("nutricion")}>Foto comida</button>
              <button onClick={() => setActiveTab("entreno")}>Entreno</button>
              <button onClick={() => setActiveTab("progreso")}>Peso</button>
            </div>
          </section>
        )}

        {activeTab === "nutricion" && (
          <section className="screen">
            <article className="camera-card">
              <div className="camera-preview">
                {foodPhotoPreview && <img className="meal-preview" src={foodPhotoPreview} alt="Comida fotografiada" />}
                <div className="camera-grid" />
                <label className="shutter" aria-label="Hacer foto">
                  <input
                    accept="image/*"
                    capture="environment"
                    type="file"
                    onChange={(event) => analyzeFoodPhoto(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div>
                <h2>Comida nueva</h2>
                <p>{foodLoading ? "Analizando foto..." : "Foto, estimacion IA y correccion ingrediente por ingrediente."}</p>
                {foodError && <p className="error-text">{foodError}</p>}
              </div>
            </article>

            <article className="analysis-card">
              <p className="eyebrow">Editable siempre</p>
              <h3>{foodAnalysis?.mealName || "Ingredientes detectados"}</h3>

              {foodAnalysis && (
                <div className="macro-total">
                  <span>{Math.round(foodAnalysis.totals.kcal)} kcal</span>
                  <span>{Math.round(foodAnalysis.totals.protein)}P</span>
                  <span>{Math.round(foodAnalysis.totals.carbs)}C</span>
                  <span>{Math.round(foodAnalysis.totals.fat)}G</span>
                </div>
              )}

              {!foodAnalysis && <p className="muted">Haz una foto para que Claude proponga ingredientes, pesos y macros.</p>}

              {foodAnalysis?.ingredients.map((ingredient, index) => (
                <FoodEditRow
                  ingredient={ingredient}
                  index={index}
                  key={`${ingredient.name}-${index}`}
                  onUpdate={updateIngredient}
                />
              ))}

              <button className="soft-button" onClick={addIngredient}>
                + Añadir ingrediente
              </button>

              {foodAnalysis && (
                <button className="primary-action" onClick={saveMeal}>
                  Guardar comida
                </button>
              )}
            </article>

            <article className="analysis-card">
              <p className="eyebrow">Hoy</p>
              <h3>Comidas guardadas</h3>
              {savedMeals.length === 0 && <p className="muted">Todavia no hay comidas guardadas hoy.</p>}
              <div className="saved-meals">
                {savedMeals.slice(0, 4).map((meal) => (
                  <div className="saved-meal" key={meal.id}>
                    <span>
                      <strong>{meal.mealName}</strong>
                      <small>{new Date(meal.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</small>
                    </span>
                    <b>{Math.round(meal.totals.kcal)} kcal</b>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTab === "entreno" && (
          <section className="screen">
            <div className="week-selector">
              {monthPlan.map((week, index) => (
                <button
                  className={selectedWeek === index ? "active" : ""}
                  key={week.title}
                  onClick={() => setSelectedWeek(index)}
                >
                  {week.title}
                </button>
              ))}
            </div>

            <article className="training-card">
              <p className="eyebrow">{monthPlan[selectedWeek].label}</p>
              <h2>Fuerza 3-4 dias</h2>
              <p>Compatible con padel y bici. Si la lumbar pasa de 3/10, baja carga o usa alternativa.</p>
            </article>

            {monthPlan[selectedWeek].sessions.map((session, index) => (
              <article className="session-card" key={`${selectedWeek}-${index}`}>
                <div className="session-header">
                  <div>
                    <span className="label">Sesion {String.fromCharCode(65 + index)}</span>
                    <h3>{index === 3 ? "Opcional corta" : "Full body seguro"}</h3>
                  </div>
                  <strong>{index === 3 ? "25 min" : "42 min"}</strong>
                </div>

                <div className="exercise-list">
                  {session.map((exerciseId) => {
                    const exercise = findExercise(exerciseId);
                    return (
                      <button
                        className="exercise-card"
                        key={exercise.id}
                        onClick={() => setSelectedExercise(exercise)}
                      >
                        <Image src={exercise.image} alt={exercise.name} width={144} height={144} />
                        <span>
                          <strong>{exercise.name}</strong>
                          <small>
                            {exercise.sets} · {exercise.note}
                          </small>
                        </span>
                        <b>Ver</b>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        )}

        {activeTab === "progreso" && (
          <section className="screen">
            <StravaPanel
              activities={activities}
              loading={loadingStrava}
              status={status}
              weeklyLoad={weeklyLoad}
              compact
            />

            <article className="progress-card">
              <p className="eyebrow">Inicio limpio</p>
              <h2>Peso y adherencia</h2>
              <div className="metric-line">
                <span>Peso registrado</span>
                <strong>0 dias</strong>
              </div>
              <div className="metric-line">
                <span>Fotos de progreso</span>
                <strong>0</strong>
              </div>
              <div className="metric-line">
                <span>Macros completados</span>
                <strong>0%</strong>
              </div>
            </article>
          </section>
        )}

        <nav className="bottom-nav">
          <button className={activeTab === "hoy" ? "active" : ""} onClick={() => setActiveTab("hoy")}>
            Hoy
          </button>
          <button className={activeTab === "nutricion" ? "active" : ""} onClick={() => setActiveTab("nutricion")}>
            Nutricion
          </button>
          <button className={activeTab === "entreno" ? "active" : ""} onClick={() => setActiveTab("entreno")}>
            Entreno
          </button>
          <button className={activeTab === "progreso" ? "active" : ""} onClick={() => setActiveTab("progreso")}>
            Progreso
          </button>
        </nav>

        {selectedExercise && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <article className="exercise-modal">
              <button className="close-button" onClick={() => setSelectedExercise(null)} aria-label="Cerrar">
                Cerrar
              </button>
              <Image src={selectedExercise.image} alt={selectedExercise.name} width={720} height={600} />
              <p className="eyebrow">{selectedExercise.sets}</p>
              <h2>{selectedExercise.name}</h2>
              <p>{selectedExercise.description}</p>
              <div className="tips">
                <span>{selectedExercise.tips[0]}</span>
                <span>{selectedExercise.tips[1]}</span>
              </div>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}

function calculateFoodTotals(ingredients: FoodIngredient[]) {
  return ingredients.reduce(
    (totals, ingredient) => ({
      kcal: totals.kcal + ingredient.kcal,
      protein: totals.protein + ingredient.protein,
      carbs: totals.carbs + ingredient.carbs,
      fat: totals.fat + ingredient.fat
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function calculateMealEntryTotals(meals: MealEntry[]) {
  return meals.reduce(
    (totals, meal) => ({
      kcal: totals.kcal + meal.totals.kcal,
      protein: totals.protein + meal.totals.protein,
      carbs: totals.carbs + meal.totals.carbs,
      fat: totals.fat + meal.totals.fat
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function FoodEditRow({
  ingredient,
  index,
  onUpdate
}: {
  ingredient: FoodIngredient;
  index: number;
  onUpdate: (index: number, field: keyof FoodIngredient, value: string) => void;
}) {
  return (
    <div className="food-edit-row">
      <label className="wide-input">
        Ingrediente
        <input value={ingredient.name} onChange={(event) => onUpdate(index, "name", event.target.value)} />
      </label>
      <div className="food-input-grid">
        <label>
          g
          <input
            inputMode="decimal"
            value={ingredient.grams}
            onChange={(event) => onUpdate(index, "grams", event.target.value)}
          />
        </label>
        <label>
          kcal
          <input
            inputMode="decimal"
            value={ingredient.kcal}
            onChange={(event) => onUpdate(index, "kcal", event.target.value)}
          />
        </label>
        <label>
          P
          <input
            inputMode="decimal"
            value={ingredient.protein}
            onChange={(event) => onUpdate(index, "protein", event.target.value)}
          />
        </label>
        <label>
          C
          <input
            inputMode="decimal"
            value={ingredient.carbs}
            onChange={(event) => onUpdate(index, "carbs", event.target.value)}
          />
        </label>
        <label>
          G
          <input
            inputMode="decimal"
            value={ingredient.fat}
            onChange={(event) => onUpdate(index, "fat", event.target.value)}
          />
        </label>
      </div>
      <small>{ingredient.reason}</small>
    </div>
  );
}

function StravaPanel({
  activities,
  loading,
  status,
  weeklyLoad,
  compact
}: {
  activities: Activity[];
  loading: boolean;
  status: StravaStatus;
  weeklyLoad: { minutes: number; calories: number; bike: number; other: number };
  compact: boolean;
}) {
  return (
    <article className="strava-card">
      <div className="strava-header">
        <div>
          <p className="eyebrow">Strava</p>
          <h2>{status.connected ? "Actividad conectada" : "Conectar actividad"}</h2>
        </div>
        <a className="connect-button" href="/api/strava/connect">
          {status.connected ? "Reconectar" : "Conectar"}
        </a>
      </div>

      {loading && <p className="muted">Revisando conexion...</p>}

      {!loading && !status.connected && (
        <p className="muted">
          Conecta la cuenta de Natalia para leer bici, caminatas y sesiones registradas. Asi el plan de fuerza se
          ajusta mejor a la carga real.
        </p>
      )}

      {!loading && status.connected && (
        <>
          <div className="activity-summary">
            <span>
              <strong>{weeklyLoad.minutes}</strong>
              <small>min recientes</small>
            </span>
            <span>
              <strong>{Math.round(weeklyLoad.calories)}</strong>
              <small>kcal</small>
            </span>
            <span>
              <strong>{weeklyLoad.other}</strong>
              <small>otras</small>
            </span>
          </div>

          {!compact && (
            <div className="activity-list">
              {activities.slice(0, 4).map((activity) => (
                <div className="activity-row" key={activity.id}>
                  <span>
                    <strong>{activity.name}</strong>
                    <small>
                      {formatDate(activity.date)} · {activity.type}
                    </small>
                  </span>
                  <b>
                    {activity.calories ? `${Math.round(activity.calories)} kcal · ` : ""}
                    {activity.minutes} min
                  </b>
                </div>
              ))}
              {activities.length === 0 && <p className="muted">Aun no hay actividades recientes para mostrar.</p>}
            </div>
          )}
        </>
      )}
    </article>
  );
}
