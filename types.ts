


export enum ToolName {
  DAILY_ACHIEVEMENTS = 'Daily Achievements', // New tab for Daily Achievement & Motivation Engine
  STUDY_ROUTINE = 'Study Routine Auto-Fixer',
  NOTES_CLEANER = 'Notes Cleaner & Smart Summarizer',
  HOMEWORK_CHECKER = 'Homework Checker',
  MOOD_STRESS = 'Mood & Stress Manager',
  DECISION_HELPER = 'Instant Decision Helper',
  PREDICT_MY_GRADE = 'Predict My Grade', // New tool for grade prediction
  DEADLINE_PRESSURE = 'Deadline Pressure Meter', // New tool for deadline analysis
}

export enum ActionType {
  STUDY_PLAN_GENERATED = 'STUDY_PLAN_GENERATED',
  NOTES_SUMMARIZED = 'NOTES_SUMMARIZED',
  HOMEWORK_CHECKED = 'HOMEWORK_CHECKED',
  MOOD_UPDATED = 'MOOD_UPDATED',
  DECISION_MADE = 'DECISION_MADE',
  GRADE_PREDICTED = 'GRADE_PREDICTED',
  PRESSURE_CALCULATED = 'PRESSURE_CALCULATED',
}

export enum AchievementType {
  FIRE_MASTER = 'Fire Master', // studying 3 days in a row
  NOTES_HERO = 'Notes Hero', // creating 5 organized notes
  HOMEWORK_LEGEND = 'Homework Legend', // completing 5 tasks
  FOCUS_BEAST = 'Focus Beast', // studying 2+ hours without a break (based on plan)
  CONSISTENCY_KING_QUEEN = 'Consistency King/Queen', // 7-day streak
}

export enum AudioFx {
  XP_GAIN = 'xp_gain',
  LEVEL_UP = 'level_up',
  BADGE_UNLOCK = 'badge_unlock',
  STREAK_MAINTAIN = 'streak_maintain',
}

export interface Achievement {
  id: AchievementType;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string; // ISO string timestamp
}

export interface XpState {
  xp: number;
  level: number;
}

export interface DailyActivityCounts {
  studyPlansGenerated: number;
  notesSummarized: number;
  homeworkChecked: number;
  moodUpdates: number;
  decisionsMade: number;
  gradesPredicted: number;
  focusBeastEligibleToday: boolean; // For Focus Beast badge
}

export interface DailyAchievementState {
  xpState: XpState;
  unlockedBadges: AchievementType[];
  currentStreak: number;
  lastActivityDate: string | null; // ISO date string of last activity
  dailyActionCounts: { [date: string]: DailyActivityCounts }; // Tracks counts per day for XP and badges
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export type LLMConfig = {
  systemInstruction?: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  responseMimeType?: string; // Added for JSON responses
  responseSchema?: any; // Added for JSON responses
};

// Types for Study Routine Auto-Fixer
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export interface StudyPlan {
  day: string;
  subjects: {
    name: string;
    duration: string;
    notes?: string;
  }[];
}

export interface StudyRoutineInputs {
  subjects: string;
  hoursPerDay: number;
  difficulty: DifficultyLevel;
  isGroupMode?: boolean; // Added for collaborative study
  groupMembers?: string; // Added for collaborative study
  // New fields for separation
  groupSubjects?: string;
  groupHoursPerDay?: number;
  groupDifficulty?: DifficultyLevel;
}

// Types for Notes Cleaner & Smart Summarizer
export type NoteFormat = 'exam-style' | 'bullet-points' | 'revision-sheet';

export interface NotesSummarizerInputs {
  notesInput: string;
  format: NoteFormat;
}

// Types for Homework Checker
export type HomeworkEvaluation = {
  correctness: string;
  mistakes: string[];
  missingPoints: string[];
  perfectAnswer?: string; // Only if requested
};

export interface HomeworkCheckerInputs {
  question: string;
  userAnswer: string;
  rewriteRequested: boolean;
}

// Types for Instant Decision Helper
// Old type for single decision is replaced by new JSON schema types for comparative analysis
export interface ScenarioAnalysis {
  option: string;
  pros: string[];
  cons: string[];
}

export interface DecisionAnalysis {
  overallRecommendation: string;
  scenarios: ScenarioAnalysis[];
}

// Types for Deadline Pressure Meter
export interface DeadlinePressureInputs {
  tasksInput: string;
}

export interface AnalyzedTask {
  name: string;
  deadline: string;
  priorityScore: number; // 0-100
  pressureLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface PressureTimelineData {
  dayLabel: string; // e.g., "Mon", "Tue"
  pressureValue: number; // 0-100
  mainStressor: 'tasks' | 'deadline' | 'exam' | 'mood' | 'rest'; // Icon indicator
}

export interface PressureAnalysis {
  pressureScore: number; // 0-100
  pressureLevel: string;
  forecastMessage: string; // Smart Forecast
  healthBalanceMessage: string; // Study-Health Balance
  moodAdjustmentMessage?: string; // How mood affected the score
  tasks: AnalyzedTask[];
  rescheduledPlan: string[]; // Auto-Rescheduler suggestions
  timelineData: PressureTimelineData[]; // For Visual Graph
  reliefTips: string[]; // Instant Relief Tips
  redZoneWarning: string | null; // Text if score > 80
  overloadWarning: string | null; // Text if overload detected
  weeklySummary: {
    totalTasks: number;
    highStressDay: string;
    lowStressDay: string;
    suggestions: string;
  };
  // New Premium Feature Fields
  weeklyInsight: string;
  forecastTrend: 'Improving' | 'Rising' | 'Stable';
  previousWeekComparison: string | null;
}


// New type for saved AI responses
export interface SavedItem {
  id: string;
  toolName: ToolName;
  title: string;
  content: string;
  timestamp: string; // ISO string for easy sorting/display
}

// Common props for tools that send messages and can trigger gamification actions
export interface OnActionProps {
  onAction: (action: ActionType, data?: Record<string, any>) => void;
}
