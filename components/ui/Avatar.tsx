import React from 'react';
import { Person } from '../../types';

interface AvatarProps {
  person: Person;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ person, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  return (
    <div 
      className={`${sizeClasses[size]} ${person.color} rounded-full flex items-center justify-center text-white font-medium shadow-sm ${className}`}
      title={person.name}
    >
      {person.initials}
    </div>
  );
};

export default Avatar;