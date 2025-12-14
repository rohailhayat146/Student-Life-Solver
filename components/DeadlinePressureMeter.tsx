import React, { useState, useCallback, useEffect, useRef, FormEvent } from 'react';
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
    pressureScore: { type: Type.NUMBER, description: "0-100 score." },
    pressureLevel: { type: Type.STRING, description: "Low, Medium, High, or Critical" },
    forecastMessage: { type: Type.STRING, description: "Short trend prediction." },
    healthBalanceMessage: { type: Type.STRING, description: "Short health eval." },
    moodAdjustmentMessage: { type: Type.STRING, description: "Mood impact." },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          deadline: { type: Type.STRING },
          priorityScore: { type: Type.NUMBER },
          pressureLevel: { type: Type.STRING }
        }
      }
    },
    rescheduledPlan: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 bullet points." },
    timelineData: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayLabel: { type: Type.STRING },
          pressureValue: { type: Type.NUMBER },
          mainStressor: { type: Type.STRING }
        }
      },
      description: "Pressure for next 5 days."
    },
    weeklyInsight: { type: Type.STRING, description: "1 sentence summary." },
    forecastTrend: { type: Type.STRING, description: "'Improving', 'Rising', or 'Stable'" },
    previousWeekComparison: { type: Type.STRING, nullable: true },
    reliefTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 quick tips." },
    redZoneWarning: { type: Type.STRING, nullable: true },
    overloadWarning: { type: Type.STRING, nullable: true },
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

const SYSTEM_INSTRUCTION = `You are the Deadline Pressure Meter. Analyze workload, urgency, mood, and health.

Output Rules:
- Score: 0-100.
- Timeline: 5 data points (Next 5 days).
- Insight: Concise 1 sentence.
- Trend: Rising/Improving/Stable.
- Red Zone: Warn if score > 80.

Return ONLY JSON matching the schema.`;

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

  const moodEmoji = MOODS.find(m => m.value === mood)?.emoji || '';

  return (
    <div className="mb-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 flex flex-col items-center animate-fade-in relative overflow-hidden">
      {score > 80 && (
         <div className="absolute inset-0 bg-red-50 opacity-50 animate-pulse pointer-events-none"></div>
      )}

      <div className="w-full flex justify-between items-end mb-4 relative z-10">
        <span className="text-gray-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
          Current Pressure {moodEmoji && <span className="text-xl bg-gray-100 p-1 rounded-lg" title={`Adjusted for ${mood} mood`}>{moodEmoji}</span>}
        </span>
        <span className={`text-5xl font-black ${colorClass} transition-colors duration-500`}>{score}%</span>
      </div>
      
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
    Stable: { icon: '⚖️', label: 'Stress Stable', color: 'text-blue-600 bg-blue-50 border-blue-100', arrow: '→', stripColor: 'bg-blue-400' },
  };

  const tConfig = trendConfig[trend] || trendConfig.Stable;

  return (
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             📅 5-Day Stress Forecast
           </h3>
           <div className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 border ${tConfig.color}`}>
              <span>{tConfig.icon}</span> {tConfig.label}
           </div>
        </div>

        <div className="flex justify-between items-end h-32 mb-4 px-2 gap-2">
           {data.map((day, idx) => {
             const c = getColorConfig(day.pressureValue);
             const isHovered = hoveredIndex === idx;
             const height = Math.max(10, day.pressureValue);
             
             return (
               <div 
                 key={idx} 
                 className="flex flex-col items-center justify-end h-full w-full group relative cursor-pointer"
                 onMouseEnter={() => setHoveredIndex(idx)}
                 onMouseLeave={() => setHoveredIndex(null)}
               >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 bg-gray-800 text-white text-xs p-2 rounded-lg z-20 w-32 text-center shadow-xl animate-fade-in pointer-events-none">
                       <div className="font-bold">{day.pressureValue}% Pressure</div>
                       <div className="text-gray-300 text-[10px]">Stressor: {day.mainStressor}</div>
                       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`text-sm mb-1 transition-all duration-300 ${isHovered ? 'scale-125 -translate-y-1' : ''}`}>
                    {getIcon(day.mainStressor)}
                  </div>

                  {/* Bar */}
                  <div 
                    className={`w-full max-w-[40px] rounded-t-xl bg-gradient-to-t ${c.from} ${c.to} opacity-80 group-hover:opacity-100 transition-all duration-300 relative`}
                    style={{ height: `${height}%` }}
                  >
                     {/* Value on bar if space allows */}
                     {height > 20 && (
                        <div className="absolute bottom-1 w-full text-center text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            {day.pressureValue}
                        </div>
                     )}
                  </div>

                  {/* Label */}
                  <div className={`mt-2 text-xs font-bold ${isHovered ? 'text-gray-800' : 'text-gray-400'}`}>
                    {day.dayLabel}
                  </div>
               </div>
             )
           })}
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
           <div className="flex items-start gap-3">
              <div className="text-xl mt-0.5">💡</div>
              <div>
                 <p className="text-sm font-bold text-gray-700 leading-snug">{insight}</p>
                 {comparison && <p className="text-xs text-gray-500 mt-1 font-medium">{comparison}</p>}
              </div>
           </div>
        </div>
      </div>
  );
};

const DeadlinePressureMeter: React.FC<DeadlinePressureMeterProps> = ({ onAction }) => {
    const initialInputs = loadDeadlinePressureInputs();
    const [tasksInput, setTasksInput] = useState<string>(initialInputs.tasksInput);
    const [userMood, setUserMood] = useState<string>('focused');
    const [analysis, setAnalysis] = useState<PressureAnalysis | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        saveDeadlinePressureInputs({ tasksInput });
    }, [tasksInput]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!tasksInput.trim()) return;

        setLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const prompt = `
            Analyze the following tasks/deadlines and user mood to calculate stress pressure.
            
            Tasks:
            ${tasksInput}

            User Mood: ${userMood}
            Date: ${new Date().toLocaleDateString()}
            `;

            const config: LLMConfig = {
                temperature: 0.5,
                systemInstruction: SYSTEM_INSTRUCTION
            };

            const result = await callGeminiApiJson<PressureAnalysis>(
                prompt,
                pressureAnalysisSchema,
                'gemini-2.5-flash',
                config
            );

            setAnalysis(result);
            onAction(ActionType.PRESSURE_CALCULATED);
        } catch (err: any) {
            console.error("Pressure calculation error:", err);
            setError("Failed to calculate pressure. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-orange-500 drop-shadow-sm">
                ⏳ Deadline Pressure Meter
            </h2>

            {!analysis ? (
                <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                    <div>
                        <label className="block text-lg font-bold text-gray-800 mb-2">
                            What's on your plate? (Tasks & Deadlines)
                        </label>
                        <textarea 
                            value={tasksInput}
                            onChange={(e) => setTasksInput(e.target.value)}
                            className="w-full p-4 border-2 border-red-200 bg-red-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-red-100 font-bold text-gray-800 h-40 resize-none placeholder-red-300"
                            placeholder="e.g., History Essay due Friday, Math Test on Monday, Science Project (50% done)..."
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-lg font-bold text-gray-800 mb-2">
                            How are you feeling right now?
                        </label>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar-horizontal">
                            {MOODS.map(m => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setUserMood(m.value)}
                                    className={`
                                        flex flex-col items-center justify-center p-3 rounded-2xl min-w-[80px] transition-all border-2
                                        ${userMood === m.value 
                                            ? 'bg-red-100 border-red-400 transform scale-105 shadow-md' 
                                            : 'bg-white border-gray-100 hover:border-red-200 hover:bg-red-50 text-gray-500'}
                                    `}
                                >
                                    <span className="text-2xl mb-1">{m.emoji}</span>
                                    <span className={`text-xs font-bold ${userMood === m.value ? 'text-red-700' : 'text-gray-400'}`}>{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                         <div className="bg-red-50 border border-red-500 text-red-800 px-4 py-3 rounded-lg relative shadow-md" role="alert">
                            <strong className="font-bold">Error:</strong>
                            <span className="block sm:inline ml-2">{error}</span>
                         </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !tasksInput.trim()}
                        className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-2xl shadow-lg transition-transform transform hover:scale-[1.01] active:scale-[0.98] text-lg disabled:opacity-50"
                    >
                        {loading ? 'Calculating Pressure...' : 'Calculate Pressure Score 📊'}
                    </button>
                    
                    {loading && (
                        <div className="mt-8">
                             <Loader message="Analyzing workload & stress levels..." />
                        </div>
                    )}
                </form>
            ) : (
                <div className="animate-fade-in space-y-6">
                    <VisualPressureGauge score={analysis.pressureScore} mood={userMood} />

                    <PremiumStressMap 
                        data={analysis.timelineData}
                        insight={analysis.weeklyInsight}
                        trend={analysis.forecastTrend as any}
                        comparison={analysis.previousWeekComparison}
                    />

                    {/* Rescheduled Plan */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                           🗓️ Recommended Action Plan
                        </h3>
                        <ul className="space-y-3">
                            {analysis.rescheduledPlan.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="bg-red-100 text-red-600 font-bold rounded-lg w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">{idx + 1}</span>
                                    <span className="text-gray-700 font-medium text-sm">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* Relief Tips */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-100 shadow-sm">
                         <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                           🍃 Instant Relief Tips
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {analysis.reliefTips.map((tip, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border border-emerald-100 text-emerald-900 text-sm font-bold shadow-sm text-center flex items-center justify-center">
                                    {tip}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="text-center pt-4">
                        <button 
                            onClick={() => setAnalysis(null)}
                            className="text-gray-400 hover:text-gray-600 font-bold text-sm underline"
                        >
                            Check Another Workload
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeadlinePressureMeter;