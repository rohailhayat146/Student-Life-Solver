

import React, { useState, useCallback, useRef, useEffect, FormEvent } from 'react';
import { callGeminiApi } from '../services/geminiService';
import { LLMConfig, OnActionProps, DifficultyLevel, NoteFormat, ActionType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import Loader from './Loader';
import {
  loadDailyAchievementState,
  loadStudyRoutineInputs,
  loadNotesSummarizerInputs,
  loadHomeworkCheckerInputs,
} from '../utils/localStorageService';

interface PredictMyGradeProps extends OnActionProps {}

const PredictMyGrade: React.FC<PredictMyGradeProps> = ({ onAction }) => {
  const [subjectName, setSubjectName] = useState<string>('');
  const [subjectDifficulty, setSubjectDifficulty] = useState<DifficultyLevel>('medium');
  const [pastPerformance, setPastPerformance] = useState<string>('');
  const [quizResults, setQuizResults] = useState<string>('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const subjectNameRef = useRef<HTMLTextAreaElement>(null);
  const pastPerformanceRef = useRef<HTMLTextAreaElement>(null);
  const quizResultsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (subjectNameRef.current) {
      subjectNameRef.current.style.height = 'auto';
      subjectNameRef.current.style.height = `${subjectNameRef.current.scrollHeight}px`;
    }
  }, [subjectName]);

  useEffect(() => {
    if (pastPerformanceRef.current) {
      pastPerformanceRef.current.style.height = 'auto';
      pastPerformanceRef.current.style.height = `${pastPerformanceRef.current.scrollHeight}px`;
    }
  }, [pastPerformance]);

  useEffect(() => {
    if (quizResultsRef.current) {
      quizResultsRef.current.style.height = 'auto';
      quizResultsRef.current.style.height = `${quizResultsRef.current.scrollHeight}px`;
    }
  }, [quizResults]);

  const systemInstruction = `You are the Grade Predictor for Student Life Solver (SLS). Your goal is to intelligently estimate a student's expected grade based on the inputs provided.

### 🛑 OUTPUT FORMAT RULES
- **NO PARAGRAPHS**. Use **Markdown Tables** for everything.
- Visuals: Use professional emojis (📈, 📉, ✅, ⚠️) sparingly.
- Tone: Analytical, Encouraging, Premium.

### 1. 📊 Grade Summary
| Category | Result |
| :--- | :--- |
| **Predicted Grade** | [Grade] (e.g., **A**) |
| **Score Range** | [Range] (e.g., **82-85%**) |
| **Confidence** | [High/Medium/Low] |

### 2. 🧠 Reasoning Analysis
| Factor | Effect on Grade |
| :--- | :--- |
| **Study Consistency** | [Short analysis] |
| **Subject Difficulty** | [Short analysis] |
| **Past Performance** | [Short analysis] |
| **Engagement (XP)** | [Short analysis] |

### 3. 🚀 Next Steps
| Action | Impact |
| :--- | :--- |
| **[Action 1]** | [Why it helps, 1 line max] |
| **[Action 2]** | [Why it helps, 1 line max] |
| **[Action 3]** | [Why it helps, 1 line max] |

### SCORING SCALE
- 90–100 = A*
- 80–89 = A
- 70–79 = B
- 60–69 = C
- 50–59 = D
- Below 50 = U
`;

  const generatePrompt = useCallback((
    currentSubjectName: string,
    currentSubjectDifficulty: DifficultyLevel,
    currentPastPerformance: string,
    currentQuizResults: string,
    xpLevel: number,
    currentStreak: number,
    studyRoutineInputs: { subjects: string; hoursPerDay: number; difficulty: DifficultyLevel; },
    notesSummarizerInputs: { notesInput: string; format: NoteFormat; },
    homeworkCheckerInputs: { question: string; userAnswer: string; rewriteRequested: boolean; }
  ): string => {
    // Helper to truncate long strings to save tokens
    const truncate = (str: string, len: number) => str.length > len ? str.substring(0, len) + '...' : str;

    let prompt = `Predict my grade for **${truncate(currentSubjectName, 100)}**.
My perceived difficulty for this subject is **${currentSubjectDifficulty}**.

Here's some information about my general academic habits and performance:

**App Engagement (XP Level):** Level ${xpLevel}.
**App Usage Streak:** ${currentStreak} days.

**Study Routine Habits (from Study Routine Fixer):**
- I usually study for ${studyRoutineInputs.hoursPerDay} hours per day.
- My overall difficulty for my subjects is considered '${studyRoutineInputs.difficulty}'.
- Subjects I've recently planned to study: ${studyRoutineInputs.subjects ? truncate(studyRoutineInputs.subjects, 150) : 'No subjects entered recently.'}.

**Notes Quality (from Notes Cleaner & Smart Summarizer):**
- I have recently used the notes summarizer tool.
- My preferred format for notes is '${notesSummarizerInputs.format}'.
- Notes content length (approx.): ${notesSummarizerInputs.notesInput.length > 0 ? notesSummarizerInputs.notesInput.length + ' characters' : 'No recent notes input.'}

**Homework Completion/Consistency (from Homework Checker):**
- I have recently used the homework checker tool.
- Last checked question (snippet): '${homeworkCheckerInputs.question ? truncate(homeworkCheckerInputs.question, 250) : 'No recent homework checked.'}'.
`;

    if (currentPastPerformance.trim()) {
      prompt += `\n**My Past Performance:**
- ${truncate(currentPastPerformance.trim(), 300)}.`;
    }

    if (currentQuizResults.trim()) {
      prompt += `\n**My Quiz or Practice Results:**
- ${truncate(currentQuizResults.trim(), 300)}.`;
    }

    prompt += `\nPlease provide my predicted grade, the reasoning, and specific improvement steps to achieve a higher grade.`;

    return prompt;
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      setError("Please enter the subject name to predict your grade.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const dailyAchievementState = loadDailyAchievementState();
      const studyRoutineInputs = loadStudyRoutineInputs();
      const notesSummarizerInputs = loadNotesSummarizerInputs();
      const homeworkCheckerInputs = loadHomeworkCheckerInputs();

      const prompt = generatePrompt(
        subjectName,
        subjectDifficulty,
        pastPerformance,
        quizResults,
        dailyAchievementState.xpState.level,
        dailyAchievementState.currentStreak,
        studyRoutineInputs,
        notesSummarizerInputs,
        homeworkCheckerInputs
      );

      const llmConfig: LLMConfig = {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      };

      // Ensure free tier model is used
      const aiResponse = await callGeminiApi(prompt, 'gemini-2.5-flash', llmConfig);
      setResponse(aiResponse);
      onAction(ActionType.GRADE_PREDICTED);

    } catch (err: any) {
      console.error("Predict My Grade API Error:", err);
      // Improved error message for quota issues
      if (err.message && (err.message.includes('429') || err.message.includes('Quota') || err.message.includes('Resource exhausted'))) {
          setError("Usage limit reached. Please wait a moment before trying again.");
      } else {
          setError(err.message || "Failed to predict grade.");
      }
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [subjectName, subjectDifficulty, pastPerformance, quizResults, generatePrompt, systemInstruction, onAction]);

  const clearPrediction = useCallback(() => {
    setSubjectName('');
    setSubjectDifficulty('medium');
    setPastPerformance('');
    setQuizResults('');
    setResponse(null);
    setError(null);
  }, []);

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <style>{`
        .prose table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          border: 1px solid #e0e7ff;
        }
        .prose thead {
          background: linear-gradient(90deg, #e0e7ff 0%, #ede9fe 100%);
        }
        .prose th {
          color: #4338ca;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          padding: 1rem;
          text-align: left;
          border-bottom: 2px solid #a5b4fc;
        }
        .prose td {
          border-bottom: 1px solid #f3f4f6;
          padding: 1rem;
          color: #374151;
          font-size: 0.95rem;
          vertical-align: middle;
        }
        .prose tr:last-child td {
          border-bottom: none;
        }
        .prose strong {
            color: #4f46e5;
        }
      `}</style>
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 drop-shadow-sm">💯 Predict My Grade</h2>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div>
          <label htmlFor="subject-name" className="block text-lg font-bold text-gray-800 mb-2">
            Subject Name: <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={subjectNameRef}
            id="subject-name"
            rows={1}
            className="w-full p-4 border-2 border-indigo-400 bg-indigo-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-purple-300 focus:border-purple-600 transition-all duration-300 resize-none text-gray-900 placeholder-indigo-600 shadow-md hover:scale-[1.01] hover:shadow-xl min-h-12 focus:shadow-xl font-bold"
            placeholder="E.g., Biology, Calculus, English Literature"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            disabled={loading}
            aria-label="Subject name"
            required
          ></textarea>
        </div>

        <div>
          <label htmlFor="subject-difficulty" className="block text-lg font-bold text-gray-800 mb-2">
            My Perceived Difficulty for This Subject:
          </label>
          <select
            id="subject-difficulty"
            className="w-full p-4 border-2 border-indigo-400 bg-indigo-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-purple-300 focus:border-purple-600 transition-all duration-300 text-gray-900 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold"
            value={subjectDifficulty}
            onChange={(e) => setSubjectDifficulty(e.target.value as DifficultyLevel)}
            disabled={loading}
            aria-label="Subject difficulty"
          >
            <option value="easy">😌 Easy</option>
            <option value="medium">💪 Medium</option>
            <option value="hard">🧠 Hard</option>
          </select>
        </div>

        <div>
          <label htmlFor="past-performance" className="block text-lg font-bold text-gray-800 mb-2">
            Past Performance (Optional - e.g., last test score, general strengths/weaknesses):
          </label>
          <textarea
            ref={pastPerformanceRef}
            id="past-performance"
            rows={2}
            className="w-full p-4 border-2 border-indigo-300 bg-indigo-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-purple-200 focus:border-purple-500 transition-all duration-300 resize-none text-gray-900 placeholder-indigo-500 shadow-md hover:scale-[1.01] hover:shadow-xl min-h-16 focus:shadow-lg font-bold"
            placeholder="E.g., 'Got 75% on last midterm', 'Struggle with essay writing', 'Good at problem solving'"
            value={pastPerformance}
            onChange={(e) => setPastPerformance(e.target.value)}
            disabled={loading}
            aria-label="Past performance"
          ></textarea>
        </div>

        <div>
          <label htmlFor="quiz-results" className="block text-lg font-bold text-gray-800 mb-2">
            Quiz or Practice Results (Optional - e.g., mock exam scores):
          </label>
          <textarea
            ref={quizResultsRef}
            id="quiz-results"
            rows={2}
            className="w-full p-4 border-2 border-indigo-300 bg-indigo-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-purple-200 focus:border-purple-500 transition-all duration-300 resize-none text-gray-900 placeholder-indigo-500 shadow-md hover:scale-[1.01] hover:shadow-xl min-h-16 focus:shadow-lg font-bold"
            placeholder="E.g., 'Scored 8/10 on practice quiz 1', 'Got 60% on mock exam for essay writing'"
            value={quizResults}
            onChange={(e) => setQuizResults(e.target.value)}
            disabled={loading}
            aria-label="Quiz or practice results"
          ></textarea>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative shadow-md" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl focus:outline-none bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white focus:ring-purple-300"
          disabled={loading || !subjectName.trim()}
          aria-label="Predict my grade"
        >
          {loading ? 'Predicting Grade...' : 'Predict My Grade'}
        </button>
      </form>

      {loading && (
        <div className="flex justify-center p-4">
          <Loader message="SLS is predicting your academic future..." />
        </div>
      )}

      {response && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
          <h3 className="text-xl font-bold text-purple-700 mb-3 text-center">AI Grade Prediction:</h3>
          <div className="prose max-w-none text-gray-800">
            <MarkdownRenderer content={response} />
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={clearPrediction}
              className="px-6 py-2 bg-pink-100 text-pink-700 font-bold rounded-xl transition-all duration-300 hover:bg-pink-200 hover:scale-105 shadow-md"
              aria-label="Clear current prediction"
            >
              Clear Prediction
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictMyGrade;
