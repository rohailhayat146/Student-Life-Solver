import React, { useEffect, useState } from 'react';
import { Achievement } from '../types';

interface BadgeCelebrationOverlayProps {
  badge: Achievement;
  onClose: () => void;
}

const BadgeCelebrationOverlay: React.FC<BadgeCelebrationOverlayProps> = ({ badge, onClose }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      onClose();
    }, 4000); // Overlay stays for 4 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in"
      aria-live="assertive"
      role="status"
    >
      <div className="bg-gradient-to-br from-purple-200 to-pink-200 rounded-3xl shadow-2xl max-w-lg w-full p-8 relative flex flex-col items-center text-center border-4 border-purple-400 transform scale-95 animate-pop-in">
        <span className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 text-2xl cursor-pointer" onClick={onClose} aria-label="Close celebration">&times;</span>

        <div className="text-8xl mb-6 p-4 rounded-full bg-white shadow-xl animate-spin-scale">
          {badge.icon}
        </div>
        <h2 className="text-4xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-600 drop-shadow-sm">
          Achievement Unlocked!
        </h2>
        <h3 className="text-2xl font-bold text-gray-800 mb-4">{badge.name}</h3>
        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          "{badge.description}"
        </p>
        <p className="text-sm text-gray-500">Unlocked on: {new Date(badge.unlockedAt).toLocaleDateString()}</p>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }

          @keyframes pop-in {
            0% { transform: scale(0.5); opacity: 0; }
            70% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); }
          }
          .animate-pop-in {
            animation: pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }

          @keyframes spin-scale {
            0% { transform: rotate(0deg) scale(0.8); }
            100% { transform: rotate(360deg) scale(1); }
          }
          .animate-spin-scale {
            animation: spin-scale 0.7s ease-out forwards;
          }
        `}</style>
      </div>
    </div>
  );
};

export default BadgeCelebrationOverlay;