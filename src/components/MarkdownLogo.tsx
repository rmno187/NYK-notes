import React from 'react';

interface MarkdownLogoProps {
  className?: string;
}

export const MarkdownLogo: React.FC<MarkdownLogoProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      viewBox="0 0 208 128"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Markdown Logo"
    >
      <rect width="208" height="128" rx="16" fill="none" stroke="currentColor" strokeWidth="12" />
      <path d="M30 98V30h20l20 25 20-25h20v68H90V58L70 83 50 58v40H30z" />
      <path d="M140 30l25 30h-15v38h-20V60h-15l25-30z" />
    </svg>
  );
};
