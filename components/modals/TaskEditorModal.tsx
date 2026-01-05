
import React, { useEffect, useState, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useTask } from '../../context/TaskContext';
import { X, Calendar, User, Trash2, CheckSquare, Square, Save, ArrowRight, Bold, Italic, List, Link as LinkIcon, Mail, Check, Eye, Edit2, Pin, CalendarDays, CheckCircle2 } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { Branch } from '../../types';
import DatePicker from '../ui/DatePicker';
import Markdown from '../ui/Markdown';

const TaskEditorModal: React.FC = () => {
  const { state } = useProject();
  // Using TaskContext for task editing actions and state
  const { editingTask, setEditingTask, updateTask, deleteTask, moveTaskToBranch } = useTask();

  const [isVisible, setIsVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState('');
  const [pinned, setPinned] = useState(false);
  
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [popupMode, setPopupMode] = useState<'link' | 'email' | null>(null);
  const [popupInput, setPopupInput] = useState('');
  const popupInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [targetBranchId, setTargetBranchId] = useState('');

  useEffect(() => {
    if (editingTask) {
        const branch = state.branches[editingTask.branchId];
        const task = branch?.tasks.find(t => t.id === editingTask.taskId);
        
        if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setAssigneeId(task.assigneeId || '');
            setDueDate(task.dueDate || '');
            setCompleted(task.completed);
            setPinned(task.pinned || false);
            setTargetBranchId(''); 
            setIsPreviewMode(false); 
            setPopupMode(null);

            if (task.completedAt) {
                const date = new Date(task.completedAt);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const mins = String(date.getMinutes()).padStart(2, '0');
                setCompletedAt(`${year}-${month}-${day}T${hours}:${mins}`);
            } else {
                setCompletedAt('');
            }

            setIsVisible(true);
        } else {
            setEditingTask(null);
        }
    } else {
        setTimeout(() => setIsVisible(false), 200);
    }
  }, [editingTask, state.branches, setEditingTask]);

  useEffect(() => {
      if (popupMode && popupInputRef.current) {
          popupInputRef.current.focus();
      }
  }, [popupMode]);

  if (!editingTask && !isVisible) return null;

  const handleClose = () => {
      setEditingTask(null);
  };

  const handleSave = () => {
      if (!editingTask || !title.trim()) return;
      
      let finalCompletedAt = undefined;
      if (completed) {
          finalCompletedAt = completedAt ? new Date(completedAt).toISOString() : new Date().toISOString();
      }

      updateTask(editingTask.branchId, editingTask.taskId, {
          title: title.trim(),
          description: description,
          assigneeId: assigneeId || undefined,
          dueDate: dueDate || undefined,
          completed,
          completedAt: finalCompletedAt,
          pinned
      });
      handleClose();
  };

  const handleDelete = () => {
      if (!editingTask) return;
      if (confirm("Sei sicuro di voler eliminare questo task?")) {
          deleteTask(editingTask.branchId, editingTask.taskId);
          handleClose();
      }
  };

  const handleMoveTask = () => {
      if (!editingTask || !targetBranchId) return;
      moveTaskToBranch(editingTask.taskId, editingTask.branchId, targetBranchId);
      handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') handleSave();
      if (e.key === 'Escape') handleClose();
  };

  const insertFormat = (prefix: string, suffix: string, selectionOverride?: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = description;
    
    const before = text.substring(0, start);
    const selection = selectionOverride !== undefined ? selectionOverride : text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    setDescription(newText);

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
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${editingTask ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col transition-transform duration-200 max-h-[90vh] ${editingTask ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-white">Modifica Task</h3>
                <button
                    onClick={() => setPinned(!pinned)}
                    className={`p-1.5 rounded-full transition-colors ${pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    title={pinned ? "Rimuovi da Focus" : "Aggiungi a Focus"}
                >
                    <Pin className={`w-4 h-4 ${pinned ? 'fill-current' : ''}`} />
                </button>
            </div>
            <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <button 
                        onClick={() => setCompleted(!completed)}
                        className={`mt-1 flex-shrink-0 ${completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-500 hover:text-indigo-500'}`}
                    >
                        {completed ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                    </button>
                    <input
                        autoFocus
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nome del task..."
                        className="flex-1 text-lg font-medium bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                </div>
                
                {completed && (
                    <div className="ml-9 animate-in slide-in-from-left-2 duration-200">
                        <label className="block text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Data Chiusura (Manuale)
                        </label>
                        <DatePicker 
                            type="datetime-local"
                            value={completedAt}
                            onChange={(val) => setCompletedAt(val)}
                            placeholder="Data chiusura"
                            className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1 text-slate-700 dark:text-slate-200 w-fit"
                        />
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descrizione</label>
                    <button 
                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                        {isPreviewMode ? <Edit2 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {isPreviewMode ? 'Modifica' : 'Anteprima'}
                    </button>
                </div>
                
                {isPreviewMode ? (
                    <div className="min-h-[100px] p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Markdown content={description} />
                    </div>
                ) : (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden relative focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
                        <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <button onClick={() => handleToolbarAction('bold')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Grassetto"><Bold className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToolbarAction('italic')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Corsivo"><Italic className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToolbarAction('link')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Link"><LinkIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToolbarAction('email')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Gmail Search"><Mail className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToolbarAction('list')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Lista"><List className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToolbarAction('today-date')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Data Odierna"><CalendarDays className="w-3.5 h-3.5" /></button>
                        </div>

                        {popupMode && (
                            <div className="absolute top-[40px] left-2 right-2 z-10 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-lg rounded-lg p-2 flex gap-2 animate-in fade-in zoom-in-95 duration-150">
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
                                <button onClick={applyPopupValue} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check className="w-3 h-3" /></button>
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full h-24 p-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none resize-y"
                            placeholder="Descrizione opzionale..."
                        />
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Assegnatario</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        onClick={() => setAssigneeId('')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${!assigneeId ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <User className="w-4 h-4" />
                        <span>Nessuno</span>
                    </button>
                    {state.people.map(person => (
                        <button
                            key={person.id}
                            onClick={() => setAssigneeId(person.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${assigneeId === person.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <Avatar person={person} size="sm" />
                            <span className="truncate">{person.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Scadenza</label>
                 <DatePicker 
                    value={dueDate}
                    onChange={(val) => setDueDate(val)}
                    placeholder="Seleziona scadenza"
                    className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                    icon={<Calendar className="w-4 h-4 text-slate-400" />}
                />
            </div>
            
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Sposta in un altro ramo</label>
                 <div className="flex gap-2">
                     <select
                        value={targetBranchId}
                        onChange={(e) => setTargetBranchId(e.target.value)}
                        className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                     >
                         <option value="">Seleziona ramo...</option>
                         {(Object.values(state.branches) as Branch[]).filter(b => b.id !== editingTask?.branchId).map(b => (
                             <option key={b.id} value={b.id}>{b.title}</option>
                         ))}
                     </select>
                     <button
                        onClick={handleMoveTask}
                        disabled={!targetBranchId}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Sposta"
                     >
                         <ArrowRight className="w-5 h-5" />
                     </button>
                 </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 rounded-b-xl flex justify-between gap-3">
            <button 
                onClick={handleDelete}
                className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Elimina</span>
            </button>
            <div className="flex gap-2">
                <button 
                    onClick={handleClose}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                    Annulla
                </button>
                <button 
                    onClick={handleSave}
                    disabled={!title.trim()}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    <Save className="w-4 h-4" /> Salva
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TaskEditorModal;
