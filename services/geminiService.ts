
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

// Fix: Initialize GoogleGenAI using the apiKey property directly from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeVideoContent = async (fileName: string): Promise<AIAnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza este nombre de archivo de video destinado a redes sociales: "${fileName}". 
      Tu respuesta debe ser estrictamente en ESPAÑOL.
      Genera:
      1. Un título optimizado para ganar visualizaciones (clickbait ético).
      2. 5 hashtags populares.
      3. 3 consejos de edición (ej: ganchos, música, transiciones).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: { type: Type.STRING },
            suggestedHashtags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            optimizationTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["suggestedTitle", "suggestedHashtags", "optimizationTips"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Error en análisis de Gemini:", error);
    return {
      suggestedTitle: "Video sin título (Optimizado)",
      suggestedHashtags: ["#viral", "#tendencia", "#creador", "#parati", "#video"],
      optimizationTips: [
        "Añade subtítulos dinámicos en la parte central.",
        "Usa un audio en tendencia para mejorar el alcance.",
        "El gancho debe ocurrir en los primeros 1.5 segundos."
      ]
    };
  }
};
