
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ChatComponent from './ChatComponent';
import { callGeminiApi } from '../services/geminiService';
import { DifficultyLevel, LLMConfig, ToolName, SavedItem, OnActionProps, StudyRoutineInputs, ActionType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import Loader from './Loader';
import { loadStudyRoutineInputs, saveStudyRoutineInputs, generateUniqueId } from '../utils/localStorageService';

interface StudyRoutineFixerProps extends OnActionProps {
  onSaveItem: (item: Omit<SavedItem, 'id' | 'timestamp'>) => void;
}

// --- Types for Advanced Group Mode ---
interface GroupMember {
  id: string;
  name: string;
  availability: string;
  strengths: string;
  role: 'Lead' | 'Member';
  avatarColor: string;
  progress: number; // 0-100
  streak: number;
}

interface GroupTask {
  id: string;
  title: string;
  assignee: string;
  status: 'Todo' | 'In Progress' | 'Done';
}

interface SharedResource {
  id: string;
  type: 'Link' | 'Note' | 'Image';
  content: string;
  addedBy: string;
  timestamp: string;
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
];

const INDIVIDUAL_SYSTEM_INSTRUCTION = `You are a UI-focused Study Architect for Student Life Solver (SLS).
Your goal is to generate a **Premium, Visual, Table-Based Study Plan** based on the user's inputs.

### 🎨 OUTPUT STYLE GUIDE
- **Use Markdown Tables** for all schedules and lists.
- **Minimalist & Clean**: Short text, aligned columns.
- **Visuals**: Use subtle, professional emojis in the first column of tables.
- **No Fluff**: Avoid long introductory or concluding paragraphs. Get straight to the plan.

### 1. 📅 Weekly Strategy Overview
Generate a clean 7-day table summarizing the focus for each day.
| Day | Primary Focus | Key Subjects |
| :--- | :--- | :--- |
| **Mon** | 🧱 Foundation | [Subject 1], [Subject 2] |
| **Tue** | 🧪 Practice | [Subject 3] |
... (Cover the full week)

### 2. ☀️ The Daily Blueprint (Example Day)
Create a realistic time-blocked schedule using a clean table.
**CRITICAL**: The schedule MUST cover the EXACT duration requested by the user. If they ask for 5 hours, you must list time blocks that sum up to 5 hours (e.g., 4:00 PM to 9:00 PM).

| Time | Activity | Specific Task |
| :--- | :--- | :--- |
| **4:00 PM** | 🧠 **Deep Work** | [Subject]: Learn new concepts |
| **4:50 PM** | ☕ **Break** | Stretch & Hydrate |
| **5:00 PM** | 📝 **Active Recall** | [Subject]: Flashcards & Quiz |
... (Continue adding rows until the FULL requested duration is filled)

### 3. 🚀 Tactics & Balance
| Category | Actionable Tip |
| :--- | :--- |
| **Strategy** | Use Spaced Repetition for [Subject]. |
| **Health** | Sleep 8h. Drink water every hour. |
| **Quote** | "Consistency beats intensity." |

### ⚙️ LOGIC
- **STRICT DURATION ADHERENCE**: Do not generate a default 3-hour plan if the user asked for more. Count the hours in your generated table to ensure they match the input.
- **Intervals**: Suggest 50m Study / 10m Break (or 25/5).
- **Adaptability**: If user updates (e.g., "I missed a session"), reply with a **Revised Table** immediately.
`;

const GROUP_SYSTEM_INSTRUCTION = `You are an AI Team Coordinator.
Your goal is to organize a collaborative study session using **Premium, Visual Tables**.

### 1. 🚀 Team Snapshot
| Metric | Value |
| :--- | :--- |
| **Team** | [Team Name] |
| **Motto** | "[Motto]" |
| **Lead** | [Member Name] |

### 2. 📅 Collaborative Schedule
Identify sync times (everyone) vs solo times.
**IMPORTANT**: Ensure the schedule covers the full "Target Hours" requested.

| Time | Mode | Activity | Who |
| :--- | :--- | :--- | :--- |
| **10:00 AM** | 🤝 **Sync** | Goal Setting | All |
| **10:15 AM** | 👤 **Solo** | Chapter Reading | [Name] |
...

### 3. 📋 Task Allocation
| Member | Assigned Task | Reason |
| :--- | :--- | :--- |
| **[Name]** | Summarize Ch. 4 | Strongest in Theory |
...

Use Markdown tables. Keep it clean, professional, and structured.`;

const StudyRoutineFixer: React.FC<StudyRoutineFixerProps> = ({ onSaveItem, onAction }) => {
  const initialInputs = loadStudyRoutineInputs();
  
  // --- Individual Mode State ---
  const [indivSubjects, setIndivSubjects] = useState<string>(initialInputs.subjects || '');
  const [indivHours, setIndivHours] = useState<number>(initialInputs.hoursPerDay || 3);
  const [indivDifficulty, setIndivDifficulty] = useState<DifficultyLevel>(initialInputs.difficulty || 'medium');
  const [indivResponse, setIndivResponse] = useState<string | null>(null);
  const [indivRefinementText, setIndivRefinementText] = useState<string>('');
  const [indivIsSaved, setIndivIsSaved] = useState<boolean>(false);

  // --- Group Mode State ---
  const [isGroupMode, setIsGroupMode] = useState<boolean>(initialInputs.isGroupMode || false);
  const [groupSubjects, setGroupSubjects] = useState<string>(initialInputs.groupSubjects || '');
  const [groupHours, setGroupHours] = useState<number>(initialInputs.groupHoursPerDay || 3);
  const [groupDifficulty, setGroupDifficulty] = useState<DifficultyLevel>(initialInputs.groupDifficulty || 'medium');
  const [groupResponse, setGroupResponse] = useState<string | null>(null);
  const [groupRefinementText, setGroupRefinementText] = useState<string>('');
  const [groupIsSaved, setGroupIsSaved] = useState<boolean>(false);

  // We keep groupMembers string for backward compatibility/simple storage, 
  // but we mostly rely on advanced state below for group mode.
  const [groupMembers, setGroupMembers] = useState<string>(initialInputs.groupMembers || ''); 

  // --- Advanced Group Mode State ---
  const [teamName, setTeamName] = useState<string>('The Brainy Bunch');
  const [teamMotto, setTeamMotto] = useState<string>('Work Hard, Dream Big');
  const [studyStyle, setStudyStyle] = useState<string>('Focused & Fast');
  const [members, setMembers] = useState<GroupMember[]>([
    { id: '1', name: 'You', availability: '9am-5pm', strengths: 'Planning, Summaries', role: 'Lead', avatarColor: 'bg-indigo-500', progress: 0, streak: 3 },
  ]);
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [newResourceContent, setNewResourceContent] = useState<string>('');
  const [resourceTab, setResourceTab] = useState<'Link' | 'Note'>('Link');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentInputs: StudyRoutineInputs = { 
      subjects: indivSubjects, 
      hoursPerDay: indivHours, 
      difficulty: indivDifficulty, 
      isGroupMode, 
      groupMembers,
      groupSubjects,
      groupHoursPerDay: groupHours,
      groupDifficulty
    };
    saveStudyRoutineInputs(currentInputs);
  }, [indivSubjects, indivHours, indivDifficulty, isGroupMode, groupMembers, groupSubjects, groupHours, groupDifficulty]);

  // --- Group Helpers ---
  const handleAddMember = () => {
    const color = AVATAR_COLORS[members.length % AVATAR_COLORS.length];
    setMembers([...members, {
      id: generateUniqueId(),
      name: `Member ${members.length + 1}`,
      availability: 'Flexible',
      strengths: 'General',
      role: 'Member',
      avatarColor: color,
      progress: 0,
      streak: 0
    }]);
  };

  const handleRemoveMember = (id: string) => {
    if (members.length > 1) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  const handleUpdateMember = (id: string, field: keyof GroupMember, value: any) => {
    setMembers(members.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleAddTask = (title: string, assignee: string) => {
    if (!title.trim()) return;
    setTasks([...tasks, { id: generateUniqueId(), title, assignee, status: 'Todo' }]);
  };

  const handleTaskStatusChange = (id: string, newStatus: 'Todo' | 'In Progress' | 'Done') => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
    
    // Update member progress based on tasks
    if (newStatus === 'Done') {
        const task = tasks.find(t => t.id === id);
        if (task) {
            setMembers(prev => prev.map(m => {
                if (m.name === task.assignee) {
                    return { ...m, progress: Math.min(m.progress + 20, 100) };
                }
                return m;
            }));
        }
    }
  };

  const handleAddResource = () => {
    if (!newResourceContent.trim()) return;
    setResources([...resources, {
        id: generateUniqueId(),
        type: resourceTab,
        content: newResourceContent,
        addedBy: 'You',
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    }]);
    setNewResourceContent('');
  };

  const handleNudge = (name: string) => {
    alert(`👋 Nudged ${name} to check in!`);
  };

  const handleExportPDF = () => {
    window.print();
  };

  // --- Prompt Generation ---

  const generatePrompt = useCallback((
    inputSubjects: string,
    inputHours: number,
    inputDifficulty: DifficultyLevel,
    currentPlan: string | null,
    userRefinement: string,
    isGroup: boolean,
    membersList: GroupMember[],
    tName: string,
    tMotto: string,
    tStyle: string
  ): string => {
    // Group Mode Prompt
    if (isGroup) {
      let basePrompt = `Create a collaborative study plan for our group "${tName}".\n`;
      basePrompt += `Motto: ${tMotto}\nStudy Style: ${tStyle}\n\n`;
      
      basePrompt += `MEMBERS DETAILED DATA:\n`;
      membersList.forEach(m => {
          basePrompt += `- Name: ${m.name} | Availability: ${m.availability} | Strengths: ${m.strengths} | Role: ${m.role}\n`;
      });

      basePrompt += `\nSubjects/Topics: ${inputSubjects}\n`;
      basePrompt += `Total Shared Study Hours Target: ${inputHours}\n`;
      basePrompt += `Difficulty: ${inputDifficulty}\n`;

      if (currentPlan && userRefinement.trim()) {
         basePrompt += `\nCurrent Group Plan:\n${currentPlan}\n\nUpdate Request: ${userRefinement}\n\nPlease recalculate the plan based on this update. Adjust the shared schedule and individual tasks accordingly.`;
      } else if (userRefinement.trim()) {
         basePrompt += `Additional Context: ${userRefinement}\n`;
      }

      return basePrompt;
    }

    // Individual Mode Prompt
    if (currentPlan && userRefinement.trim()) {
      return `Here is my current study plan:
${currentPlan}

Update Request: ${userRefinement}

Please recalculate the entire plan based on this update. Move tasks intelligently and explain briefly what changed. Format the output as Markdown Tables. Ensure the duration is still ${inputHours} hours unless requested otherwise.`;
    }

    return `Create a time-blocked study schedule for me.
Subjects: ${inputSubjects}
Target Study Duration: ${inputHours} HOURS.
(IMPORTANT: The schedule table must cover exactly ${inputHours} hours of activity. Do not give me less.)
Difficulty Level: ${inputDifficulty}
${userRefinement.trim() ? `Additional Preferences: ${userRefinement}` : ''}

Please generate the schedule in clear Markdown tables as per your instructions.`;
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // Determine active variables based on mode
    const activeSubjects = isGroupMode ? groupSubjects : indivSubjects;
    const activeHours = isGroupMode ? groupHours : indivHours;
    const activeDifficulty = isGroupMode ? groupDifficulty : indivDifficulty;
    const activeResponse = isGroupMode ? groupResponse : indivResponse;
    const activeRefinement = isGroupMode ? groupRefinementText : indivRefinementText;

    // Reset Saved Status for active mode
    if (isGroupMode) setGroupIsSaved(false);
    else setIndivIsSaved(false);

    // Clear previous simulated tasks only if in group mode
    if (isGroupMode) setTasks([]); 

    try {
      const prompt = generatePrompt(
        activeSubjects, 
        activeHours, 
        activeDifficulty, 
        activeResponse, 
        activeRefinement, 
        isGroupMode, 
        members, 
        teamName,
        teamMotto, 
        studyStyle
      );
      
      const llmConfig: LLMConfig = {
        systemInstruction: isGroupMode ? GROUP_SYSTEM_INSTRUCTION : INDIVIDUAL_SYSTEM_INSTRUCTION,
        temperature: 0.6,
      };
      const aiResponse = await callGeminiApi(prompt, 'gemini-2.5-flash', llmConfig);
      
      // Update the correct response state
      if (isGroupMode) {
        setGroupResponse(aiResponse);
        setGroupRefinementText('');
      } else {
        setIndivResponse(aiResponse);
        setIndivRefinementText('');
      }
      
      onAction(ActionType.STUDY_PLAN_GENERATED, { hoursPerDay: activeHours });

      // If group mode, simulate some initial tasks
      if (isGroupMode) {
          setTasks([
              { id: 't1', title: 'Review Session Plan', assignee: 'You', status: 'In Progress' },
              { id: 't2', title: 'Share Subject Notes', assignee: members.length > 1 ? members[1].name : 'You', status: 'Todo' }
          ]);
      }

    } catch (err: any) {
      console.error("Study Routine Fixer API Error:", err);
      setError(err.message || "Failed to generate study plan.");
      // Do not clear response on error to allow retry without losing context if needed, or clear it if that's safer
      // Keeping existing logic for now, but maybe resetting response on hard fail is better?
      // setResponse(null); -> Let's keep existing response if update failed
    } finally {
      setLoading(false);
    }
  }, [
    isGroupMode, indivSubjects, indivHours, indivDifficulty, indivResponse, indivRefinementText,
    groupSubjects, groupHours, groupDifficulty, groupResponse, groupRefinementText,
    members, teamName, teamMotto, studyStyle, generatePrompt, onAction
  ]);

  const handleSaveResponse = useCallback(() => {
    const activeResponse = isGroupMode ? groupResponse : indivResponse;
    const activeSubjects = isGroupMode ? groupSubjects : indivSubjects;

    if (activeResponse) {
      const title = isGroupMode 
        ? `Team ${teamName}: ${activeSubjects.split(',')[0].trim() || 'Session'}`
        : `Study Plan: ${activeSubjects.split(',')[0].trim() || 'Untitled'}`;
      
      onSaveItem({
        toolName: ToolName.STUDY_ROUTINE,
        title: title,
        content: activeResponse,
      });
      
      if (isGroupMode) setGroupIsSaved(true);
      else setIndivIsSaved(true);
    }
  }, [isGroupMode, groupResponse, indivResponse, groupSubjects, indivSubjects, teamName, onSaveItem]);


  // --- Render Individual Mode ---
  if (!isGroupMode) {
    return (
        <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
        {/* Inject Styles for Tables - Green/Growth Theme */}
        <style>{`
            .prose table { 
                width: 100%; 
                border-collapse: separate; 
                border-spacing: 0; 
                margin-top: 1.5rem;
                margin-bottom: 2rem; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.05); 
                border: 1px solid #d1fae5;
                background: white;
            }
            .prose thead {
                background: linear-gradient(90deg, #ecfdf5 0%, #d1fae5 100%); /* Green-50 to Green-100 */
            }
            .prose th { 
                color: #065f46; /* Green-800 */
                font-weight: 800; 
                text-transform: uppercase;
                font-size: 0.75rem;
                letter-spacing: 0.05em;
                padding: 1.25rem 1rem; 
                text-align: left; 
                border-bottom: 2px solid #6ee7b7; /* Green-300 */
            }
            .prose td { 
                border-bottom: 1px solid #f3f4f6; 
                padding: 1rem; 
                color: #374151; 
                font-size: 0.95rem;
                line-height: 1.6;
                vertical-align: middle;
            }
            .prose tr:last-child td { 
                border-bottom: none; 
            }
            .prose tbody tr:nth-child(even) { 
                background-color: #fafafa; 
            }
            .prose tbody tr:hover { 
                background-color: #f0fdf4; /* Green-50 */
                transition: background-color 0.2s ease-in-out; 
            }
            /* Bold text in cells usually means importance, color it green */
            .prose strong {
                color: #059669; /* Green-600 */
                font-weight: 700;
            }
        `}</style>

        <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-lime-500 drop-shadow-sm">🎒 Study Routine Auto-Fixer</h2>
        
        {/* Group Mode Toggle */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="flex items-center cursor-pointer">
            <div className="relative">
                <input 
                type="checkbox" 
                className="sr-only" 
                checked={isGroupMode} 
                onChange={() => setIsGroupMode(true)} 
                />
                <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${isGroupMode ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${isGroupMode ? 'translate-x-6' : ''}`}></div>
            </div>
            <div className={`ml-3 text-lg font-bold ${isGroupMode ? 'text-indigo-600' : 'text-gray-600'}`}>
                Collaborative Group Mode {isGroupMode ? '👥 On' : '👤 Off'}
            </div>
            </label>
        </div>

        <div className="space-y-4 mb-6">
            <div>
            <label htmlFor="subjects" className="block text-lg font-bold text-gray-800 mb-2">
                Subjects (comma-separated):
            </label>
            <textarea
                id="subjects"
                rows={2}
                className="w-full p-4 border-2 border-green-400 bg-green-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-lime-300 focus:border-lime-600 transition-all duration-300 text-gray-900 placeholder-green-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold"
                value={indivSubjects}
                onChange={(e) => setIndivSubjects(e.target.value)}
                disabled={loading}
                aria-label="Subjects to study"
                placeholder="E.g., Math, Physics, History"
            ></textarea>
            </div>
            <div>
            <label htmlFor="hoursPerDay" className="block text-lg font-bold text-gray-800 mb-2">
                Hours per day I can study:
            </label>
            <input
                type="number"
                id="hoursPerDay"
                min="1"
                max="12"
                className="w-full p-4 border-2 border-green-400 bg-green-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-lime-300 focus:border-lime-600 transition-all duration-300 text-gray-900 placeholder-green-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold"
                value={indivHours}
                onChange={(e) => setIndivHours(parseInt(e.target.value))}
                disabled={loading}
                aria-label="Hours available"
            />
            </div>
            <div>
            <label htmlFor="difficulty" className="block text-lg font-bold text-gray-800 mb-2">
                Overall Difficulty Level:
            </label>
            <select
                id="difficulty"
                className="w-full p-4 border-2 border-green-400 bg-green-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-lime-300 focus:border-lime-600 transition-all duration-300 text-gray-900 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold"
                value={indivDifficulty}
                onChange={(e) => setIndivDifficulty(e.target.value as DifficultyLevel)}
                disabled={loading}
                aria-label="Overall difficulty level"
            >
                <option value="easy">😌 Easy</option>
                <option value="medium">💪 Medium</option>
                <option value="hard">🧠 Hard</option>
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
            {indivResponse ? (
                <div className="prose max-w-none text-gray-800 border border-gray-100 rounded-xl p-4 shadow-sm bg-white">
                <MarkdownRenderer content={indivResponse} />
                <div className="mt-4 text-right">
                    <button
                    onClick={handleSaveResponse}
                    disabled={indivIsSaved}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 ${
                        indivIsSaved
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                    >
                    {indivIsSaved ? 'Saved!' : '💾 Save to My Work'}
                    </button>
                </div>
                </div>
            ) : null}
            {loading && (
                <div className="flex justify-center p-4">
                <Loader message="SLS is crafting your perfect study plan..." />
                </div>
            )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
            <textarea
                className={`w-full p-3 border-4 border-green-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-100 transition-all duration-300 resize-none text-gray-900 shadow-sm min-h-12 focus:shadow-md font-bold mb-2`}
                rows={2}
                placeholder={indivResponse ? "Need changes? E.g., 'Add a 15 min break'" : "Any specific preferences? E.g., 'Math first'"}
                disabled={loading}
                aria-label="Additional instructions or updates"
                value={indivRefinementText}
                onChange={(e) => setIndivRefinementText(e.target.value)}
            ></textarea>
            <button
                type="submit"
                className={`w-full font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl focus:outline-none bg-gradient-to-r from-green-600 to-lime-600 hover:from-green-700 hover:to-lime-700 text-white focus:ring-lime-300`}
                disabled={loading || !indivSubjects.trim()}
            >
                {loading ? 'Processing...' : (indivResponse ? 'Update Plan' : 'Generate Study Plan')}
            </button>
            </form>
        </div>
        </div>
    );
  }

  // --- Render Collaborative Group Mode ---
  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
        {/* Inject Styles for Tables (Group Mode) - Indigo/Collaborative Theme */}
        <style>{`
            .prose table { 
                width: 100%; 
                border-collapse: separate; 
                border-spacing: 0; 
                margin-top: 1.5rem;
                margin-bottom: 2rem; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.05); 
                border: 1px solid #c7d2fe;
                background: white;
            }
            .prose thead {
                background: linear-gradient(90deg, #eef2ff 0%, #e0e7ff 100%); /* Indigo-50 to Indigo-100 */
            }
            .prose th { 
                color: #4338ca; /* Indigo-700 */
                font-weight: 800; 
                text-transform: uppercase;
                font-size: 0.75rem;
                letter-spacing: 0.05em;
                padding: 1.25rem 1rem; 
                text-align: left; 
                border-bottom: 2px solid #a5b4fc; /* Indigo-300 */
            }
            .prose td { 
                border-bottom: 1px solid #f3f4f6; 
                padding: 1rem; 
                color: #374151; 
                font-size: 0.95rem;
                line-height: 1.6;
                vertical-align: middle;
            }
            .prose tr:last-child td { 
                border-bottom: none; 
            }
            .prose tbody tr:nth-child(even) { 
                background-color: #fafafa; 
            }
            .prose tbody tr:hover { 
                background-color: #eef2ff; /* Indigo-50 */
                transition: background-color 0.2s ease-in-out; 
            }
            .prose strong {
                color: #4f46e5; /* Indigo-600 */
                font-weight: 700;
            }
        `}</style>
        
        {/* Header & Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
             <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 drop-shadow-sm mb-4 sm:mb-0">
                🚀 Team Study Space
            </h2>
            <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                <label className="flex items-center cursor-pointer">
                    <span className={`mr-3 text-sm font-bold ${isGroupMode ? 'text-indigo-600' : 'text-gray-500'}`}>Collaborative Mode</span>
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={isGroupMode} 
                            onChange={() => setIsGroupMode(false)} 
                        />
                        <div className="block w-10 h-6 bg-indigo-500 rounded-full"></div>
                        <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform translate-x-4"></div>
                    </div>
                </label>
            </div>
        </div>

        {/* --- STEP 1: Team Personality --- */}
        {!groupResponse && (
            <div className="mb-8 animate-fade-in">
                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 shadow-sm mb-6">
                    <h3 className="text-lg font-bold text-indigo-800 mb-4 flex items-center gap-2">
                        <span>1️⃣</span> Group Profile
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team Name</label>
                            <input 
                                type="text" 
                                value={teamName} 
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full p-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-bold text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motto</label>
                            <input 
                                type="text" 
                                value={teamMotto} 
                                onChange={(e) => setTeamMotto(e.target.value)}
                                className="w-full p-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Study Style</label>
                            <select 
                                value={studyStyle}
                                onChange={(e) => setStudyStyle(e.target.value)}
                                className="w-full p-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-800"
                            >
                                <option>Focused & Fast</option>
                                <option>Relaxed & Chatty</option>
                                <option>Deep Dive & Analytical</option>
                                <option>Exam Cram Mode</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* --- STEP 2: Members & Scheduling --- */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-400 to-purple-400"></div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>2️⃣</span> Squad & Smart Scheduling Inputs
                    </h3>
                    
                    <div className="space-y-4">
                        {members.map((member, index) => (
                            <div key={member.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded-xl border border-gray-100 transition-all hover:border-indigo-200">
                                <div className={`w-8 h-8 rounded-full ${member.avatarColor} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                                    {member.name.charAt(0)}
                                </div>
                                <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                                    <input 
                                        type="text" 
                                        placeholder="Name" 
                                        value={member.name}
                                        onChange={(e) => handleUpdateMember(member.id, 'name', e.target.value)}
                                        className="p-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Availability (e.g., Mon 4-6pm)" 
                                        value={member.availability}
                                        onChange={(e) => handleUpdateMember(member.id, 'availability', e.target.value)}
                                        className="p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Strengths (e.g., Math, Summaries)" 
                                        value={member.strengths}
                                        onChange={(e) => handleUpdateMember(member.id, 'strengths', e.target.value)}
                                        className="p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                    />
                                </div>
                                {index > 0 && (
                                    <button onClick={() => handleRemoveMember(member.id)} className="text-red-400 hover:text-red-600 px-2">
                                        &times;
                                    </button>
                                )}
                            </div>
                        ))}
                        <button onClick={handleAddMember} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            + Add Member
                        </button>
                    </div>
                </div>

                 {/* --- STEP 3: Content --- */}
                 <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-lg font-bold text-gray-800 mb-2">Subjects / Topics:</label>
                        <textarea
                            rows={2}
                            className="w-full p-4 border-2 border-purple-200 bg-purple-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 font-bold text-gray-800 placeholder-purple-300"
                            placeholder="E.g., History Chapter 5, Biology Project, Math Review"
                            value={groupSubjects}
                            onChange={(e) => setGroupSubjects(e.target.value)}
                        ></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-lg font-bold text-gray-800 mb-2">Target Hours:</label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                className="w-full p-3 border-2 border-purple-200 bg-purple-50 rounded-xl font-bold"
                                value={groupHours}
                                onChange={(e) => setGroupHours(parseInt(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-lg font-bold text-gray-800 mb-2">Difficulty:</label>
                            <select
                                className="w-full p-3 border-2 border-purple-200 bg-purple-50 rounded-xl font-bold"
                                value={groupDifficulty}
                                onChange={(e) => setGroupDifficulty(e.target.value as DifficultyLevel)}
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                    </div>
                 </div>

                 {error && (
                    <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative mb-4 shadow-md" role="alert">
                    <strong className="font-bold">Error:</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                    </div>
                )}

                 <button
                    onClick={handleSubmit}
                    disabled={loading || !groupSubjects.trim()}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg transition-transform transform hover:scale-[1.01] active:scale-[0.98] text-lg"
                 >
                    {loading ? 'Coordinating Squad...' : 'Generate Collaborative Plan 🚀'}
                 </button>
            </div>
        )}

        {/* --- RESULTS DASHBOARD --- */}
        {groupResponse && (
            <div className="animate-fade-in space-y-8 print:space-y-4">
                {/* 1. Team Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 print:bg-none print:text-black print:border-b">
                    <div>
                        <h2 className="text-3xl font-extrabold mb-1">{teamName}</h2>
                        <p className="text-indigo-100 font-medium italic">"{teamMotto}"</p>
                    </div>
                    <div className="flex -space-x-2">
                        {members.map((m) => (
                            <div key={m.id} className={`w-10 h-10 rounded-full border-2 border-white ${m.avatarColor} flex items-center justify-center font-bold text-xs shadow-md`} title={m.name}>
                                {m.name.charAt(0)}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. Main Schedule (AI Output) */}
                    <div className="lg:col-span-2 space-y-6">
                         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-800">📅 Smart Schedule</h3>
                                <button onClick={handleExportPDF} className="text-sm font-bold text-indigo-600 hover:underline print:hidden">Export Report 📄</button>
                            </div>
                            <div className="prose max-w-none text-gray-800">
                                <MarkdownRenderer content={groupResponse} />
                            </div>
                            
                            {/* Refinement Input */}
                            <div className="mt-6 pt-4 border-t border-gray-100 print:hidden">
                                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Update plan? (e.g., 'John can't make 3pm', 'Add break')"
                                        className="flex-grow p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 font-medium"
                                        value={groupRefinementText}
                                        onChange={(e) => setGroupRefinementText(e.target.value)}
                                        disabled={loading}
                                    />
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">
                                        {loading ? '...' : 'Update'}
                                    </button>
                                </form>
                            </div>
                         </div>

                         {/* 5. Shared Resources */}
                         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 print:hidden">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">📂 Collaborative Resources</h3>
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setResourceTab('Link')} className={`px-3 py-1 rounded-full text-xs font-bold ${resourceTab === 'Link' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>Links</button>
                                <button onClick={() => setResourceTab('Note')} className={`px-3 py-1 rounded-full text-xs font-bold ${resourceTab === 'Note' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>Quick Notes</button>
                            </div>
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    placeholder={resourceTab === 'Link' ? "Paste URL..." : "Type note..."}
                                    className="flex-grow p-2 border border-gray-200 rounded-lg text-sm"
                                    value={newResourceContent}
                                    onChange={(e) => setNewResourceContent(e.target.value)}
                                />
                                <button onClick={handleAddResource} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold">Add</button>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {resources.length === 0 && <p className="text-gray-400 text-xs italic">No resources shared yet.</p>}
                                {resources.map(res => (
                                    <div key={res.id} className="flex justify-between items-start p-2 bg-gray-50 rounded-lg">
                                        <div>
                                            {res.type === 'Link' ? (
                                                <a href={res.content.startsWith('http') ? res.content : `https://${res.content}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm font-bold break-all">{res.content}</a>
                                            ) : (
                                                <p className="text-gray-800 text-sm">{res.content}</p>
                                            )}
                                            <p className="text-[10px] text-gray-500 mt-1">{res.addedBy} • {res.timestamp}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         </div>
                    </div>

                    {/* Right Column: Dashboard & Accountability */}
                    <div className="space-y-6 print:break-inside-avoid">
                        {/* 3. Real-Time Sync Dashboard */}
                        <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📊</div>
                             <h3 className="text-lg font-bold mb-4 flex items-center gap-2">Sync Dashboard <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span></h3>
                             
                             {/* Progress Bars */}
                             <div className="space-y-4 mb-6">
                                {members.map(m => (
                                    <div key={m.id}>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span>{m.name}</span>
                                            <span className="text-indigo-300">{m.progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                                            <div className={`h-1.5 rounded-full ${m.avatarColor} transition-all duration-500`} style={{ width: `${m.progress}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                             </div>

                             {/* Accountability Streaks */}
                             <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar-horizontal">
                                {members.map(m => (
                                    <div key={m.id} className="shrink-0 bg-gray-800 p-2 rounded-lg flex flex-col items-center min-w-[70px]">
                                        <div className={`w-8 h-8 rounded-full ${m.avatarColor} flex items-center justify-center text-xs font-bold mb-1`}>{m.name.charAt(0)}</div>
                                        <span className="text-[10px] text-gray-400">🔥 {m.streak} Day</span>
                                        <button onClick={() => handleNudge(m.name)} className="mt-1 text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-indigo-300">Nudge 👋</button>
                                    </div>
                                ))}
                             </div>
                        </div>

                        {/* 4. Task Board (Simulated) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">📌 Task Board</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {tasks.length === 0 && <p className="text-gray-400 text-xs text-center py-4">Tasks will appear here based on the plan.</p>}
                                {tasks.map(task => (
                                    <div key={task.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50 hover:bg-white hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-gray-800">{task.title}</span>
                                            <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{task.assignee}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {['Todo', 'In Progress', 'Done'].map((status) => (
                                                <button 
                                                    key={status}
                                                    onClick={() => handleTaskStatusChange(task.id, status as any)}
                                                    className={`flex-1 py-1 text-[10px] rounded font-bold border ${task.status === status ? 
                                                        (status === 'Done' ? 'bg-green-100 border-green-200 text-green-700' : 
                                                         status === 'In Progress' ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-gray-200 text-gray-700') 
                                                        : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Add new task..." 
                                    className="flex-grow text-xs p-2 bg-gray-50 rounded-lg border border-gray-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddTask((e.target as HTMLInputElement).value, 'Group');
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center print:hidden">
                    <button 
                        onClick={() => { setGroupResponse(null); setGroupRefinementText(''); }}
                        className="text-gray-500 hover:text-gray-700 font-bold text-sm underline"
                    >
                        Back to Setup
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default StudyRoutineFixer;
