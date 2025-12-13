

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ChatComponent from './ChatComponent';
import { callGeminiApiJson } from '../services/geminiService';
import { LLMConfig, OnActionProps, ActionType, DeadlinePressureInputs, PressureAnalysis, PressureTimelineData } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import Loader from './Loader';
import { loadDeadlinePressureInputs, saveDeadlinePressureInputs } from '../utils/localStorageService';
import { Type } from '@google/genai';

interface DeadlinePressureMeterProps extends OnActionProps {}

// JSON Schema for structured output
const pressureAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    pressureScore: { type: Type.NUMBER, description: "0-100 score. 0=Relaxed, 100=Panic." },
    pressureLevel: { type: Type.STRING, description: "Low, Medium, High, or Critical" },
    forecastMessage: { type: Type.STRING, description: "Prediction of future pressure trends." },
    healthBalanceMessage: { type: Type.STRING, description: "Evaluation of study-health balance." },
    moodAdjustmentMessage: { type: Type.STRING, description: "How the user's mood affected the score/suggestions." },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          deadline: { type: Type.STRING },
          priorityScore: { type: Type.NUMBER, description: "0-100 urgency score." },
          pressureLevel: { type: Type.STRING, description: "Low, Medium, High, Critical" }
        }
      }
    },
    rescheduledPlan: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggested order of tasks or breakdown." },
    timelineData: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayLabel: { type: Type.STRING, description: "e.g., Mon, Tue" },
          pressureValue: { type: Type.NUMBER, description: "0-100 predicted pressure for that day" },
          mainStressor: { type: Type.STRING, description: "One of: 'tasks', 'deadline', 'exam', 'mood', 'rest'" }
        }
      },
      description: "Predicted pressure for the next 7 days."
    },
    weeklyInsight: { type: Type.STRING, description: "2-3 line summary of the week's pressure logic (e.g. 'Peak on Thursday due to exams')." },
    forecastTrend: { type: Type.STRING, description: "'Improving', 'Rising', or 'Stable'" },
    previousWeekComparison: { type: Type.STRING, description: "e.g. '15% higher', '10% lower' compared to typical/last week, or null if unknown.", nullable: true },
    reliefTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Quick actionable relief tips." },
    redZoneWarning: { type: Type.STRING, description: "Warning message if score > 80, else null/empty.", nullable: true },
    overloadWarning: { type: Type.STRING, description: "Warning if tasks exceed time, else null/empty.", nullable: true },
    weeklySummary: {
      type: Type.OBJECT,
      properties: {
        totalTasks: { type: Type.NUMBER },
        highStressDay: { type: Type.STRING },
        lowStressDay: { type: Type.STRING },
        suggestions: { type: Type.STRING }
      }
    }
  },
  required: ['pressureScore', 'pressureLevel', 'forecastMessage', 'tasks', 'timelineData', 'reliefTips', 'weeklySummary', 'weeklyInsight', 'forecastTrend']
};

const SYSTEM_INSTRUCTION = `You are the Advanced Deadline Pressure Meter for Student Life Solver.
Your goal is to provide a deep, structured analysis of the student's workload.

You MUST take into account:
1. **Urgency**: How close deadlines are.
2. **User Mood**: Adjust the tone and pressure score based on the provided mood.
3. **Health Balance**: Detect if they are overworking and suggest breaks.
4. **Forecasting**: Predict the next 7 days of pressure based on the tasks provided.

Output Rules:
- **Priority Strength Score**: Assign 0-100 to each task.
- **Timeline**: Provide 7 data points for the next 7 days.
- **Main Stressor**: For each timeline day, select the primary cause: 'tasks', 'deadline', 'exam', 'mood', or 'rest'.
- **Weekly Insight**: Write a natural language summary of the week's flow.
- **Trend**: Decide if pressure is Rising, Improving, or Stable.
- **Comparison**: Estimate if this is heavier or lighter than a typical student week if historical data isn't clear, or null if totally unknown.
- **Red Zone**: If score > 80, provide a stern but helpful warning.

Return ONLY the JSON object matching the provided schema.`;

const MOODS = [
  { label: 'Calm', emoji: '😌', value: 'calm' },
  { label: 'Focused', emoji: '🧠', value: 'focused' },
  { label: 'Stressed', emoji: '😫', value: 'stressed' },
  { label: 'Tired', emoji: '😴', value: 'tired' },
  { label: 'Panic', emoji: '😱', value: 'panic' },
];

const VisualPressureGauge = ({ score, mood }: { score: number; mood: string }) => {
  let label = "Chilled 😎";
  let colorClass = "text-green-600";
  let barGradient = "from-emerald-400 via-yellow-400 to-red-600";

  if (score > 25) { label = "Balanced ⚖️"; colorClass = "text-blue-600"; }
  if (score > 50) { label = "Busy 🏃"; colorClass = "text-yellow-600"; }
  if (score > 75) { label = "Pressure High! 🔥"; colorClass = "text-orange-600"; }
  if (score > 90) { label = "CRITICAL 🚨"; colorClass = "text-red-600"; }

  // Mood adjustment visual cue
  const moodEmoji = MOODS.find(m => m.value === mood)?.emoji || '';

  return (
    <div className="mb-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 flex flex-col items-center animate-fade-in relative overflow-hidden">
      {/* Background Pulse for Red Zone */}
      {score > 80 && (
         <div className="absolute inset-0 bg-red-50 opacity-50 animate-pulse pointer-events-none"></div>
      )}

      <div className="w-full flex justify-between items-end mb-4 relative z-10">
        <span className="text-gray-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
          Current Pressure {moodEmoji && <span className="text-xl bg-gray-100 p-1 rounded-lg" title={`Adjusted for ${mood} mood`}>{moodEmoji}</span>}
        </span>
        <span className={`text-5xl font-black ${colorClass} transition-colors duration-500`}>{score}%</span>
      </div>
      
      {/* The Bar */}
      <div className="relative w-full h-6 bg-gray-100 rounded-full overflow-hidden shadow-inner z-10">
        <div className={`absolute inset-0 bg-gradient-to-r ${barGradient} opacity-90`}></div>
        <div 
          className="absolute top-0 right-0 bottom-0 bg-gray-100 transition-all duration-1000 ease-out"
          style={{ width: `${100 - score}%` }}
        ></div>
      </div>

      <div className="w-full flex justify-between text-[10px] font-bold text-gray-400 mt-2 px-1 relative z-10 uppercase tracking-widest">
        <span>Relaxed</span>
        <span>Balanced</span>
        <span>High</span>
        <span>Critical</span>
      </div>
      
      <div className={`mt-4 text-2xl font-extrabold ${colorClass} transition-all duration-500 relative z-10 tracking-tight`}>
        {label}
      </div>
    </div>
  );
};

const PremiumStressMap = ({ data, insight, trend, comparison }: {
  data: PressureTimelineData[];
  insight: string;
  trend: 'Improving' | 'Rising' | 'Stable';
  comparison: string | null;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'short' });

  const getColorConfig = (score: number) => {
    if (score <= 25) return {
      from: 'from-emerald-400', to: 'to-emerald-500',
      text: 'text-emerald-600', dot: 'bg-emerald-500'
    };
    if (score <= 50) return {
      from: 'from-yellow-400', to: 'to-yellow-500',
      text: 'text-yellow-600', dot: 'bg-yellow-500'
    };
    if (score <= 75) return {
      from: 'from-orange-400', to: 'to-orange-500',
      text: 'text-orange-600', dot: 'bg-orange-500'
    };
    return {
      from: 'from-red-500', to: 'to-red-600',
      text: 'text-red-600', dot: 'bg-red-600'
    };
  };

  const getIcon = (stressor: string) => {
    switch (stressor) {
      case 'tasks': return '📚';
      case 'deadline': return '⏰';
      case 'exam': return '📖';
      case 'mood': return '😟';
      case 'rest': return '🌿';
      default: return '•';
    }
  };

  const trendConfig = {
    Improving: { icon: '📉', label: 'Stress Dropping', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', arrow: '↓', stripColor: 'bg-emerald-400' },
    Rising: { icon: '📈', label: 'Stress Rising', color: 'text-orange-600 bg-orange-50 border-orange-100', arrow: '↑', stripColor: 'bg-orange-400' },
    Stable: { icon: '➖', label: 'Stable', color: 'text-gray-600 bg-gray-50 border-gray-100', arrow: '→', stripColor: 'bg-gray-400' }
  };
  const activeTrend = trendConfig[trend] || trendConfig.Stable;

  // Generate SVG path points
  const getPoints = () => {
    if (data.length === 0) return "";
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - d.pressureValue;
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div className="bg-gradient-to-br from-white to-indigo-50/40 rounded-3xl p-6 sm:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100 mt-6 relative overflow-visible group/chart">
      <style>{`
        @keyframes slide-up-fade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up-fade {
          animation: slide-up-fade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
      `}</style>

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 animate-slide-up-fade">
        <div>
           <h4 className="text-xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
             7-Day Stress Map
             <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-500 uppercase tracking-widest font-bold">Live</span>
           </h4>
           {comparison && (
             <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-wide">
               {comparison} vs last week
             </p>
           )}
        </div>
        
        {/* Animated Forecast Chip */}
        <div className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border shadow-sm transform transition-all hover:scale-105 ${activeTrend.color} animate-slide-up-fade delay-100`}>
           <span className="text-base">{activeTrend.icon}</span>
           <span>Forecast: {trend}</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative h-64 w-full mb-8 select-none">
         {/* Faint Trend Line (SVG) */}
         <svg 
           className="absolute inset-0 h-full w-full overflow-visible pointer-events-none z-0" 
           viewBox="0 0 100 100" 
           preserveAspectRatio="none"
         >
             <polyline
                points={getPoints()}
                fill="none"
                stroke="currentColor"
                strokeWidth="2" // Relative to 100x100 coord system, this might be thick. 0.5 might be better if stretched? Actually 2px is fine visually if width is large.
                // Wait, if viewBox is 100x100, strokeWidth 2 is 2% of height. That's fine.
                vectorEffect="non-scaling-stroke" // This ensures stroke stays thin even if SVG scales
                className="text-gray-300 opacity-50"
             />
         </svg>

         <div className="flex items-end justify-between h-full relative z-10 gap-2">
           {data.map((d, i) => {
             const colors = getColorConfig(d.pressureValue);
             const isToday = d.dayLabel.includes(todayShort);
             const icon = getIcon(d.mainStressor);
             
             return (
               <div 
                 key={i} 
                 className="relative flex flex-col items-center justify-end h-full flex-1 group/bar cursor-pointer"
                 onMouseEnter={() => setHoveredIndex(i)}
                 onMouseLeave={() => setHoveredIndex(null)}
               >
                  {/* Hover Tooltip */}
                  {hoveredIndex === i && (
                    <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 bg-gray-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-2xl z-50 animate-fade-in border border-white/10 ring-1 ring-black/10">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-300">{d.dayLabel}</span>
                          <span className={`font-black text-lg ${colors.text.replace('text-', 'text-light-')}`}>{d.pressureValue}%</span>
                        </div>
                        <div className="font-medium mb-2 flex items-center gap-1.5 text-gray-200">
                          <span className="text-sm">{icon}</span>
                          <span className="capitalize">{d.mainStressor}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 border-t border-gray-700 pt-2 mt-1 leading-relaxed">
                           Recommendation: {d.pressureValue > 80 ? 'Take it easy today.' : d.pressureValue > 50 ? 'Stay focused, take breaks.' : 'Great balance maintained.'}
                        </div>
                        {/* Triangle */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-gray-900/95"></div>
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`mb-3 text-lg transition-all duration-500 transform ${hoveredIndex === i ? 'scale-125 -translate-y-2' : 'scale-100'} animate-slide-up-fade`} style={{ animationDelay: `${i * 50 + 200}ms` }}>
                    {icon}
                  </div>

                  {/* Bar Container with Dot */}
                  <div className="relative w-full flex justify-center items-end h-full">
                     {/* Today Glow */}
                     {isToday && (
                        <div className="absolute bottom-0 w-full h-1/2 bg-blue-400/20 blur-xl rounded-full pointer-events-none animate-pulse"></div>
                     )}

                     {/* The Bar */}
                     <div 
                       className={`relative w-2 sm:w-3 md:w-4 rounded-full bg-gradient-to-t ${colors.from} ${colors.to} shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-all duration-1000 ease-out animate-slide-up-fade hover:brightness-110`}
                       style={{ height: `${d.pressureValue}%`, animationDelay: `${i * 50}ms` }}
                     >
                        {/* Top Dot */}
                        <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 border-2 border-white rounded-full ${colors.dot} shadow-sm z-20`}></div>
                     </div>
                  </div>

                  {/* Day Label */}
                  <span className={`text-[10px] sm:text-xs font-bold mt-4 tracking-wider transition-colors duration-300 ${isToday ? 'text-blue-600' : 'text-gray-400 group-hover/bar:text-gray-600'}`}>
                    {d.dayLabel}
                  </span>
               </div>
             );
           })}
         </div>
      </div>

      {/* Trend Strip & Insight */}
      <div className="border-t border-gray-100 pt-4 flex flex-col gap-4 animate-slide-up-fade delay-300">
          {/* Trend Summary Strip */}
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 px-1">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${activeTrend.stripColor}`}></span>
                <span>Trend: <span className="text-gray-800 font-bold">{activeTrend.label}</span></span>
             </div>
             <div className={`uppercase tracking-widest font-bold flex items-center gap-1 ${trend === 'Improving' ? 'text-emerald-500' : trend === 'Rising' ? 'text-orange-500' : 'text-gray-400'}`}>
               {activeTrend.arrow} {trend}
             </div>
          </div>

          {/* Insight Box */}
          <div className="bg-gradient-to-r from-gray-50 to-indigo-50/50 rounded-2xl p-4 border border-indigo-50 flex items-start gap-4 hover:shadow-sm transition-shadow">
            <div className="p-2 bg-white rounded-lg shadow-sm text-lg">💡</div>
            <div>
              <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Weekly Insight</h5>
              <p className="text-sm font-medium text-gray-700 leading-relaxed">
                {insight}
              </p>
            </div>
          </div>
      </div>
    </div>
  );
};

const DeadlinePressureMeter: React.FC<DeadlinePressureMeterProps> = ({ onAction }) => {
  const initialInputs = loadDeadlinePressureInputs();
  const [tasksInput, setTasksInput] = useState<string>(initialInputs.tasksInput);
  const [selectedMood, setSelectedMood] = useState<string>('focused');
  
  // We store the FULL rich analysis object here
  const [analysis, setAnalysis] = useState<PressureAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // This string represents the "chat" summary of the analysis for the ChatComponent
  const [chatSummary, setChatSummary] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveDeadlinePressureInputs({ tasksInput });
  }, [tasksInput]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [tasksInput]);

  const generatePrompt = useCallback((
    inputTasks: string,
    currentAnalysis: PressureAnalysis | null,
    updateText: string,
    mood: string
  ): string => {
    const baseInfo = `User Mood: ${mood}`;
    
    if (currentAnalysis && updateText.trim()) {
       return `${baseInfo}
       
Previous Analysis JSON Summary:
Pressure Score: ${currentAnalysis.pressureScore}
Current Tasks: ${currentAnalysis.tasks.map(t => t.name).join(', ')}

User Update: "${updateText}"

Please recalculate the ENTIRE PressureAnalysis JSON based on this update. Modify tasks list, timeline, and scores accordingly.`;
    }

    return `${baseInfo}

User Tasks & Deadlines:
${inputTasks}

Generate the full PressureAnalysis JSON.`;
  }, []);

  const handleCalculate = useCallback(async (overrideInput?: string) => {
    const inputToUse = overrideInput !== undefined ? overrideInput : tasksInput;
    
    if (!inputToUse.trim()) {
        setError("Please enter some tasks and deadlines.");
        return;
    }

    setLoading(true);
    setError(null);
    
    // Clear chat summary if it's a fresh calculation
    if (overrideInput === undefined) {
        setChatSummary(null);
    }

    try {
      const prompt = generatePrompt(tasksInput, analysis, overrideInput || '', selectedMood);
      
      const llmConfig: LLMConfig = {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.5,
      };
      
      const jsonResponse = await callGeminiApiJson<PressureAnalysis>(
        prompt, 
        pressureAnalysisSchema, 
        'gemini-2.5-flash', 
        llmConfig
      );
      
      setAnalysis(jsonResponse);
      
      // Generate a text summary for the chat component from the JSON
      const summary = `### Analysis Summary
**Pressure:** ${jsonResponse.pressureLevel} (${jsonResponse.pressureScore}%)
**Forecast:** ${jsonResponse.forecastMessage}

${jsonResponse.redZoneWarning ? `**⚠️ ${jsonResponse.redZoneWarning}**\n` : ''}
${jsonResponse.overloadWarning ? `**🚨 ${jsonResponse.overloadWarning}**\n` : ''}

**Top Priority:** ${jsonResponse.tasks[0]?.name || 'None'}
`;
      setChatSummary(summary);
      onAction(ActionType.PRESSURE_CALCULATED);
      
    } catch (err: any) {
      console.error("Deadline Pressure API Error:", err);
      setError(err.message || "Failed to calculate pressure.");
    } finally {
      setLoading(false);
    }
  }, [tasksInput, analysis, selectedMood, generatePrompt, onAction]);

  const handleChatSubmit = (text: string) => {
      // Treat chat input as an update
      handleCalculate(text);
  };

  const handleClear = () => {
      setAnalysis(null);
      setChatSummary(null);
      setError(null);
  };

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-orange-500 drop-shadow-sm">
        ⏳ Deadline Pressure Meter
      </h2>
      
      {/* Input Section */}
      <div className="mb-6">
        <label htmlFor="tasksInput" className="block text-lg font-bold text-gray-800 mb-2">
          Your Tasks & Deadlines:
        </label>
        <div className="relative">
             <textarea
                ref={textareaRef}
                id="tasksInput"
                rows={3}
                className="w-full p-4 border-2 border-red-300 bg-red-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-orange-300 focus:border-orange-600 transition-all duration-300 text-gray-900 placeholder-red-400 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold min-h-24 resize-none"
                value={tasksInput}
                onChange={(e) => setTasksInput(e.target.value)}
                disabled={loading}
                placeholder="- Math Homework (Due Tomorrow)&#10;- Science Project (Due in 3 days)"
            ></textarea>
        </div>

        {/* Mood Selector */}
        <div className="mt-4">
            <label className="block text-sm font-bold text-gray-600 mb-2">Current Mood (Affects Pressure Score):</label>
            <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                    <button
                        key={m.value}
                        onClick={() => setSelectedMood(m.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-bold transition-all duration-200 ${
                            selectedMood === m.value 
                            ? 'bg-red-100 border-red-400 text-red-800 scale-105 shadow-md' 
                            : 'bg-white border-gray-200 text-gray-500 hover:border-red-200'
                        }`}
                        disabled={loading}
                    >
                        <span className="text-lg">{m.emoji}</span>
                        <span>{m.label}</span>
                    </button>
                ))}
            </div>
        </div>
        
        {!analysis && (
            <button
                onClick={() => handleCalculate()}
                className="mt-6 w-full font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] shadow-xl hover:shadow-2xl focus:outline-none bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !tasksInput.trim()}
            >
                {loading ? 'Analyzing Pressure...' : 'Calculate Pressure'}
            </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative mb-4 shadow-md" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {analysis && (
          <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h3 className="text-xl font-bold text-gray-800">📊 Dashboard</h3>
                  <button 
                    onClick={handleClear}
                    className="text-sm font-bold text-gray-500 hover:text-red-600 underline"
                  >
                    Reset Analysis
                  </button>
              </div>

              {/* 1. Pressure Gauge & Warnings */}
              <VisualPressureGauge score={analysis.pressureScore} mood={selectedMood} />

              {(analysis.redZoneWarning || analysis.overloadWarning) && (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
                      {analysis.redZoneWarning && <p className="font-bold text-red-800">⚠️ {analysis.redZoneWarning}</p>}
                      {analysis.overloadWarning && <p className="font-bold text-red-700 mt-1">🚨 {analysis.overloadWarning}</p>}
                  </div>
              )}

              {/* 2. Forecast & Health Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="text-blue-800 font-bold mb-1 flex items-center gap-2">🔮 Smart Forecast</h4>
                      <p className="text-sm text-blue-900">{analysis.forecastMessage}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <h4 className="text-green-800 font-bold mb-1 flex items-center gap-2">❤️ Study-Health Balance</h4>
                      <p className="text-sm text-green-900">{analysis.healthBalanceMessage}</p>
                  </div>
              </div>

              {/* 3. PREMIUM Stress Map (New Upgrade) */}
              <PremiumStressMap 
                data={analysis.timelineData} 
                insight={analysis.weeklyInsight}
                trend={analysis.forecastTrend}
                comparison={analysis.previousWeekComparison}
              />

              {/* 4. Task List with Priority Scores */}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mt-6">
                  <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="text-xl">🔥</span> Task Priority List
                  </h4>
                  <div className="space-y-3">
                      {analysis.tasks.map((task, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-transform hover:scale-[1.01]">
                              <div className="flex-1">
                                  <div className="font-bold text-gray-800 text-lg">{task.name}</div>
                                  <div className="text-sm text-gray-500 font-medium">Due: {task.deadline}</div>
                              </div>
                              <div className="w-full sm:w-1/3 flex flex-col gap-1">
                                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                      <span className={
                                          task.pressureLevel === 'Critical' ? 'text-red-600' :
                                          task.pressureLevel === 'High' ? 'text-orange-500' : 'text-green-600'
                                      }>{task.pressureLevel}</span>
                                      <span className="text-gray-400">{task.priorityScore}/100</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${
                                            task.priorityScore > 80 ? 'bg-red-500' : 
                                            task.priorityScore > 50 ? 'bg-orange-400' : 'bg-green-500'
                                        }`} 
                                        style={{ width: `${task.priorityScore}%` }}
                                      ></div>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* 5. Auto-Rescheduler (if applicable) */}
              {analysis.rescheduledPlan && analysis.rescheduledPlan.length > 0 && (
                  <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                       <h4 className="text-purple-800 font-bold mb-3 flex items-center gap-2">🤖 AI Auto-Rescheduler Suggestion</h4>
                       <ul className="space-y-2">
                           {analysis.rescheduledPlan.map((step, i) => (
                               <li key={i} className="flex items-start gap-2 text-sm text-purple-900 font-medium bg-white/50 p-2 rounded-lg">
                                 <span className="text-purple-500 mt-0.5">👉</span> {step}
                               </li>
                           ))}
                       </ul>
                  </div>
              )}

              {/* 6. Instant Relief Tips */}
              <div className="bg-teal-50 p-6 rounded-2xl border border-teal-100">
                   <h4 className="text-teal-800 font-bold mb-3 flex items-center gap-2">🍃 Instant Relief Tips</h4>
                   <div className="flex flex-wrap gap-2">
                       {analysis.reliefTips.map((tip, i) => (
                           <span key={i} className="px-4 py-2 bg-white text-teal-700 text-sm font-bold rounded-xl border border-teal-200 shadow-sm">
                               {tip}
                           </span>
                       ))}
                   </div>
              </div>

              {/* Chat Interface for Updates */}
              <div className="relative flex flex-col h-[300px] bg-white rounded-3xl shadow-lg overflow-hidden border border-red-100 mt-6">
                <ChatComponent
                    placeholder={[
                        "I finished the Math task!",
                        "My History test was moved to next week.",
                        "Add a Biology quiz for tomorrow."
                    ]}
                    onSubmit={handleChatSubmit}
                    response={chatSummary}
                    loading={loading}
                    clearResponse={() => {}} 
                    inputColorClasses="border-red-400 bg-red-50 focus:ring-orange-300 focus:border-orange-600 placeholder-red-600"
                    buttonColorClasses="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white focus:ring-orange-300"
                    onAction={onAction}
                    actionType={ActionType.PRESSURE_CALCULATED}
                    loadingMessage="Recalculating pressure..."
                    className="h-full border-0 shadow-none"
                />
              </div>
          </div>
      )}
    </div>
  );
};

export default DeadlinePressureMeter;
