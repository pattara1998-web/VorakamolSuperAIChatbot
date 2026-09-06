// DynamicButton – lightweight button component using Tailwind CSS
// This component is intentionally simple to avoid extra UI library dependencies.

import React from 'react';

type DynamicButtonProps = {
  label: string;
  onClick: () => void;
  // Optional Tailwind classes for styling (e.g., bg-blue-500 hover:bg-blue-600)
  className?: string;
};

export const DynamicButton: React.FC<DynamicButtonProps> = ({ label, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 ${className}`}
    >
      {label}
    </button>
  );
};

