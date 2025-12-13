import React, { useState, useCallback, useRef, useEffect, FormEvent } from 'react';
import ChatComponent from './ChatComponent';
import { callGeminiApi } from '../services/geminiService';
import { LLMConfig, OnActionProps, ActionType } from '../types';
import Loader from './Loader';
import MarkdownRenderer from './MarkdownRenderer';

const JOURNAL_PROMPTS = [
  "What is currently causing you the most stress or discomfort in your academic or personal life?",
  "How does this feeling manifest physically or emotionally for you? (e.g., tension, fatigue, irritability, racing thoughts)?",
  "When was the last time you felt truly calm or happy, and what were you doing during that time?",
  "What is one small, realistic action you could take today or tomorrow to address this feeling, even if it's just a tiny step?",
  "Is there anything else you want to share about your current mood or situation that the AI should know?"
];

interface JournalEntry {
  prompt: string;
  response: string;
}

interface MoodStressManagerProps extends OnActionProps {}

const MoodStressManager: React.FC<MoodStressManagerProps> = ({ onAction }) => {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isJournalingMode, setIsJournalingMode] = useState<boolean>(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(0);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(
    JOURNAL_PROMPTS.map(prompt => ({ prompt, response: '' }))
  );
  const [currentJournalInput, setCurrentJournalInput] = useState<string>('');
  const journalTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (journalTextareaRef.current) {
      journalTextareaRef.current.style.height = 'auto';
      journalTextareaRef.current.style.height = `${journalTextareaRef.current.scrollHeight}px`;
    }
  }, [currentJournalInput, currentPromptIndex, isJournalingMode]);

  useEffect(() => {
    if (isJournalingMode) {
      setCurrentJournalInput(journalEntries[currentPromptIndex].response);
    }
  }, [currentPromptIndex, isJournalingMode, journalEntries]);


  const systemInstruction = `You are the Mood & Stress Manager for Student Life Solver (SLS). Your role is to respond with empathy and practical advice when a student expresses stress, sadness, frustration, or confusion.

When the user provides a *single sentence* about their feeling, respond directly based on that.
When the user provides *journal entries*, synthesize all provided context for a deeper, more tailored response.

Your response MUST be clearly structured using Markdown headings (###) and bullet points (-). Always include the following sections:

### Empathy and Support
- Start by acknowledging and validating the user's feelings. Your empathetic message should be concise and directly address the core sentiment from their input (whether a quick feeling or aggregated journal entries).

### Calming Technique
- Offer one short and concise calming technique (e.g., a simple breathing exercise, a quick grounding technique).
- Explain the steps of the technique using bullet points.

### Productivity / Motivation Boost
- Provide brief, actionable advice to help with productivity or motivation, specifically tailored to the context provided by the user (especially from journal entries).
- List specific tips using bullet points.

Keep your tone friendly, supportive, and not formal. Always prioritize emotional support before advice.`;

  const generatePrompt = useCallback((
    input: string | JournalEntry[]
  ): string => {
    if (typeof input === 'string') {
      return `I'm feeling: ${input}. Please respond with empathy, a short calming technique, and some productivity or motivation advice.`;
    } else {
      const compiledJournal = input.map(entry => `Prompt: ${entry.prompt}\nMy Response: ${entry.response}`).join('\n\n');
      return `Here are my journal entries reflecting on my current mood and stress. Please read through them and provide empathetic support, a calming technique, and productivity/motivation advice tailored to what I've shared.

${compiledJournal}
`;
    }
  }, []);

  const handleSubmit = useCallback(async (input: string | JournalEntry[]) => {
    setLoading(true);
    setError(null);
    setResponse(null); // Clear previous response

    try {
      const prompt = generatePrompt(input);
      const llmConfig: LLMConfig = {
        systemInstruction: systemInstruction,
        temperature: 0.8,
      };
      const aiResponse = await callGeminiApi(prompt, 'gemini-2.5-flash', llmConfig);
      setResponse(aiResponse);
      onAction(ActionType.MOOD_UPDATED);
      setIsJournalingMode(false);
      setJournalEntries(JOURNAL_PROMPTS.map(prompt => ({ prompt, response: '' })));
      setCurrentPromptIndex(0);
      setCurrentJournalInput('');

    } catch (err: any) {
      console.error("Mood & Stress Manager API Error:", err);
      setError(err.message || "Failed to provide support.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [generatePrompt, systemInstruction, onAction]);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
    setIsJournalingMode(false);
    setJournalEntries(JOURNAL_PROMPTS.map(prompt => ({ prompt, response: '' })));
    setCurrentPromptIndex(0);
    setCurrentJournalInput('');
  }, []);

  const startJournaling = useCallback(() => {
    setIsJournalingMode(true);
    setResponse(null);
    setError(null);
    setCurrentPromptIndex(0);
    setJournalEntries(JOURNAL_PROMPTS.map(prompt => ({ prompt, response: '' })));
    setCurrentJournalInput('');
  }, []);

  const handleJournalInputSave = useCallback(() => {
    const updatedEntries = [...journalEntries];
    updatedEntries[currentPromptIndex].response = currentJournalInput;
    setJournalEntries(updatedEntries);
  }, [journalEntries, currentPromptIndex, currentJournalInput]);

  const nextPrompt = useCallback(() => {
    handleJournalInputSave();
    if (currentPromptIndex < JOURNAL_PROMPTS.length - 1) {
      setCurrentPromptIndex(currentPromptIndex + 1);
    } else {
      handleSubmit(journalEntries);
    }
  }, [currentPromptIndex, journalEntries, handleJournalInputSave, handleSubmit]);

  const prevPrompt = useCallback(() => {
    handleJournalInputSave();
    if (currentPromptIndex > 0) {
      setCurrentPromptIndex(currentPromptIndex - 1);
    }
  }, [currentPromptIndex, handleJournalInputSave]);

  const exitJournaling = useCallback(() => {
    setIsJournalingMode(false);
    setCurrentPromptIndex(0);
    setCurrentJournalInput('');
    setJournalEntries(JOURNAL_PROMPTS.map(prompt => ({ prompt, response: '' })));
  }, []);

  const handleJournalSubmitClick = useCallback((e: FormEvent) => {
    e.preventDefault();
    handleJournalInputSave();
    handleSubmit(journalEntries);
  }, [handleJournalInputSave, handleSubmit, journalEntries]);

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-rose-500 drop-shadow-sm">😌 Mood & Stress Manager</h2>

      {error && (
        <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative mb-4 shadow-md" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {!isJournalingMode ? (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
            <button
              onClick={startJournaling}
              className="flex-1 w-full md:w-auto px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
              disabled={loading}
            >
              💖 Start Guided Journaling
            </button>
            <div className="flex-1 w-full text-center text-gray-600 font-semibold md:text-xl">
              — OR —
            </div>
            <p className="flex-1 w-full md:w-auto text-gray-700 font-semibold text-center md:text-left">
              Type a quick message below for instant support.
            </p>
          </div>

          <ChatComponent
            placeholder={[
              "How are you really feeling today? I'm here to listen.",
              "Feeling stressed? Let's find some calm together.",
              "Tell me what's on your mind, no judgment here!",
              "Need a motivation boost or a calming technique? Just ask!",
            ]}
            onSubmit={(feeling) => handleSubmit(feeling)}
            response={response}
            loading={loading}
            clearResponse={clearResponse}
            inputColorClasses="border-pink-400 bg-pink-50 focus:ring-rose-300 focus:border-rose-600 placeholder-pink-600"
            buttonColorClasses="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white focus:ring-rose-300"
            onAction={onAction}
            actionType={ActionType.MOOD_UPDATED}
            loadingMessage="SLS is finding the right words for you..."
          />
        </>
      ) : (
        <div className="relative flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden border border-purple-200">
          <div className="flex-grow p-4 overflow-y-auto custom-scrollbar bg-gradient-to-br from-purple-50 to-pink-50">
            {response ? (
              <div className="prose max-w-none text-gray-800 border border-gray-100 rounded-xl p-4 shadow-sm">
                <MarkdownRenderer content={response} />
              </div>
            ) : (
              <div className="text-center p-6 bg-purple-50 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-purple-800 mb-2">Guided Journaling</h3>
                <p className="text-gray-700 text-lg mb-4">
                  Reflect deeply with these prompts. Your honest answers help me support you better.
                </p>
                <div className="p-4 bg-white rounded-lg shadow-md border border-purple-200">
                  <p className="text-sm font-semibold text-purple-600 mb-2">
                    Prompt {currentPromptIndex + 1} of {JOURNAL_PROMPTS.length}
                  </p>
                  <p className="text-lg text-gray-900 font-medium mb-4">
                    {JOURNAL_PROMPTS[currentPromptIndex]}
                  </p>
                  <textarea
                    ref={journalTextareaRef}
                    className="w-full p-4 border-2 border-fuchsia-400 bg-fuchsia-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-purple-300 focus:border-purple-600 transition-all duration-300 resize-none text-gray-900 placeholder-fuchsia-600 shadow-md hover:scale-[1.01] hover:shadow-xl min-h-24 focus:shadow-xl font-bold"
                    rows={4}
                    placeholder="Write your thoughts here..."
                    value={currentJournalInput}
                    onChange={(e) => setCurrentJournalInput(e.target.value)}
                    disabled={loading}
                    aria-label={`Response to journal prompt ${currentPromptIndex + 1}`}
                  ></textarea>
                </div>
              </div>
            )}
            {loading && (
              <div className="flex justify-center p-4">
                <Loader message="SLS is reflecting on your journal..." />
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0 flex justify-between gap-3">
            <button
              onClick={exitJournaling}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl transition-all duration-300 hover:bg-gray-300 hover:scale-[1.01] active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Exit Journaling
            </button>
            <div className="flex gap-3">
              <button
                onClick={prevPrompt}
                className="px-4 py-2 bg-purple-100 text-purple-700 font-bold rounded-xl transition-all duration-300 hover:bg-purple-200 hover:scale-[1.01] active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || currentPromptIndex === 0}
              >
                Previous
              </button>
              {currentPromptIndex < JOURNAL_PROMPTS.length - 1 ? (
                <button
                  onClick={nextPrompt}
                  className="px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  Next Prompt
                </button>
              ) : (
                <button
                  onClick={handleJournalSubmitClick}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-lime-600 hover:from-green-700 hover:to-lime-700 text-white font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !currentJournalInput.trim()}
                >
                  Submit Journal 🚀
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoodStressManager;