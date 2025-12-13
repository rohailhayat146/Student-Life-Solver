import React from 'react';

interface XpProgressMeterProps {
  currentXp: number;
  level: number;
  xpToNextLevel: number; // Max XP for current level, or XP needed for next level
}

const XpProgressMeter: React.FC<XpProgressMeterProps> = ({ currentXp, level, xpToNextLevel }) => {
  const xpForCurrentLevel = level === 0 ? 0 : (xpToNextLevel - (xpToNextLevel - currentXp)); // XP earned in current level band
  const progressTowardsNextLevel = xpToNextLevel > 0 ? ((currentXp - (level === 0 ? 0 : (xpToNextLevel - xpToNextLevel))) / (xpToNextLevel - (level === 0 ? 0 : (xpToNextLevel - currentXp)))) * 100 : 0;
  // Simplified for display: currentXp is total. xpToNextLevel is target.
  // We want to show progress from the start of current level to the target of next.
  // Example: Level 0 (0-99XP), Level 1 (100-249XP), Level 2 (250-499XP)
  // If currentXp = 150, level = 1, xpForNextLevel = 250 (XP required for Level 2)
  // XP at start of Level 1 = 100
  // Progress = (150 - 100) / (250 - 100) = 50 / 150 = 33.3%

  const getXpAtStartOfCurrentLevel = (currentLevel: number) => {
    // Assuming XP_LEVELS is available here or passed as prop. For now, hardcode a typical progression.
    const XP_LEVELS_ARRAY = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];
    return XP_LEVELS_ARRAY[currentLevel] || 0;
  };
  
  const xpAtStartOfCurrentLevel = getXpAtStartOfCurrentLevel(level);
  const xpNeededForCurrentLevel = xpToNextLevel - xpAtStartOfCurrentLevel;
  const xpEarnedInCurrentLevel = currentXp - xpAtStartOfCurrentLevel;
  const progress = xpNeededForCurrentLevel > 0 ? (xpEarnedInCurrentLevel / xpNeededForCurrentLevel) * 100 : 100;
  const clampedProgress = Math.max(0, Math.min(progress, 100)); // Ensure it's between 0 and 100

  const flameSize = 1 + (clampedProgress / 100) * 0.2; // Flame grows from 1 to 1.2 times its size
  const flameIntensity = clampedProgress / 100; // Controls glow/animation intensity

  return (
    <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-4 rounded-2xl shadow-xl border border-gray-200 flex items-center gap-4 animate-fade-in">
      <div className="relative text-3xl" style={{ transform: `scale(${flameSize})` }}>
        <span
          role="img"
          aria-label="Fire flame icon"
          className="transition-all duration-300 ease-out"
          style={{
            filter: `drop-shadow(0 0 ${flameIntensity * 8 + 2}px rgba(255, 100, 0, ${flameIntensity * 0.8 + 0.2}))`,
            animation: level >= 9 ? 'pulse-glow 1.5s infinite alternate' : 'none', // Assuming max level is 9 for now
          }}
        >
          ✨
        </span>
        {/* Keyframe for pulse-glow animation */}
        <style>{`
          @keyframes pulse-glow {
            from { filter: drop-shadow(0 0 4px rgba(255, 100, 0, 0.4)); transform: scale(1); }
            to { filter: drop-shadow(0 0 12px rgba(255, 165, 0, 1)); transform: scale(1.1); }
          }
        `}</style>
      </div>

      <div className="flex-grow">
        <h3 className="text-lg font-bold text-gray-700 mb-1">
          Level {level}: {currentXp} XP {level < 9 ? `(${xpEarnedInCurrentLevel}/${xpNeededForCurrentLevel} to next)` : '(MAX LEVEL)'}
        </h3>
        <div className="w-full bg-gray-300 rounded-full h-3.5 shadow-inner overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${clampedProgress}%`,
              background: `linear-gradient(to right, #6d28d9, #8b5cf6, #c084fc)`, // Purple gradient for XP
              boxShadow: `0 0 8px rgba(124, 58, 237, ${clampedProgress / 100})`, // Subtle glow
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default XpProgressMeter;