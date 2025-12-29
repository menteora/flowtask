
import React from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

const Markdown: React.FC<MarkdownProps> = ({ content, className = "" }) => {
  if (!content) {
    return <p className="text-gray-400 italic text-sm">Nessuna descrizione.</p>;
  }

  // Sanitizzazione minima e parsing base (grassetto, corsivo, link, liste)
  const renderedHtml = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">$1</a>')
    .replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n/g, '<br />');

  return (
    <div 
      className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words prose dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }} 
    />
  );
};

export default Markdown;
