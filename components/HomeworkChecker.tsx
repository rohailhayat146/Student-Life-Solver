
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ChatComponent from './ChatComponent';
import { callGeminiApi } from '../services/geminiService';
import { LLMConfig, ToolName, SavedItem, OnActionProps, HomeworkCheckerInputs, ActionType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import Loader from './Loader';
import { loadHomeworkCheckerInputs, saveHomeworkCheckerInputs } from '../utils/localStorageService';
import { readFileAsBase64 } from '../utils/imageHelpers';
import { Part } from '@google/genai';

interface HomeworkCheckerProps extends OnActionProps {
  onSaveItem: (item: Omit<SavedItem, 'id' | 'timestamp'>) => void;
}

const HomeworkChecker: React.FC<HomeworkCheckerProps> = ({ onSaveItem, onAction }) => {
  const initialInputs = loadHomeworkCheckerInputs();
  const [question, setQuestion] = useState<string>(initialInputs.question);
  const [userAnswer, setUserAnswer] = useState<string>(initialInputs.userAnswer);
  const [rewriteRequested, setRewriteRequested] = useState<boolean>(initialInputs.rewriteRequested);
  const [questionFile, setQuestionFile] = useState<string | null>(null);
  const [answerFile, setAnswerFile] = useState<string | null>(null);

  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isResponseSaved, setIsResponseSaved] = useState<boolean>(false);

  const questionFileRef = useRef<HTMLInputElement>(null);
  const answerFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentInputs: HomeworkCheckerInputs = { question, userAnswer, rewriteRequested };
    saveHomeworkCheckerInputs(currentInputs);
  }, [question, userAnswer, rewriteRequested]);


  const systemInstruction = `You are the Homework Checker for Student Life Solver (SLS). Your role is to evaluate student answers strictly but helpfully.

Your feedback MUST be clearly structured using Markdown headings (###) and bullet points (-). Always include the following sections:

### Evaluation Summary
- Provide a brief overview of the correctness of the submitted answer.

### Mistakes Found
- List specific errors or inaccuracies identified in the user's answer, using bullet points for each mistake.

### Missing Key Points
- List any important concepts, details, or arguments that were omitted from the user's answer, using bullet points.

If the user explicitly asks for a rewrite, add an additional section:

### Perfect Answer Rewrite
- Rewrite a comprehensive and accurate answer for the question, ensuring it is well-structured and complete.

Keep explanations short and direct. Your tone should be constructive and encouraging.`;

  const generatePrompt = useCallback((
    inputQuestion: string,
    inputAnswer: string,
    requestRewrite: boolean,
    qFile: string | null,
    aFile: string | null
  ): string | (string | Part)[] => {
    const parts: (string | Part)[] = ["Evaluate the following homework answer for this question."];

    // Add Question Content
    parts.push("\nQuestion:");
    if (qFile) {
        const mimeType = qFile.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
        const data = qFile.split(',')[1];
        parts.push({ inlineData: { mimeType, data } });
    }
    if (inputQuestion.trim()) {
        parts.push(`\`\`\`\n${inputQuestion}\n\`\`\``);
    } else if (!qFile) {
        parts.push("[No question text or file provided]");
    }

    // Add Answer Content
    parts.push("\nMy Answer:");
    if (aFile) {
        const mimeType = aFile.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
        const data = aFile.split(',')[1];
        parts.push({ inlineData: { mimeType, data } });
    }
    if (inputAnswer.trim()) {
        parts.push(`\`\`\`\n${inputAnswer}\n\`\`\``);
    } else if (!aFile) {
        parts.push("[No answer text or file provided]");
    }

    parts.push("\nPlease evaluate its correctness, point out any mistakes, and add any missing key points.");

    if (requestRewrite) {
      parts.push(" Additionally, please rewrite a perfect answer for this question.");
    }
    return parts;
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, setFile: (s: string | null) => void) => {
    if (e.target.files && e.target.files[0]) {
        try {
            const base64 = await readFileAsBase64(e.target.files[0]);
            setFile(base64);
        } catch (err) {
            console.error("Failed to read file", err);
            setError("Failed to load file.");
        }
    }
  };

  const removeFile = (setFile: (s: string | null) => void, ref: React.RefObject<HTMLInputElement | null>) => {
    setFile(null);
    if (ref.current) ref.current.value = '';
  };

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null); // Clear previous response
    setIsResponseSaved(false); // Reset saved status for new response

    try {
      const prompt = generatePrompt(question, userAnswer, rewriteRequested, questionFile, answerFile);
      const llmConfig: LLMConfig = {
        systemInstruction: systemInstruction,
        temperature: 0.4,
      };
      const aiResponse = await callGeminiApi(prompt, 'gemini-3-pro-preview', llmConfig);
      setResponse(aiResponse);
      onAction(ActionType.HOMEWORK_CHECKED);
    } catch (err: any) {
      console.error("Homework Checker API Error:", err);
      setError(err.message || "Failed to check homework.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [question, userAnswer, rewriteRequested, questionFile, answerFile, generatePrompt, systemInstruction, onAction]);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
    setIsResponseSaved(false);
  }, []);

  const handleSaveResponse = useCallback(() => {
    if (response) {
      const title = `Homework Check: ${question.substring(0, 40).trim() || 'Worksheet Check'}...`;
      onSaveItem({
        toolName: ToolName.HOMEWORK_CHECKER,
        title: title,
        content: response,
      });
      setIsResponseSaved(true);
    }
  }, [response, question, onSaveItem]);

  const isQuestionImage = questionFile?.startsWith('data:image');
  const isAnswerImage = answerFile?.startsWith('data:image');

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-500 drop-shadow-sm">📚 Homework Checker</h2>
      <div className="space-y-6 mb-6">
        {/* Question Input */}
        <div>
          <label htmlFor="question" className="block text-lg font-bold text-gray-800 mb-2">
            Homework Question (Type or attach photo/PDF):
          </label>
          <div className="relative">
            <textarea
                id="question"
                rows={3}
                className="w-full p-4 pb-16 border-2 border-blue-400 bg-blue-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-sky-300 focus:border-sky-600 transition-all duration-300 text-gray-900 placeholder-blue-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold resize-none"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
                aria-label="Homework question"
                placeholder="E.g., 'Explain the causes of World War I.' or attach a file."
            ></textarea>
            
            {/* Question File Preview */}
            {questionFile && (
                <div className="absolute bottom-4 left-4 z-10 animate-fade-in">
                    <div className="relative group">
                        {isQuestionImage ? (
                            <img src={questionFile} alt="Question" className="h-10 w-10 object-cover rounded-lg border-2 border-blue-300 shadow-sm" />
                        ) : (
                            <div className="h-10 w-10 flex flex-col items-center justify-center bg-white rounded-lg border-2 border-blue-300 shadow-sm text-blue-600">
                                <span className="text-lg">📄</span>
                            </div>
                        )}
                        <button onClick={() => removeFile(setQuestionFile, questionFileRef)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600">✕</button>
                    </div>
                </div>
            )}
            
            {/* Question File Button */}
            <div className="absolute bottom-3 right-3 z-10">
                <input type="file" ref={questionFileRef} accept="image/*,.pdf" onChange={(e) => handleFileSelect(e, setQuestionFile)} className="hidden" id="question-upload" disabled={loading} />
                <label htmlFor="question-upload" className="flex items-center justify-center p-2.5 bg-white text-blue-600 rounded-xl cursor-pointer shadow-md hover:bg-blue-50 hover:text-blue-700 hover:shadow-lg transition-all border border-blue-200" title="Attach question file">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </label>
            </div>
          </div>
        </div>

        {/* Answer Input */}
        <div>
          <label htmlFor="userAnswer" className="block text-lg font-bold text-gray-800 mb-2">
            My Answer (Type or attach photo/PDF of your work):
          </label>
          <div className="relative">
            <textarea
                id="userAnswer"
                rows={6}
                className="w-full p-4 pb-16 border-2 border-blue-400 bg-blue-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-sky-300 focus:border-sky-600 transition-all duration-300 text-gray-900 placeholder-blue-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold resize-none"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={loading}
                aria-label="Your answer to the homework question"
                placeholder="Type your answer here or attach your work file."
            ></textarea>
            
             {/* Answer File Preview */}
             {answerFile && (
                <div className="absolute bottom-4 left-4 z-10 animate-fade-in">
                    <div className="relative group">
                         {isAnswerImage ? (
                            <img src={answerFile} alt="Answer" className="h-10 w-10 object-cover rounded-lg border-2 border-blue-300 shadow-sm" />
                        ) : (
                             <div className="h-10 w-10 flex flex-col items-center justify-center bg-white rounded-lg border-2 border-blue-300 shadow-sm text-blue-600">
                                <span className="text-lg">📄</span>
                            </div>
                        )}
                        <button onClick={() => removeFile(setAnswerFile, answerFileRef)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600">✕</button>
                    </div>
                </div>
            )}
            
            {/* Answer File Button */}
            <div className="absolute bottom-3 right-3 z-10">
                <input type="file" ref={answerFileRef} accept="image/*,.pdf" onChange={(e) => handleFileSelect(e, setAnswerFile)} className="hidden" id="answer-upload" disabled={loading} />
                <label htmlFor="answer-upload" className="flex items-center justify-center p-2.5 bg-white text-blue-600 rounded-xl cursor-pointer shadow-md hover:bg-blue-50 hover:text-blue-700 hover:shadow-lg transition-all border border-blue-200" title="Attach answer file">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </label>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="rewriteRequested"
            type="checkbox"
            className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded-lg shadow-sm"
            checked={rewriteRequested}
            onChange={(e) => setRewriteRequested(e.target.checked)}
            disabled={loading}
            aria-label="Request to rewrite a perfect answer"
          />
          <label htmlFor="rewriteRequested" className="ml-2 block text-base font-semibold text-gray-900">
            Also rewrite a perfect answer.
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative mb-4 shadow-md" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      <div className="relative flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex-grow p-4 overflow-y-auto custom-scrollbar bg-gradient-to-br from-gray-50 to-purple-50">
          {response ? (
            <div className="prose max-w-none text-gray-800 border border-gray-100 rounded-xl p-4 shadow-sm">
              <MarkdownRenderer content={response} />
              <div className="mt-4 text-right">
                <button
                  onClick={handleSaveResponse}
                  disabled={isResponseSaved}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 ${
                    isResponseSaved
                      ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  {isResponseSaved ? 'Saved!' : '💾 Save to My Work'}
                </button>
              </div>
            </div>
          ) : null}
          {loading && (
            <div className="flex justify-center p-4">
              <Loader message="SLS is reviewing your answers..." />
            </div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
          <textarea
            className={`w-full p-3 border-4 rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 resize-none text-gray-900 shadow-lg min-h-12 focus:shadow-xl font-bold hidden`}
            rows={1}
            placeholder="Click submit to check your homework!"
            disabled={loading}
            aria-label="Your input"
          ></textarea>
          <button
            type="submit"
            className={`mt-3 w-full font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl focus:outline-none bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white focus:ring-sky-300`}
            disabled={loading || ((!question.trim() && !questionFile) && (!userAnswer.trim() && !answerFile))}
          >
            {loading ? 'Processing...' : 'Check Homework'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default HomeworkChecker;
