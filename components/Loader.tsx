import React, { useState, useEffect } from 'react';

interface LoaderProps {
  message?: string;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ 
  message = 'SLS is responding', 
  className = ''
}) => {
  return (
    <div className={`relative flex flex-col items-center justify-center p-8 rounded-3xl bg-white border-2 border-purple-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-w-sm w-full mx-auto my-6 overflow-hidden ${className}`}>
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-100 rounded-full blur-2xl opacity-60"></div>
      <div className="absolute -top-10 -left-10 w-24 h-24 bg-pink-100 rounded-full blur-2xl opacity-60"></div>

      {/* Animated Icon Container */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-500 to-fuchsia-500 rounded-full blur-md opacity-40 animate-pulse"></div>
        <div className="relative w-16 h-16 bg-gradient-to-tr from-violet-100 to-fuchsia-50 rounded-full flex items-center justify-center border border-white shadow-inner">
           {/* Rotating ring */}
           <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-l-pink-500 rounded-full animate-spin"></div>
           <span className="text-3xl animate-bounce" style={{ animationDuration: '2s' }}>✨</span>
        </div>
      </div>

      {/* Message Text */}
      <h3 className="text-lg font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-violet-700 to-pink-600 mb-3 animate-pulse">
        {message}
      </h3>

      {/* Loading Bar */}
      <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-loading-bar rounded-full"></div>
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 50%; }
          100% { width: 100%; transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s infinite ease-in-out;
          width: 50%;
        }
      `}</style>
    </div>
  );
};

export default Loader;