import React, { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { X, FileText, Calendar, GitBranch } from 'lucide-react';
import { STATUS_CONFIG } from '../../constants';

const DescriptionReader: React.FC = () => {
  const { readingDescriptionId, setReadingDescriptionId, state } = useProject();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (readingDescriptionId) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 200); // Allow fade out
    }
  }, [readingDescriptionId]);

  if (!readingDescriptionId && !isVisible) return null;

  const branch = state.branches[readingDescriptionId || ''];
  if (!branch) return null;

  const statusConfig = STATUS_CONFIG[branch.status];

  const handleClose = () => {
      setReadingDescriptionId(null);
  };

  // Simple Markdown Renderer (Safe for read-only)
  const renderMarkdown = (text: string) => {
    if (!text) return <p className="text-gray-400 italic text-sm">Nessuna descrizione.</p>;
    
    // Sanitization & Parsing
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">$1</a>')
      .replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n/g, '<br />');

    return <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${readingDescriptionId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[85vh] transition-transform duration-200 ${readingDescriptionId ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 rounded-t-2xl">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusConfig.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-20 text-')}`}>
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {branch.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`inline-flex items-center gap-1 font-medium ${statusConfig.color}`}>
                           {statusConfig.icon} {statusConfig.label}
                        </span>
                        {branch.dueDate && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(branch.dueDate).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <button 
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="prose dark:prose-invert max-w-none">
                {renderMarkdown(branch.description || '')}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-b-2xl flex justify-end">
             <button 
                onClick={handleClose}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
             >
                 Chiudi
             </button>
        </div>
      </div>
    </div>
  );
};

export default DescriptionReader;
