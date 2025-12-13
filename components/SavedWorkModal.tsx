import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedItem, ToolName } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface SavedWorkModalProps {
  savedItems: SavedItem[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

type FilterTab = ToolName | 'All';

const SavedWorkModal: React.FC<SavedWorkModalProps> = ({ savedItems, onDelete, onClose }) => {
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Define icons for all tools so items in the "All" list still have correct icons
  // even if their specific filter tab is removed.
  const allToolIcons: Record<string, string> = useMemo(() => ({
    [ToolName.DAILY_ACHIEVEMENTS]: '🌟',
    [ToolName.STUDY_ROUTINE]: '🎒',
    [ToolName.NOTES_CLEANER]: '📝',
    [ToolName.HOMEWORK_CHECKER]: '📚',
    [ToolName.DEADLINE_PRESSURE]: '⏳',
    [ToolName.MOOD_STRESS]: '😌',
    [ToolName.DECISION_HELPER]: '✔️',
    [ToolName.PREDICT_MY_GRADE]: '💯',
    'All': '✨'
  }), []);

  // Filtered tabs based on user request: Homework, Notes, Study (and All)
  const tabs: { name: FilterTab; icon: string }[] = useMemo(() => [
    { name: 'All', icon: allToolIcons['All'] },
    { name: ToolName.HOMEWORK_CHECKER, icon: allToolIcons[ToolName.HOMEWORK_CHECKER] },
    { name: ToolName.NOTES_CLEANER, icon: allToolIcons[ToolName.NOTES_CLEANER] },
    { name: ToolName.STUDY_ROUTINE, icon: allToolIcons[ToolName.STUDY_ROUTINE] },
  ], [allToolIcons]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'All') {
      return savedItems;
    }
    return savedItems.filter(item => item.toolName === activeTab);
  }, [savedItems, activeTab]);

  // Clear selected item if it's no longer in the filtered list (e.g. after deletion)
  useEffect(() => {
    if (selectedItem && !filteredItems.some(item => item.id === selectedItem.id)) {
      setSelectedItem(null);
    }
  }, [filteredItems, selectedItem]);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(); // Adjusts to local time format
    } catch (e) {
      return 'Unknown Date';
    }
  };

  const getToolIcon = (toolName: ToolName | 'All') => {
    return allToolIcons[toolName] || '✨';
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Stop click from triggering item selection
    
    // Confirmation dialog before deletion
    if (window.confirm("Are you sure you want to permanently delete this saved item?")) {
      onDelete(id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
      <style>{`
        @media (max-width: 768px) {
          .mobile-no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .mobile-no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
        }
      `}</style>
      <div className="bg-white sm:rounded-xl shadow-2xl w-full h-full sm:h-[85vh] sm:max-w-4xl flex flex-col relative sm:border-4 border-purple-100 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white z-10 shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 flex items-center gap-2">
            <span>💾</span> My Saved Work
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100 focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-grow overflow-hidden relative min-h-0">
          
          {/* Sidebar - List View */}
          <div className={`
            bg-gray-50 border-r border-gray-200 flex flex-col min-w-[250px] transition-all duration-300 h-full min-h-0
            ${selectedItem ? 'hidden md:flex md:w-1/3' : 'w-full flex md:w-1/3'}
          `}>
            <div className="p-3 border-b border-gray-200 bg-gray-50 z-10 shrink-0">
              <div className="relative flex items-center">
                <div
                  ref={tabsContainerRef}
                  className="flex flex-nowrap overflow-x-auto custom-scrollbar-horizontal py-2 gap-2 mobile-no-scrollbar"
                >
                  {tabs.map(tab => (
                    <button
                      key={tab.name}
                      onClick={() => setActiveTab(tab.name)}
                      className={`
                        flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm rounded-full font-bold transition-all duration-200 whitespace-nowrap
                        ${activeTab === tab.name
                          ? 'bg-purple-600 text-white shadow-md transform scale-105'
                          : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
                        }
                      `}
                      aria-pressed={activeTab === tab.name}
                    >
                      {tab.icon} {tab.name === 'All' ? 'All' : tab.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-3 min-h-0 mobile-no-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <span className="text-2xl mb-2">📭</span>
                  <p className="text-sm">No saved items yet.</p>
                </div>
              ) : (
                <ul className="space-y-2 pb-24">
                  {filteredItems.map((item) => (
                    <li 
                      key={item.id} 
                      className={`group flex items-center justify-between rounded-xl border transition-all duration-200 relative hover:shadow-sm ${
                        selectedItem?.id === item.id 
                          ? 'bg-white border-purple-500 shadow-md ring-1 ring-purple-200' 
                          : 'bg-white border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {/* Content Area - Selection */}
                      <div
                        onClick={() => setSelectedItem(item)}
                        className="flex-grow p-4 md:p-3 cursor-pointer flex flex-col justify-center min-w-0"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedItem(item);
                        }}
                      >
                        <span className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                          <span className="text-lg flex-shrink-0">{getToolIcon(item.toolName)}</span> 
                          <span className="truncate">{item.title}</span>
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                           {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      
                      {/* Delete Button Area - Distinct Click Zone */}
                      <div className="px-2">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, item.id)}
                          className="relative z-20 p-3 md:p-2 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-200"
                          title="Delete saved item"
                          aria-label={`Delete ${item.title}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Main Content View - Detail View */}
          <div className={`
            bg-white flex-col w-full h-full min-h-0
            ${selectedItem ? 'flex md:w-2/3' : 'hidden md:flex md:w-2/3'}
          `}>
             {/* Mobile Back Button - Sticky Header inside content view */}
             {selectedItem && (
               <div className="md:hidden p-3 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm flex items-center shrink-0">
                 <button 
                   onClick={() => setSelectedItem(null)} 
                   className="flex items-center gap-2 text-purple-600 font-bold px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors text-sm"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                   </svg>
                   Back to List
                 </button>
               </div>
             )}

            <div className="flex-grow p-4 sm:p-6 overflow-y-auto custom-scrollbar w-full min-h-0 mobile-no-scrollbar">
              {selectedItem ? (
                <div className="animate-fade-in pb-32 sm:pb-10">
                  <div className="mb-6 pb-4 border-b border-gray-100">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-start sm:items-center gap-3 mb-2 leading-tight">
                      <span className="text-3xl flex-shrink-0 mt-1 sm:mt-0">{getToolIcon(selectedItem.toolName)}</span>
                      <span>{selectedItem.title}</span>
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 font-medium ml-1">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 w-fit">{selectedItem.toolName}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Saved on {formatTimestamp(selectedItem.timestamp)}</span>
                    </div>
                  </div>
                  
                  <div className="prose prose-purple max-w-none text-gray-800 leading-relaxed text-sm sm:text-base">
                    <MarkdownRenderer content={selectedItem.content} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="text-6xl mb-4 opacity-20">📂</div>
                  <p className="text-lg font-medium text-gray-500">Select an item to view details</p>
                  <p className="text-sm mt-2">Saved work from your tools will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavedWorkModal;