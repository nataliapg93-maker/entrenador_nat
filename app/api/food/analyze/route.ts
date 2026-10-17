import { NextResponse } from "next/server";

// Nota: se llama a la API por HTTP directo en vez de con el SDK oficial
// porque este proyecto no tiene Node instalado en local y no se puede
// regenerar package-lock.json para anadir dependencias.
const anthropicMessagesUrl = "https://api.anthropic.com/v1/messages";

type AnthropicBlock = {
  type: string;
  name?: string;
  input?: unknown;
};

const mealAnalysisTool = {
  name: "record_meal_analysis",
  description:
    "Devuelve una estimacion nutricional editable de una comida fotografiada para Natalia.",
  strict: true,
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

  // Si el cuerpo no es un formulario, formData() lanza y la funcion
  // moria con un 500 vacio, sin explicar nada.
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { error: "La peticion no traia una foto en el formato esperado." },
      { status: 400 }
    );
  }

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
  const model = process.env.ANTHROPIC_FOOD_MODEL || "claude-opus-5";

  const response = await fetch(anthropicMessagesUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      // Amplio a proposito: el modelo razona antes de responder y ese
      // razonamiento cuenta dentro del limite. Con un tope bajo se corta.
      max_tokens: 16000,
      // Esfuerzo bajo: es una tarea de percepcion acotada y la app es movil,
      // asi que prima que responda rapido. Se puede subir si hace falta.
      output_config: { effort: "low" },
      system:
        "Eres una IA de nutricion para una app de perdida de grasa. Estima alimentos, pesos, calorias y macros con prudencia. Si hay duda, baja la confianza y propone ingredientes editables. No des diagnosticos medicos. La confianza va de 0 a 1. Responde SIEMPRE llamando a la herramienta record_meal_analysis, nunca con texto suelto.",
      tools: [mealAnalysisTool],
      tool_choice: { type: "auto" },
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
                "Analiza esta foto de comida para Natalia. Objetivo diario: 1537 kcal, 141g proteina, 147g carbohidratos, 43g grasa. Identifica todos los ingredientes posibles, pesos estimados y macros. Si confundes alimentos visualmente parecidos, por ejemplo pasta y arroz, marca baja confianza y explica el motivo. Todos los ingredientes y pesos deben ser editables. Usa la herramienta record_meal_analysis para responder."
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

  if (result.stop_reason === "refusal") {
    return NextResponse.json(
      { error: "El modelo no ha querido analizar esta imagen. Prueba con otra foto." },
      { status: 502 }
    );
  }

  const blocks: AnthropicBlock[] = Array.isArray(result.content) ? result.content : [];
  const toolUse = blocks.find(
    (block) => block.type === "tool_use" && block.name === "record_meal_analysis"
  );

  if (!toolUse || !toolUse.input) {
    return NextResponse.json(
      { error: "Anthropic no ha devuelto una estimacion estructurada." },
      { status: 502 }
    );
  }

  return NextResponse.json(toolUse.input);
}
