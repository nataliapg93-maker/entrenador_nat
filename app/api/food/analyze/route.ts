import { NextResponse } from "next/server";

type AnthropicToolUse = {
  type: "tool_use";
  name: string;
  input: unknown;
};

const anthropicMessagesUrl = "https://api.anthropic.com/v1/messages";

const mealAnalysisTool = {
  name: "record_meal_analysis",
  description:
    "Devuelve una estimacion nutricional editable de una comida fotografiada para Natalia.",
  input_schema: {
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
  }
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar ANTHROPIC_API_KEY en Vercel." },
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
  const model = process.env.ANTHROPIC_FOOD_MODEL || "claude-sonnet-5";

  const response = await fetch(anthropicMessagesUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      system:
        "Eres una IA de nutricion para una app de perdida de grasa. Estima alimentos, pesos, calorias y macros con prudencia. Si hay duda, baja la confianza y propone ingredientes editables. No des diagnosticos medicos.",
      tools: [mealAnalysisTool],
      tool_choice: { type: "tool", name: "record_meal_analysis" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type,
                data: imageData
              }
            },
            {
              type: "text",
              text:
                "Analiza esta foto de comida para Natalia. Objetivo diario: 1537 kcal, 141g proteina, 147g carbohidratos, 43g grasa. Identifica todos los ingredientes posibles, pesos estimados y macros. Si confundes alimentos visualmente parecidos, por ejemplo pasta/arroz, marca baja confianza y explica el motivo. Todos los ingredientes y pesos deben ser editables."
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    return NextResponse.json(
      { error: `Anthropic no ha podido analizar la foto: ${details}` },
      { status: 502 }
    );
  }

  const result = await response.json();
  const toolUse = result.content?.find(
    (block: AnthropicToolUse) => block.type === "tool_use" && block.name === "record_meal_analysis"
  ) as AnthropicToolUse | undefined;

  if (!toolUse) {
    return NextResponse.json(
      { error: "Anthropic no ha devuelto una estimacion estructurada." },
      { status: 502 }
    );
  }

  return NextResponse.json(toolUse.input);
}
