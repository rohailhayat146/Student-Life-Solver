
import React, { useRef } from 'react';
import { ToolName } from '../types';

interface NavbarProps {
  activeTool: ToolName;
  onToolSelect: (tool: ToolName) => void;
  onOpenSavedWork: () => void; // Prop for opening saved work modal
}

const Navbar: React.FC<NavbarProps> = ({ activeTool, onToolSelect, onOpenSavedWork }) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable tab container

  const tools = [
    { name: ToolName.DAILY_ACHIEVEMENTS, icon: '🌟' }, // NEW: Daily Achievements tab
    { name: ToolName.STUDY_ROUTINE, icon: '🎒' },
    { name: ToolName.NOTES_CLEANER, icon: '📝' },
    { name: ToolName.HOMEWORK_CHECKER, icon: '📚' },
    { name: ToolName.DEADLINE_PRESSURE, icon: '⏳' }, // New Tool
    { name: ToolName.MOOD_STRESS, icon: '😌' },
    { name: ToolName.DECISION_HELPER, icon: '✔️' },
    { name: ToolName.PREDICT_MY_GRADE, icon: '💯' },
  ];

  const getShortToolName = (fullName: ToolName) => {
    switch (fullName) {
      case ToolName.DAILY_ACHIEVEMENTS: return 'Daily'; // Shortened for cleaner UI
      case ToolName.STUDY_ROUTINE: return 'Study';
      case ToolName.NOTES_CLEANER: return 'Notes';
      case ToolName.HOMEWORK_CHECKER: return 'Homework';
      case ToolName.MOOD_STRESS: return 'Mood';
      case ToolName.DECISION_HELPER: return 'Decision';
      case ToolName.PREDICT_MY_GRADE: return 'Grade'; // Shortened for cleaner UI
      case ToolName.DEADLINE_PRESSURE: return 'Pressure'; // Shortened for cleaner UI
      default: return '';
    }
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-30 p-2 sm:p-4">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 max-w-5xl">
        {/* RLS Title (Left) */}
        <h1 className="text-xl sm:text-3xl font-extrabold p-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 drop-shadow-sm flex-shrink-0">SLS</h1>

        {/* Primary Actions Group: Saved Work, Tools, User Info */}
        <div className="flex flex-grow items-center gap-2 sm:gap-4 w-full sm:w-auto min-w-0">
          {/* Saved Work Button - Now more prominent and centrally located */}
          <button
            onClick={onOpenSavedWork}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm sm:px-4 sm:py-2 bg-indigo-100 text-indigo-700 font-bold rounded-xl shadow-md hover:bg-indigo-200 transition-colors duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            aria-label="Open saved work"
          >
            <span className="text-lg sm:text-xl">💾</span>
            <span className="hidden sm:inline">Saved Work</span>
          </button>

          {/* Tools Container with Scrolling */}
          <div className="relative flex items-center flex-grow min-w-0 py-2">
            <div
              ref={tabsContainerRef}
              className="flex flex-nowrap overflow-x-auto py-2 px-1 scroll-smooth flex-grow custom-scrollbar-horizontal gap-2"
            >
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => onToolSelect(tool.name)}
                  className={`
                    flex-shrink-0 mx-1 inline-flex items-center gap-2
                    px-3 py-2 text-sm sm:px-4 sm:py-3 sm:text-base font-bold rounded-xl transition-all duration-300 transform
                    whitespace-nowrap
                    ${activeTool === tool.name
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl hover:scale-105 hover:shadow-2xl'
                      : 'bg-gray-100 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-800 hover:scale-105 hover:shadow-md'}
                  `}
                  aria-current={activeTool === tool.name ? 'page' : undefined}
                >
                  <span className="text-lg sm:text-xl">{tool.icon}</span> {/* Emoji icon */}
                  <span>{getShortToolName(tool.name)}</span> {/* Displaying concise tool name */}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
