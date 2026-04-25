import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  name, 
  className = '', 
  size = 'md' 
}) => {
  const [error, setError] = useState(false);

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-[12px]',
    md: 'w-10 h-10 text-[14px]',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
  };

  const initials = getInitials(name || 'User');
  const showInitials = error || !src || src.includes('placeholder') || src.includes('unsplash');

  // Simple hash for color
  const colors = [
    'bg-sky-500', 'bg-emerald-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-amber-500', 'bg-rose-500'
  ];
  const colorIndex = name ? name.length % colors.length : 0;
  const bgColor = colors[colorIndex];

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]} ${className}`}>
      <AnimatePresence mode="wait">
        {showInitials ? (
          <motion.div
            key="initials"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`w-full h-full rounded-2xl ${bgColor} text-white font-black flex items-center justify-center shadow-sm border-2 border-white`}
          >
            {initials}
          </motion.div>
        ) : (
          <motion.img
            key="image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            src={src!}
            alt={name}
            onError={() => setError(true)}
            className="w-full h-full rounded-2xl object-cover border-2 border-white shadow-sm"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
