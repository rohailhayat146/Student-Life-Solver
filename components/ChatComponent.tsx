
import React, { useState, FormEvent, useEffect, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import Loader from './Loader';
import { OnActionProps, ActionType } from '../types'; // Import OnActionProps and ActionType

interface ChatComponentProps extends Partial<OnActionProps> { // Make onAction optional
  placeholder: string | string[]; // Allow placeholder to be a string or an array of strings
  onSubmit: (prompt: string) => void;
  response: string | null;
  loading: boolean;
  clearResponse: () => void;
  className?: string;
  inputColorClasses?: string; // New prop for input coloring
  buttonColorClasses?: string; // New prop for button coloring
  actionType?: ActionType; // Optional action type for specific XP rewards
  actionData?: Record<string, any>; // Optional data for the action
  loadingMessage?: string; // New prop for custom loader text
}

const ChatComponent: React.FC<ChatComponentProps> = ({
  placeholder,
  onSubmit,
  response,
  loading,
  clearResponse,
  className,
  inputColorClasses = 'border-purple-400 bg-purple-50 focus:ring-purple-300 focus:border-purple-600 placeholder-purple-600', // Default purple theme
  buttonColorClasses = 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white focus:ring-purple-300', // Default purple theme
  onAction, // Destructure onAction
  actionType = ActionType.DECISION_MADE, // Default action type if not provided
  actionData,
  loadingMessage = 'SLS is responding...', // Default loading message
}) => {
  const [input, setInput] = useState<string>('');
  const [currentDynamicPlaceholder, setCurrentDynamicPlaceholder] = useState<string>('');
  const placeholderIndexRef = useRef(0);
  const placeholderArray = Array.isArray(placeholder) ? placeholder : [placeholder];
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for auto-resizing

  useEffect(() => {
    if (placeholderArray.length > 0) {
      setCurrentDynamicPlaceholder(placeholderArray[0]);
      if (placeholderArray.length > 1) {
        const intervalId = setInterval(() => {
          placeholderIndexRef.current = (placeholderIndexRef.current + 1) % placeholderArray.length;
          setCurrentDynamicPlaceholder(placeholderArray[placeholderIndexRef.current]);
        }, 5000); // Change placeholder every 5 seconds
        return () => clearInterval(intervalId);
      }
    }
  }, [placeholderArray]);

  // Auto-resize textarea effect
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height to recalculate
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
    }
  }, [input]);

  const handleSubmit = async (e: FormEvent) => { // Make handleSubmit async
    e.preventDefault();
    if (input.trim() && !loading) {
      clearResponse(); // Clear previous response before new submission
      await onSubmit(input); // Wait for onSubmit to complete
      if (onAction) { // Call onAction after onSubmit (assuming onSubmit is successful)
        onAction(actionType, actionData);
      }
      setInput(''); // Clear input after submission
    }
  };

  return (
    <div className={`relative flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      <div className="flex-grow p-4 overflow-y-auto custom-scrollbar bg-gradient-to-br from-gray-50 to-purple-50">
        {response ? (
          <div className="prose max-w-none text-gray-800 border border-gray-100 rounded-xl p-4 shadow-sm">
            <MarkdownRenderer content={response} />
          </div>
        ) : null}
        {loading && (
          <div className="flex justify-center p-4">
            <Loader message={loadingMessage} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
        <textarea
          ref={textareaRef}
          className={`w-full p-4 border-2 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-300 resize-none text-gray-900 shadow-md min-h-12 focus:shadow-xl font-bold overflow-hidden ${inputColorClasses}`}
          rows={1} // Starts with 1 row, auto-resize will expand
          placeholder={currentDynamicPlaceholder} // Use the dynamic placeholder
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          aria-label="Your input"
        ></textarea>
        <button
          type="submit"
          className={`mt-3 w-full font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl focus:outline-none ${buttonColorClasses}`}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default ChatComponent;
