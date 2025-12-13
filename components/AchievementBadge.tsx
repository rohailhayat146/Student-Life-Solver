import React from 'react';
import { Achievement } from '../types';

interface AchievementBadgeProps {
  badge: Omit<Achievement, 'unlockedAt'>;
  isUnlocked: boolean;
  progress?: { current: number; total: number };
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({ badge, isUnlocked, progress }) => {
  const badgeClasses = `
    relative flex flex-col items-center justify-center p-3 rounded-xl shadow-sm text-center
    transition-all duration-300 transform hover:scale-105 group cursor-help overflow-hidden h-full w-full
    ${isUnlocked
      ? 'bg-gradient-to-br from-yellow-50 to-purple-50 border border-yellow-200'
      : 'bg-gray-50 border border-gray-200'
    }
  `;

  // For locked items, keep grayscale but slightly transparent, allow progress color to show
  const contentClasses = `
    flex flex-col items-center z-10 w-full flex-grow justify-center
    ${isUnlocked ? '' : 'grayscale opacity-70'}
  `;

  const iconClasses = `
    text-4xl mb-2 transition-transform duration-300
    ${isUnlocked ? 'group-hover:rotate-6' : ''}
  `;

  const textClasses = `
    text-sm font-semibold leading-tight
    ${isUnlocked ? 'text-gray-800' : 'text-gray-500'}
  `;

  const progressPercent = progress ? Math.min((progress.current / progress.total) * 100, 100) : 0;

  return (
    <div className={badgeClasses} aria-label={badge.name} data-tooltip={badge.description}>
      <div className={contentClasses}>
        <div className="relative">
          <span className={iconClasses}>{badge.icon}</span>
          {!isUnlocked && (
            <span className="absolute -top-1 -right-2 text-base" title="Locked">🔒</span>
          )}
        </div>
        <span className={textClasses}>{badge.name}</span>
      </div>

      {/* Progress Bar for Locked Items */}
      {!isUnlocked && progress && (
        <div className="w-full mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden z-10 shrink-0">
          <div 
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      )}
      
      {/* Progress Text for Locked Items */}
      {!isUnlocked && progress && (
        <div className="text-xs text-blue-600 font-bold mt-1 z-10 shrink-0">
          {progress.current} / {progress.total}
        </div>
      )}

      {/* Tooltip for description */}
      <div className={`
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg
        bg-gray-800 text-white text-xs whitespace-nowrap opacity-0 pointer-events-none
        transition-opacity duration-300 group-hover:opacity-100 z-20 shadow-lg hidden sm:block
      `}>
        {badge.description}
        {!isUnlocked && progress && (
          <div className="mt-1 text-blue-200 font-bold border-t border-gray-600 pt-1">
             Progress: {progress.current}/{progress.total}
          </div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800"></div>
      </div>
    </div>
  );
};

export default AchievementBadge;