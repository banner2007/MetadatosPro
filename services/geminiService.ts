
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

// Initialize the Google GenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeVideoContent = async (fileName: string): Promise<AIAnalysisResult> => {
  try {
    // Call the Gemini model to analyze the video filename and generate social media content.
    // Using gemini-3-flash-preview for efficient text generation and reasoning.
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

    // Access the text property directly (it is a getter property, not a method).
    const text = response.text || '{}';
    return JSON.parse(text.trim());
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
