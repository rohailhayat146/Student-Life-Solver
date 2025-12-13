
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ChatComponent from './ChatComponent';
import { callGeminiApi } from '../services/geminiService';
import { NoteFormat, LLMConfig, ToolName, SavedItem, OnActionProps, NotesSummarizerInputs, ActionType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import Loader from './Loader';
import { loadNotesSummarizerInputs, saveNotesSummarizerInputs } from '../utils/localStorageService';
import { readFileAsBase64 } from '../utils/imageHelpers';
import { Part } from '@google/genai';

interface NotesCleanerSummarizerProps extends OnActionProps {
  onSaveItem: (item: Omit<SavedItem, 'id' | 'timestamp'>) => void;
}

const NotesCleanerSummarizer: React.FC<NotesCleanerSummarizerProps> = ({ onSaveItem, onAction }) => {
  const initialInputs = loadNotesSummarizerInputs();
  const [notesInput, setNotesInput] = useState<string>(initialInputs.notesInput);
  const [format, setFormat] = useState<NoteFormat>(initialInputs.format);
  const [selectedFile, setSelectedFile] = useState<string | null>(null); // Base64 string for image or pdf
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isResponseSaved, setIsResponseSaved] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentInputs: NotesSummarizerInputs = { notesInput, format };
    saveNotesSummarizerInputs(currentInputs);
  }, [notesInput, format]);


  const systemInstruction = `You are the Notes Cleaner & Smart Summarizer for Student Life Solver (SLS). Your job is to extract important points from long, messy text, OCR text, or images/PDFs of notes, remove irrelevant information, and rewrite the content in a specified format (exam-style notes, bullet points, or revision-sheet format).

Your output must be well-structured and easy to digest, using Markdown. Always use clear Markdown headings (e.g., ### Summary, ### Key Points) and bullet points (-) for lists. Avoid long, unformatted paragraphs. Keep explanations simple, accurate, and concise.`;

  const generatePrompt = useCallback((
    inputNotes: string,
    outputFormat: NoteFormat,
    fileData: string | null
  ): string | (string | Part)[] => {
    const textPrompt = `Please clean and summarize the following notes. Extract important points, remove irrelevant information, and rewrite them in a ${outputFormat} format.`;
    
    if (!fileData) {
        return `${textPrompt}\n\nNotes:\n\`\`\`\n${inputNotes}\n\`\`\``;
    }

    // Multimodal prompt construction
    const parts: (string | Part)[] = [textPrompt];
    
    // Extract mime type and base64 data
    const mimeType = fileData.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
    const data = fileData.split(',')[1];

    parts.push({
        inlineData: {
            mimeType: mimeType,
            data: data
        }
    });

    if (inputNotes.trim()) {
        parts.push(`\nAdditional Notes Text:\n\`\`\`\n${inputNotes}\n\`\`\``);
    }

    return parts;
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        try {
            const base64 = await readFileAsBase64(e.target.files[0]);
            setSelectedFile(base64);
        } catch (err) {
            console.error("Failed to read file", err);
            setError("Failed to load file. Please try again.");
        }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null); // Clear previous response
    setIsResponseSaved(false); // Reset saved status for new response

    try {
      const prompt = generatePrompt(notesInput, format, selectedFile);
      const llmConfig: LLMConfig = {
        systemInstruction: systemInstruction,
        temperature: 0.5,
      };
      const aiResponse = await callGeminiApi(prompt, 'gemini-2.5-flash', llmConfig);
      setResponse(aiResponse);
      onAction(ActionType.NOTES_SUMMARIZED);
    } catch (err: any) {
      console.error("Notes Cleaner API Error:", err);
      setError(err.message || "Failed to process notes.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [notesInput, format, selectedFile, generatePrompt, systemInstruction, onAction]);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
    setIsResponseSaved(false);
  }, []);

  const handleSaveResponse = useCallback(() => {
    if (response) {
      const title = `Notes Summary: ${notesInput.substring(0, 30).trim() || 'File Note'}...`;
      onSaveItem({
        toolName: ToolName.NOTES_CLEANER,
        title: title,
        content: response,
      });
      setIsResponseSaved(true);
    }
  }, [response, notesInput, onSaveItem]);

  const isImage = selectedFile?.startsWith('data:image');

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-500 drop-shadow-sm">📝 Notes Cleaner & Smart Summarizer</h2>
      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="notesInput" className="block text-lg font-bold text-gray-800 mb-2">
            Paste your notes, or upload a photo/PDF:
          </label>
          <div className="relative">
            <textarea
                id="notesInput"
                rows={8}
                className="w-full p-4 pb-16 border-2 border-orange-400 bg-orange-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-red-300 focus:border-red-600 transition-all duration-300 text-gray-900 placeholder-orange-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold resize-none"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={loading}
                aria-label="Notes input"
                placeholder="Type your notes here, or attach an image or PDF..."
            ></textarea>
            
            {/* File Preview Area */}
            {selectedFile && (
                <div className="absolute bottom-4 left-4 z-10 animate-fade-in">
                    <div className="relative group">
                        {isImage ? (
                            <img src={selectedFile} alt="Selected note" className="h-12 w-12 object-cover rounded-lg border-2 border-orange-300 shadow-sm" />
                        ) : (
                            <div className="h-12 w-12 flex flex-col items-center justify-center bg-white rounded-lg border-2 border-orange-300 shadow-sm text-orange-600">
                                <span className="text-xl">📄</span>
                                <span className="text-[8px] font-bold uppercase">FILE</span>
                            </div>
                        )}
                        <button 
                            onClick={removeFile}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                            aria-label="Remove file"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* File Upload Button */}
            <div className="absolute bottom-3 right-3 z-10">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*,.pdf" 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    id="note-file-upload"
                    disabled={loading}
                />
                <label 
                    htmlFor="note-file-upload" 
                    className="flex items-center justify-center p-2.5 bg-white text-orange-600 rounded-xl cursor-pointer shadow-md hover:bg-orange-50 hover:text-orange-700 hover:shadow-lg transition-all duration-300 border border-orange-200"
                    title="Attach a photo or PDF of your notes"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </label>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="format" className="block text-lg font-bold text-gray-800 mb-2">
            Output Format:
          </label>
          <select
            id="format"
            className="w-full p-4 border-2 border-orange-400 bg-orange-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-red-300 focus:border-red-600 transition-all duration-300 text-gray-900 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold"
            value={format}
            onChange={(e) => setFormat(e.target.value as NoteFormat)}
            disabled={loading}
            aria-label="Output format for notes"
          >
            <option value="exam-style">Exam-Style Notes</option>
            <option value="bullet-points">Bullet Points</option>
            <option value="revision-sheet">Revision-Sheet Format</option>
          </select>
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
              <Loader message="SLS is structuring your notes..." />
            </div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
          <textarea
            className={`w-full p-3 border-4 rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 resize-none text-gray-900 shadow-lg min-h-12 focus:shadow-xl font-bold hidden`}
            rows={1}
            placeholder="Click submit to summarize your notes!"
            disabled={loading}
            aria-label="Your input"
          ></textarea>
          <button
            type="submit"
            className={`mt-3 w-full font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl focus:outline-none bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white focus:ring-red-300`}
            disabled={loading || (!notesInput.trim() && !selectedFile)}
          >
            {loading ? 'Processing...' : 'Summarize Notes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NotesCleanerSummarizer;
