import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalyseResult } from "./types";

export interface AIProvider {
  generate(prompt: string): Promise<string>;
}

class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-3.6-flash") {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generate(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}

export function getAIProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GeminiProvider(apiKey);
}

export function parseAIResponse(raw: string): AnalyseResult {
  let cleaned = raw.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned) as AnalyseResult;

  // Validate required fields
  if (typeof parsed.noteGlobale !== "number") {
    throw new Error("Invalid response: noteGlobale must be a number");
  }
  if (!parsed.notesParCritere || !parsed.rapport) {
    throw new Error("Invalid response: missing notesParCritere or rapport");
  }

  return parsed;
}
