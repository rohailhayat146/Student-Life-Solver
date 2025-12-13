

import React, { useState, useCallback, FormEvent, useRef, useEffect } from 'react';
import { callGeminiApiJson } from '../services/geminiService';
import { LLMConfig, OnActionProps, DecisionAnalysis, ActionType } from '../types';
import Loader from './Loader';
import MarkdownRenderer from './MarkdownRenderer';
import { Type } from '@google/genai';

interface InstantDecisionHelperProps extends OnActionProps {}

const InstantDecisionHelper: React.FC<InstantDecisionHelperProps> = ({ onAction }) => {
  const [contextPrompt, setContextPrompt] = useState<string>('');
  const [scenarios, setScenarios] = useState<string[]>(['', '']);
  const [responseAnalysis, setResponseAnalysis] = useState<DecisionAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const contextPromptRef = useRef<HTMLTextAreaElement>(null);
  const scenarioRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    if (contextPromptRef.current) {
      contextPromptRef.current.style.height = 'auto';
      contextPromptRef.current.style.height = `${contextPromptRef.current.scrollHeight}px`;
    }
  }, [contextPrompt]);

  useEffect(() => {
    scenarioRefs.current.forEach((ref, index) => {
      if (ref && scenarios[index] !== undefined) {
        ref.style.height = 'auto';
        ref.style.height = `${ref.scrollHeight}px`;
      }
    });
  }, [scenarios]);


  const systemInstruction = `You are the Instant Decision Helper for Student Life Solver (SLS). Your role is to provide a comprehensive, comparative analysis for multiple alternative scenarios or choices based on a user's context.

You MUST respond with a structured JSON object. The JSON should conform to the following schema:
{
  "overallRecommendation": "string", // A concise recommendation based on the analysis.
  "scenarios": [
    {
      "option": "string", // The name/description of the scenario/choice.
      "pros": ["string"], // List of advantages for this option.
      "cons": ["string"]  // List of disadvantages for this option.
    }
  ]
}

Analyze each provided scenario/choice independently and then comparatively. Ensure all pros and cons are distinct and relevant. Provide a clear, actionable 'overallRecommendation' that weighs all options.`;

  const decisionAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
      overallRecommendation: {
        type: Type.STRING,
        description: 'A concise recommendation based on the analysis of all scenarios.',
      },
      scenarios: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            option: {
              type: Type.STRING,
              description: 'The name or description of the scenario/choice.',
            },
            pros: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of advantages or positive outcomes for this option.',
            },
            cons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of disadvantages or negative outcomes for this option.',
            },
          },
          required: ['option', 'pros', 'cons'],
          propertyOrdering: ['option', 'pros', 'cons'],
        },
      },
    },
    required: ['overallRecommendation', 'scenarios'],
    propertyOrdering: ['overallRecommendation', 'scenarios'],
  };

  const handleScenarioChange = (index: number, value: string) => {
    const newScenarios = [...scenarios];
    newScenarios[index] = value;
    setScenarios(newScenarios);
  };

  const addScenario = () => {
    setScenarios([...scenarios, '']);
  };

  const removeScenario = (index: number) => {
    if (scenarios.length > 2) {
      const newScenarios = scenarios.filter((_, i) => i !== index);
      setScenarios(newScenarios);
    }
  };

  const generatePrompt = useCallback((context: string, choices: string[]): string => {
    return `Context: ${context}
    
Choices to analyze:
${choices.map((choice, index) => `Option ${index + 1}: ${choice}`).join('\n')}

Please analyze these options and provide a JSON response.`;
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!contextPrompt.trim() || scenarios.some(s => !s.trim())) {
      setError("Please fill in the context and at least two scenarios.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponseAnalysis(null);

    try {
      const prompt = generatePrompt(contextPrompt, scenarios);
      const llmConfig: LLMConfig = {
        systemInstruction: systemInstruction,
        temperature: 0.5,
      };
      
      const jsonResponse = await callGeminiApiJson<DecisionAnalysis>(
        prompt,
        decisionAnalysisSchema,
        'gemini-2.5-flash',
        llmConfig
      );

      setResponseAnalysis(jsonResponse);
      onAction(ActionType.DECISION_MADE);

    } catch (err: any) {
      console.error("Decision Helper API Error:", err);
      setError(err.message || "Failed to analyze decision.");
      setResponseAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [contextPrompt, scenarios, generatePrompt, systemInstruction, onAction]);

  const clearDecision = () => {
    setContextPrompt('');
    setScenarios(['', '']);
    setResponseAnalysis(null);
    setError(null);
  };

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-500 drop-shadow-sm">
        ✔️ Instant Decision Helper
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6 mb-6">
        {/* Context Input */}
        <div>
          <label htmlFor="context" className="block text-lg font-bold text-gray-800 mb-2">
            What's the situation? (Context)
          </label>
          <textarea
            ref={contextPromptRef}
            id="context"
            rows={2}
            className="w-full p-4 border-2 border-teal-400 bg-teal-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-emerald-300 focus:border-emerald-600 transition-all duration-300 resize-none text-gray-900 placeholder-teal-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold min-h-24"
            placeholder="E.g., I have a math test tomorrow but my friend invited me to a concert."
            value={contextPrompt}
            onChange={(e) => setContextPrompt(e.target.value)}
            disabled={loading}
            aria-label="Decision Context"
          ></textarea>
        </div>

        {/* Scenarios Inputs */}
        <div className="space-y-4">
          <label className="block text-lg font-bold text-gray-800">
            What are your options?
          </label>
          {scenarios.map((scenario, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-grow">
                 <textarea
                    ref={(el) => { scenarioRefs.current[index] = el; }}
                    rows={1}
                    className="w-full p-4 border-2 border-teal-300 bg-white rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-emerald-200 focus:border-emerald-500 transition-all duration-300 resize-none text-gray-900 placeholder-teal-400 shadow-sm hover:shadow-md font-bold min-h-14"
                    placeholder={`Option ${index + 1} (e.g., Study for the test)`}
                    value={scenario}
                    onChange={(e) => handleScenarioChange(index, e.target.value)}
                    disabled={loading}
                    aria-label={`Option ${index + 1}`}
                  ></textarea>
              </div>
              {scenarios.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeScenario(index)}
                  className="p-3 text-red-500 hover:text-red-700 font-bold text-xl transition-colors bg-red-50 rounded-full h-12 w-12 flex items-center justify-center border border-red-200 shadow-sm"
                  disabled={loading}
                  aria-label="Remove option"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addScenario}
            className="px-4 py-2 bg-teal-100 text-teal-700 font-bold rounded-xl hover:bg-teal-200 transition-colors shadow-sm"
            disabled={loading}
          >
            + Add Another Option
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative shadow-md" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        <div className="flex gap-4">
           {responseAnalysis && (
              <button
                type="button"
                onClick={clearDecision}
                className="flex-1 py-3 px-6 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all shadow-md"
                disabled={loading}
              >
                Clear
              </button>
           )}
           <button
            type="submit"
            className="flex-[2] font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl focus:outline-none bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white focus:ring-emerald-300"
            disabled={loading || !contextPrompt.trim()}
          >
            {loading ? 'Analyzing Options...' : 'Help Me Decide'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex justify-center p-4">
          <Loader message="SLS is weighing the pros and cons..." />
        </div>
      )}

      {responseAnalysis && (
        <div className="mt-8 animate-fade-in space-y-6">
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 p-6 rounded-2xl border-2 border-teal-200 shadow-lg">
                <h3 className="text-xl font-extrabold text-teal-800 mb-2">💡 Overall Recommendation</h3>
                <div className="text-lg text-gray-800 font-medium leading-relaxed">
                   <MarkdownRenderer content={responseAnalysis.overallRecommendation} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {responseAnalysis.scenarios.map((scenario, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
                        <h4 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">{scenario.option}</h4>
                        
                        <div className="mb-3">
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded mb-2">PROS</span>
                            <ul className="list-none space-y-1">
                                {scenario.pros.map((pro, i) => (
                                    <li key={i} className="text-sm text-gray-600 flex items-start">
                                        <span className="text-green-500 mr-2">✓</span> {pro}
                                    </li>
                                ))}
                            </ul>
                        </div>

                         <div>
                            <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded mb-2">CONS</span>
                            <ul className="list-none space-y-1">
                                {scenario.cons.map((con, i) => (
                                    <li key={i} className="text-sm text-gray-600 flex items-start">
                                        <span className="text-red-500 mr-2">✗</span> {con}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default InstantDecisionHelper;
