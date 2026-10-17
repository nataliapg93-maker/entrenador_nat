import { NextResponse } from "next/server";

const openaiChatUrl = "https://api.openai.com/v1/chat/completions";

// Esquema estricto: obliga al modelo a devolver exactamente estos campos,
// asi la app siempre recibe ingredientes, gramos y macros ordenados.
const mealAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mealName", "confidence", "notes", "totals", "ingredients"],
  properties: {
    mealName: { type: "string" },
    confidence: { type: "number" },
    notes: { type: "string" },
    totals: {
      type: "object",
      additionalProperties: false,
      required: ["kcal", "protein", "carbs", "fat"],
      properties: {
        kcal: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" }
      }
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "grams", "kcal", "protein", "carbs", "fat", "confidence", "reason"],
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          kcal: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          confidence: { type: "number" },
          reason: { type: "string" }
        }
      }
    }
  }
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar OPENAI_API_KEY en Vercel." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube una foto de la comida." }, { status: 400 });
  }

  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
    return NextResponse.json(
      { error: "Formato no compatible. Usa JPG, PNG, GIF o WebP." },
      { status: 415 }
    );
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "La foto es demasiado grande. Maximo 8 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const imageData = bytes.toString("base64");
  const model = process.env.OPENAI_FOOD_MODEL || "gpt-4o";

  const response = await fetch(openaiChatUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "record_meal_analysis",
          strict: true,
          schema: mealAnalysisSchema
        }
      },
      messages: [
        {
          role: "system",
          content:
            "Eres una IA de nutricion para una app de perdida de grasa. Estima alimentos, pesos, calorias y macros con prudencia. Si hay duda, baja la confianza y propone ingredientes editables. No des diagnosticos medicos. La confianza va de 0 a 1."
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${file.type};base64,${imageData}` }
            },
            {
              type: "text",
              text:
                "Analiza esta foto de comida para Natalia. Objetivo diario: 1537 kcal, 141g proteina, 147g carbohidratos, 43g grasa. Identifica todos los ingredientes posibles, pesos estimados y macros. Si confundes alimentos visualmente parecidos, por ejemplo pasta y arroz, marca baja confianza y explica el motivo. Todos los ingredientes y pesos deben ser editables."
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    return NextResponse.json(
      { error: `OpenAI no ha podido analizar la foto: ${details}` },
      { status: 502 }
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content) {
    return NextResponse.json(
      { error: "OpenAI no ha devuelto una estimacion estructurada." },
      { status: 502 }
    );
  }

  try {
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json(
      { error: "La respuesta de OpenAI no se ha podido leer." },
      { status: 502 }
    );
  }
}
