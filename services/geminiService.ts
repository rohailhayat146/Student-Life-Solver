import { GoogleGenAI, GenerateContentResponse, Part, Content, Type } from "@google/genai";
import { LLMConfig } from '../types';

/**
 * Creates and returns a new GoogleGenAI instance.
 * It's crucial to create a new instance before each API call to ensure
 * the latest API key (e.g., from `process.env.API_KEY` which is updated
 * after `openSelectKey()`) is used.
 * @returns GoogleGenAI instance.
 */
export const getGeminiInstance = (): GoogleGenAI => {
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable is not set.");
    throw new Error("API Key is not configured. Please select your API key.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Calls the Gemini API to generate content based on a prompt and configuration.
 * @param prompt The user's input prompt, can be a string or an array of (string | Part) for multimodal input.
 * @param model The Gemini model to use (default: 'gemini-2.5-flash').
 * @param config Optional LLM configuration (systemInstruction, temperature, etc.).
 * @returns The generated text response.
 * @throws Error if the API call fails or no text is returned.
 */
export const callGeminiApi = async (
  prompt: string | (string | Part)[],
  model: string = 'gemini-2.5-flash',
  config?: LLMConfig,
): Promise<string> => {
  try {
    const ai = getGeminiInstance();

    // Fix: Ensure that if prompt is an array, all elements are correctly typed as Part
    let contents: string | Content;
    if (typeof prompt === 'string') {
      contents = prompt;
    } else {
      // Map string elements to { text: string } to conform to the Part type
      const parts: Part[] = prompt.map(item =>
        typeof item === 'string' ? { text: item } : item
      );
      contents = { parts: parts };
    }

    const requestConfig = {
      model: model,
      contents: contents,
      config: {
        systemInstruction: config?.systemInstruction,
        temperature: config?.temperature || 0.7,
        topK: config?.topK || 64,
        topP: config?.topP || 0.95,
        responseMimeType: config?.responseMimeType, // Pass through if provided
        responseSchema: config?.responseSchema,     // Pass through if provided
        // maxOutputTokens and thinkingBudget can be omitted to let the model decide,
        // or set explicitly if needed for specific tasks.
      },
    };

    const response: GenerateContentResponse = await ai.models.generateContent(requestConfig);

    const text = response.text;
    if (text === undefined || text === null) {
      // For multimodal responses, the text property directly extracts text from suitable parts.
      // If no direct text, iterate through candidates' parts to find text.
      const textParts = response.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text).join('\n');
      if (textParts) return textParts;
      throw new Error("Gemini API returned an empty or non-textual response where text was expected.");
    }
    return text;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    if (error.message && error.message.includes("Requested entity was not found.")) {
      // Specific error handling for API key issues
      throw new Error("API Key might be invalid or not selected. Please re-select your API key. (Details: " + error.message + ")");
    }
    throw new Error(`Failed to get response from AI: ${error.message || "Unknown error"}`);
  }
};

/**
 * Calls the Gemini API to generate structured JSON content based on a prompt and configuration.
 * @param prompt The user's input prompt, can be a string or an array of (string | Part) for multimodal input.
 * @param responseSchema The schema defining the expected JSON output structure.
 * @param model The Gemini model to use (default: 'gemini-2.5-flash').
 * @param config Optional LLM configuration (systemInstruction, temperature, etc.).
 * @returns The generated JSON response as a parsed object of type T.
 * @throws Error if the API call fails, no JSON is returned, or JSON parsing fails.
 */
export const callGeminiApiJson = async <T>(
  prompt: string | (string | Part)[],
  responseSchema: { type: Type; properties?: any; items?: any; },
  model: string = 'gemini-2.5-flash',
  config?: LLMConfig,
): Promise<T> => {
  try {
    const ai = getGeminiInstance();

    let contents: string | Content;
    if (typeof prompt === 'string') {
      contents = prompt;
    } else {
      const parts: Part[] = prompt.map(item =>
        typeof item === 'string' ? { text: item } : item
      );
      contents = { parts: parts };
    }

    const requestConfig = {
      model: model,
      contents: contents,
      config: {
        systemInstruction: config?.systemInstruction,
        temperature: config?.temperature || 0.7,
        topK: config?.topK || 64,
        topP: config?.topP || 0.95,
        responseMimeType: "application/json", // Crucial for JSON output
        responseSchema: responseSchema,      // Crucial for structured JSON
      },
    };

    const response: GenerateContentResponse = await ai.models.generateContent(requestConfig);

    const jsonText = response.text?.trim();
    if (!jsonText) {
      throw new Error("Gemini API returned an empty JSON response.");
    }
    // Attempt to parse JSON. Model might return non-JSON if constraints are not fully met.
    try {
      return JSON.parse(jsonText) as T;
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", jsonText, parseError);
      throw new Error("AI did not return a valid JSON format. Raw response: " + jsonText);
    }
  } catch (error: any) {
    console.error("Error calling Gemini JSON API:", error);
    if (error.message && error.message.includes("Requested entity was not found.")) {
      throw new Error("API Key might be invalid or not selected. Please re-select your API key. (Details: " + error.message + ")");
    }
    throw new Error(`Failed to get JSON response from AI: ${error.message || "Unknown error"}`);
  }
};