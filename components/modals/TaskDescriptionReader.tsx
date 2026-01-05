
import React, { useEffect, useState, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useTask } from '../../context/TaskContext';
import { X, FileText, Calendar, Edit2, Save, Bold, Italic, List, Link as LinkIcon, Mail, Check, CheckSquare, Square, CalendarDays, CheckCircle2 } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Markdown from '../ui/Markdown';

const TaskDescriptionReader: React.FC = () => {
  const { state } = useProject();
  // Using TaskContext for reading and updating tasks
  const { readingTask, setReadingTask, updateTask } = useTask();

  const [isVisible, setIsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [popupMode, setPopupMode] = useState<'link' | 'email' | null>(null);
  const [popupInput, setPopupInput] = useState('');
  const popupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (readingTask) {
      setIsVisible(true);
      const branch = state.branches[readingTask.branchId];
      const task = branch?.tasks.find(t => t.id === readingTask.taskId);
      if (task) setTempDescription(task.description || '');
    } else {
      setTimeout(() => {
          setIsVisible(false);
          setIsEditing(false); 
      }, 200); 
    }
  }, [readingTask, state.branches]);

  useEffect(() => {
    if (popupMode && popupInputRef.current) {
        popupInputRef.current.focus();
    }
  }, [popupMode]);

  if (!readingTask && !isVisible) return null;

  const branch = state.branches[readingTask?.branchId || ''];
  const task = branch?.tasks.find(t => t.id === readingTask?.taskId);
  
  if (!task) return null;

  const assignee = task.assigneeId ? state.people.find(p => p.id === task.assigneeId) : null;

  const handleClose = () => {
      setReadingTask(null);
  };

  const handleSave = () => {
      if(readingTask) {
          updateTask(readingTask.branchId, readingTask.taskId, { description: tempDescription });
          setIsEditing(false);
      }
  };

  const handleToggleComplete = () => {
      if(readingTask) {
          updateTask(readingTask.branchId, readingTask.taskId, { completed: !task.completed });
      }
  };

  const insertFormat = (prefix: string, suffix: string, selectionOverride?: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = tempDescription;
    
    const before = text.substring(0, start);
    const selection = selectionOverride !== undefined ? selectionOverride : text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    setTempDescription(newText);

    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
             if (selectionOverride !== undefined && prefix === '[' && suffix.includes('](')) {
                const descStart = start + 1;
                const descEnd = start + 1 + selection.length;
                textareaRef.current.setSelectionRange(descStart, descEnd);
            } else {
                 const newCursorPos = start + prefix.length + selection.length + suffix.length;
                 textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }
    }, 0);
  };

  const handleToolbarAction = (action: string) => {
      if (action === 'link') {
          setPopupMode('link');
          setPopupInput('');
      } else if (action === 'email') {
          setPopupMode('email');
          setPopupInput('');
      } else if (action === 'bold') {
          insertFormat('**', '**');
      } else if (action === 'italic') {
          insertFormat('*', '*');
      } else if (action === 'list') {
          insertFormat('\n- ', '');
      } else if (action === 'today-date') {
          const today = new Date();
          const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
          insertFormat(formattedDate, '');
      }
  };

  const applyPopupValue = () => {
      if (popupMode === 'link') {
          const url = popupInput.trim() || 'url';
          insertFormat('[', `](${url})`, 'link');
      } else if (popupMode === 'email') {
          const subject = popupInput.trim() || 'Oggetto';
          const encodedSubject = encodeURIComponent(subject);
          const mailUrl = `https://mail.google.com/mail/u/0/#search/subject%3A%22${encodedSubject}%22`;
          insertFormat(`[📨 ${subject}](${mailUrl})`, '', '');
      }
      setPopupMode(null);
      setPopupInput('');
  };

  return (
    <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${readingTask ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[85vh] transition-transform duration-200 ${readingTask ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 rounded-t-2xl">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <button 
                    onClick={handleToggleComplete}
                    className={`shrink-0 ${task.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-600 hover:text-indigo-500'}`}
                >
                    {task.completed ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className={`text-xl font-bold truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                        {task.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {assignee && (
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                <Avatar person={assignee} size="sm" className="w-4 h-4 text-[9px]" />
                                <span className="text-slate-700 dark:text-slate-300">{assignee.name}</span>
                            </div>
                        )}
                        {task.dueDate && (
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300">
                                <Calendar className="w-3 h-3" />
                                <span>Scadenza: {new Date(task.dueDate).toLocaleDateString()}</span>
                            </span>
                        )}
                        {task.completed && task.completedAt && (
                            <span className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Completato: {new Date(task.completedAt).toLocaleString()}</span>
                            </span>
                        )}
                        <span className="opacity-60 text-slate-500 dark:text-slate-400">{branch?.title}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 pl-2">
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                        title="Modifica Descrizione"
                    >
                        <Edit2 className="w-5 h-5" />
                    </button>
                ) : (
                    <button 
                        onClick={handleSave}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full transition-colors"
                        title="Salva"
                    >
                        <Save className="w-5 h-5" />
                    </button>
                )}
                <button 
                    onClick={handleClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 relative bg-white dark:bg-slate-900">
            {isEditing ? (
                <div className="h-full flex flex-col border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleToolbarAction('bold')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Grassetto"><Bold className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('italic')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Corsivo"><Italic className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('link')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Link"><LinkIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('email')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Link a Gmail Search"><Mail className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('list')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Lista"><List className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('today-date')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Inserisci Data Odierna"><CalendarDays className="w-3.5 h-3.5" /></button>
                    </div>

                    {popupMode && (
                        <div className="absolute top-[50px] left-8 right-8 z-10 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-lg rounded-lg p-2 flex gap-2 animate-in fade-in zoom-in-95 duration-150">
                            <input 
                                ref={popupInputRef}
                                type="text"
                                value={popupInput}
                                onChange={(e) => setPopupInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') applyPopupValue();
                                    if(e.key === 'Escape') { setPopupMode(null); setPopupInput(''); }
                                }}
                                placeholder={popupMode === 'link' ? "URL..." : "Oggetto..."}
                                className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button onClick={applyPopupValue} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check className="w-4 h-4" /></button>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={tempDescription}
                        onChange={(e) => setTempDescription(e.target.value)}
                        className="flex-1 w-full p-3 text-sm bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
                        placeholder="Scrivi qui..."
                        autoFocus
                    />
                </div>
            ) : (
                <Markdown content={task.description || ''} />
            )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-b-2xl flex justify-end gap-2">
             {isEditing ? (
                 <>
                    <button 
                        onClick={() => setIsEditing(false)}
                        className="px-5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm"
                    >
                        Annulla
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Salva
                    </button>
                 </>
             ) : (
                <button 
                    onClick={handleClose}
                    className="px-5 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
                >
                    Chiudi
                </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default TaskDescriptionReader;
