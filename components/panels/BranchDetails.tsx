
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import { useTask } from '../../context/TaskContext';
import { BranchStatus, Branch, Person } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { X, Save, Trash2, CheckSquare, Square, Calendar, Plus, Link as LinkIcon, Unlink, FileText, ChevronUp, ChevronDown, Loader2, ArrowRight, Check, Move, CheckCircle2, UserPlus, Eye, Edit2, Archive, RefreshCw, CalendarDays, Bold, Italic, List, Zap, GitBranch, Search, Globe, LayoutGrid, Mail, Tag, Hash } from 'lucide-react';
import Avatar from '../ui/Avatar';
import DatePicker from '../ui/DatePicker';

const BranchDetails: React.FC = () => {
  const { state, session, isOfflineMode, showNotification, listProjectsFromSupabase, getProjectBranchesFromSupabase, moveLocalBranchToRemoteProject } = useProject();
  const { selectedBranchId, selectBranch, updateBranch, deleteBranch, linkBranch, unlinkBranch, toggleBranchArchive } = useBranch();
  const { addTask, updateTask, moveTask, deleteTask, bulkUpdateTasks, bulkMoveTasks, setEditingTask, setReadingTask, showOnlyOpen } = useTask();
  
  const branch = selectedBranchId ? state.branches[selectedBranchId] : null;
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localStatus, setLocalStatus] = useState<BranchStatus>(BranchStatus.PLANNED);
  const [localResponsibleId, setLocalResponsibleId] = useState<string | undefined>(undefined);
  const [localStartDate, setLocalStartDate] = useState<string | undefined>(undefined);
  const [localDueDate, setLocalDueDate] = useState<string | undefined>(undefined);
  const [localIsLabel, setLocalIsLabel] = useState(false);
  const [localIsSprint, setLocalIsSprint] = useState(false);
  const [localSprintCounter, setLocalSprintCounter] = useState(1);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // WYSIWYG State
  const [popupMode, setPopupMode] = useState<'link' | 'email' | null>(null);
  const [popupInput, setPopupInput] = useState('');
  const popupInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Funzioni avanzate: Link e Migrazione
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [isMigrateMode, setIsMigrateMode] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [selectedRemoteProj, setSelectedRemoteProj] = useState('');
  const [remoteBranches, setRemoteBranches] = useState<Branch[]>([]);
  const [selectedRemoteParent, setSelectedRemoteParent] = useState('');
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  
  // Gestione Multi-Task Bulk
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkMoveMode, setIsBulkMoveMode] = useState(false);
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState('');

  useEffect(() => {
    if (branch) {
      setLocalTitle(branch.title);
      setLocalDescription(branch.description || '');
      setLocalStatus(branch.status);
      setLocalResponsibleId(branch.responsibleId);
      setLocalStartDate(branch.startDate);
      setLocalDueDate(branch.dueDate);
      setLocalIsLabel(branch.isLabel || false);
      setLocalIsSprint(branch.isSprint || false);
      setLocalSprintCounter(branch.sprintCounter || 1);
      setBulkText(branch.tasks.map(t => t.title).join('\n'));
      
      setShowDeleteConfirm(false); setIsLinkMode(false); setIsMigrateMode(false);
      setSelectedTaskIds([]); setIsBulkMoveMode(false); setIsBulkMode(false);
      setPopupMode(null);
    }
  }, [branch?.id]); 

  const isDirty = useMemo(() => {
    if (!branch) return false;
    return localTitle !== branch.title || localDescription !== (branch.description || '') || localStatus !== branch.status || localResponsibleId !== branch.responsibleId || localStartDate !== branch.startDate || localDueDate !== branch.dueDate || localIsLabel !== (branch.isLabel || false) || localIsSprint !== (branch.isSprint || false) || localSprintCounter !== (branch.sprintCounter || 1);
  }, [branch, localTitle, localDescription, localStatus, localResponsibleId, localStartDate, localDueDate, localIsLabel, localIsSprint, localSprintCounter]);

  const handleSaveAll = () => {
    if (!branch) return;
    updateBranch(branch.id, { title: localTitle, description: localDescription, status: localStatus, responsibleId: localResponsibleId, startDate: localStartDate, dueDate: localDueDate, isLabel: localIsLabel, isSprint: localIsSprint, sprintCounter: localSprintCounter });
    showNotification("Modifiche salvate con successo.", "success");
  };

  // WYSIWYG Logic
  const insertFormat = (prefix: string, suffix: string, selectionOverride?: string) => {
    if (!descriptionRef.current) return;
    const start = descriptionRef.current.selectionStart;
    const end = descriptionRef.current.selectionEnd;
    const text = localDescription;
    
    const before = text.substring(0, start);
    const selection = selectionOverride !== undefined ? selectionOverride : text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    setLocalDescription(newText);

    setTimeout(() => {
        if (descriptionRef.current) {
            descriptionRef.current.focus();
            const newCursorPos = start + prefix.length + (selectionOverride?.length || (end - start)) + suffix.length;
            descriptionRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
    }, 0);
  };

  const handleToolbarAction = (action: string) => {
      if (action === 'link') { setPopupMode('link'); setPopupInput(''); }
      else if (action === 'email') { setPopupMode('email'); setPopupInput(''); }
      else if (action === 'bold') insertFormat('**', '**');
      else if (action === 'italic') insertFormat('*', '*');
      else if (action === 'list') insertFormat('\n- ', '');
      else if (action === 'today-date') {
          const today = new Date().toLocaleDateString('it-IT');
          insertFormat(today, '');
      }
  };

  const applyPopupValue = () => {
      if (popupMode === 'link') insertFormat('[', `](${popupInput || 'url'})`, 'link');
      else if (popupMode === 'email') {
          const mailUrl = `https://mail.google.com/mail/u/0/#search/subject%3A%22${encodeURIComponent(popupInput)}%22`;
          insertFormat(`[📨 ${popupInput || 'Email'}](${mailUrl})`, '', '');
      }
      setPopupMode(null); setPopupInput('');
  };

  const handleLinkParent = (parentId: string) => {
      if (!branch) return;
      linkBranch(branch.id, parentId);
      setIsLinkMode(false);
  };

  const handleMigrateToRemote = async () => {
      if (!branch || !selectedRemoteProj || !selectedRemoteParent) return;
      setIsLoadingRemote(true);
      try {
          await moveLocalBranchToRemoteProject(branch.id, selectedRemoteProj, selectedRemoteParent);
          deleteBranch(branch.id);
          selectBranch(null);
      } finally { setIsLoadingRemote(false); }
  };

  const fetchRemoteData = async () => {
      setIsLoadingRemote(true);
      try {
          const projs = await listProjectsFromSupabase();
          setRemoteProjects(projs.filter(p => p.id !== state.id));
      } finally { setIsLoadingRemote(false); }
  };

  useEffect(() => {
      if (selectedRemoteProj) {
          setIsLoadingRemote(true);
          getProjectBranchesFromSupabase(selectedRemoteProj).then(res => {
              setRemoteBranches(res);
              setIsLoadingRemote(false);
          });
      }
  }, [selectedRemoteProj]);

  const sortedTasks = useMemo(() => {
    if (!branch) return [];
    let list = [...branch.tasks];
    if (showOnlyOpen) list = list.filter(t => !t.completed);
    return list.sort((a, b) => a.completed === b.completed ? (a.position ?? 0) - (b.position ?? 0) : (a.completed ? 1 : -1));
  }, [branch?.tasks, showOnlyOpen]);

  const potentialParents = useMemo(() => {
      return Object.values(state.branches).filter(b => 
          b.id !== branch?.id && 
          !branch?.parentIds.includes(b.id) &&
          b.title.toLowerCase().includes(linkSearch.toLowerCase())
      );
  }, [state.branches, branch, linkSearch]);

  if (!branch) return null;

  return (
    <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-96 bg-white dark:bg-slate-900 md:border-l border-gray-200 dark:border-slate-700 flex flex-col shadow-xl">
      <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
        <div className="flex-1 mr-4">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{localIsLabel ? 'Etichetta' : (localIsSprint ? 'Sprint Mode' : 'Dettagli Ramo')}</span>
           <input type="text" value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} className="font-bold text-lg bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full text-slate-900 dark:text-white" />
        </div>
        <button onClick={() => selectBranch(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-500"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">
        {isDirty && (
            <div className="sticky top-0 z-40 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 rounded-xl shadow-md">
                <div className="flex-1 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Modifiche non salvate</div>
                <button onClick={handleSaveAll} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm">Salva Ora</button>
            </div>
        )}

        {/* Tipo Ramo (Etichetta / Sprint) */}
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => { setLocalIsLabel(!localIsLabel); if(!localIsLabel) setLocalIsSprint(false); }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-xs font-bold ${localIsLabel ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-white border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                >
                    <Tag className="w-4 h-4" /> Etichetta
                </button>
                <button 
                    onClick={() => { setLocalIsSprint(!localIsSprint); if(!localIsSprint) setLocalIsLabel(false); }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-xs font-bold ${localIsSprint ? 'bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-white border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                >
                    <Zap className="w-4 h-4" /> Sprint
                </button>
            </div>
            
            {localIsSprint && (
                <div className="flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-top-2">
                    <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <div className="flex-1">
                        <label className="text-[10px] font-black uppercase text-indigo-600/60 dark:text-indigo-400/60 block">Prossimo Sprint #</label>
                        <input 
                            type="number" 
                            value={localSprintCounter} 
                            onChange={(e) => setLocalSprintCounter(parseInt(e.target.value) || 1)}
                            className="bg-transparent font-bold text-sm text-indigo-700 dark:text-indigo-300 outline-none w-full"
                        />
                    </div>
                    <div className="text-[9px] text-indigo-400 font-medium max-w-[100px] leading-tight">
                        I figli verranno chiamati "{localTitle} {new Date().getFullYear().toString().slice(-2)}-{String(localSprintCounter).padStart(2, '0')}"
                    </div>
                </div>
            )}
        </div>

        {/* Gerarchia & Link */}
        <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-700 flex items-center justify-between">
                <label className="text-[10px] font-black uppercase flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><GitBranch className="w-3 h-3"/> Gerarchia</label>
                <button onClick={() => { setIsLinkMode(!isLinkMode); setIsMigrateMode(false); }} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                    <LinkIcon className="w-2.5 h-2.5" /> Collega Genitore
                </button>
            </div>
            <div className="p-3 space-y-2">
                {branch.parentIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {branch.parentIds.map(pid => (
                            <div key={pid} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[11px] font-medium group text-slate-700 dark:text-slate-300">
                                <span className="truncate max-w-[120px]">{state.branches[pid]?.title || 'Ramo sconosciuto'}</span>
                                {branch.parentIds.length > 1 && (
                                    <button onClick={() => unlinkBranch(branch.id, pid)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : <p className="text-[11px] text-slate-400 italic">Punto di origine (Root)</p>}

                {isLinkMode && (
                    <div className="mt-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-in fade-in slide-in-from-top-2">
                        <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Cerca ramo..." className="w-full pl-8 pr-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {potentialParents.map(p => (
                                <button key={p.id} onClick={() => handleLinkParent(p.id)} className="w-full text-left p-1.5 text-[11px] hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded flex items-center justify-between group text-slate-700 dark:text-slate-300">
                                    <span className="truncate">{p.title}</span>
                                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Status & Responsabile */}
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Stato</label>
                <select value={localStatus} onChange={(e) => setLocalStatus(e.target.value as BranchStatus)} className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                    {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s as BranchStatus].label}</option>)}
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Responsabile</label>
                <select value={localResponsibleId || ''} onChange={(e) => setLocalResponsibleId(e.target.value || undefined)} className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">
                    <option value="">Eredita...</option>
                    {state.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Inizio</label>
                <DatePicker value={localStartDate} onChange={setLocalStartDate} />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Scadenza</label>
                <DatePicker value={localDueDate} onChange={setLocalDueDate} />
            </div>
        </div>

        {/* Descrizione con Toolbar WYSIWYG */}
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Descrizione</label>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
                <div className="flex items-center gap-0.5 p-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <button onClick={() => handleToolbarAction('bold')} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" title="Grassetto"><Bold className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToolbarAction('italic')} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" title="Corsivo"><Italic className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToolbarAction('link')} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" title="Link"><LinkIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToolbarAction('email')} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" title="Gmail"><Mail className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToolbarAction('list')} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" title="Lista"><List className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToolbarAction('today-date')} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" title="Data"><CalendarDays className="w-3.5 h-3.5" /></button>
                </div>

                {popupMode && (
                    <div className="p-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex gap-2">
                        <input 
                            ref={popupInputRef}
                            type="text"
                            value={popupInput}
                            onChange={(e) => setPopupInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyPopupValue()}
                            placeholder={popupMode === 'link' ? "URL..." : "Oggetto..."}
                            className="flex-1 text-xs p-1.5 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                            autoFocus
                        />
                        <button onClick={applyPopupValue} className="p-1.5 bg-indigo-600 text-white rounded"><Check className="w-3 h-3" /></button>
                    </div>
                )}

                <textarea 
                    ref={descriptionRef}
                    value={localDescription} 
                    onChange={(e) => setLocalDescription(e.target.value)} 
                    className="w-full h-32 p-3 text-sm bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none resize-none" 
                    placeholder="Aggiungi dettagli..." 
                />
            </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5"><LayoutGrid className="w-3 h-3"/> Tasks</label>
                <div className="flex gap-2">
                    {selectedTaskIds.length > 0 && (
                        <button onClick={() => setIsBulkMoveMode(!isBulkMoveMode)} className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                           <Move className="w-2.5 h-2.5" /> Sposta ({selectedTaskIds.length})
                        </button>
                    )}
                    <button onClick={() => setIsBulkMode(!isBulkMode)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{isBulkMode ? 'Vista Lista' : 'Modifica Bulk'}</button>
                </div>
            </div>

            {isBulkMoveMode && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl animate-in zoom-in-95">
                    <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase mb-2">Sposta {selectedTaskIds.length} task in:</p>
                    <div className="flex gap-2">
                        <select value={bulkMoveTargetId} onChange={(e) => setBulkMoveTargetId(e.target.value)} className="flex-1 text-xs p-1.5 rounded border border-amber-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                            <option value="">Seleziona ramo...</option>
                            {Object.values(state.branches).filter(b => b.id !== branch.id).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                        </select>
                        <button onClick={() => { bulkMoveTasks(selectedTaskIds, branch.id, bulkMoveTargetId); setSelectedTaskIds([]); setIsBulkMoveMode(false); }} disabled={!bulkMoveTargetId} className="bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50">Vai</button>
                    </div>
                </div>
            )}

            {isBulkMode ? (
                <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} onBlur={() => bulkUpdateTasks(branch.id, bulkText)} className="w-full h-48 p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200" placeholder="Un task per riga..." />
            ) : (
                <div className="space-y-2">
                    {sortedTasks.map((task, idx) => {
                        const taskAssignee = task.assigneeId ? state.people.find(p => p.id === task.assigneeId) : null;
                        const canMoveUp = idx > 0 && sortedTasks[idx - 1].completed === task.completed;
                        const canMoveDown = idx < sortedTasks.length - 1 && sortedTasks[idx + 1].completed === task.completed;

                        return (
                            <div key={task.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl group hover:border-indigo-300 transition-colors">
                                <button onClick={() => updateTask(branch.id, task.id, { completed: !task.completed })} className={task.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-500 hover:text-indigo-500'}>{task.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}</button>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span onClick={() => setEditingTask({ branchId: branch.id, taskId: task.id })} className={`text-sm cursor-pointer truncate ${task.completed ? 'line-through text-slate-400' : 'font-medium text-slate-700 dark:text-slate-200'}`}>{task.title}</span>
                                    {taskAssignee && (
                                        <div className="shrink-0" title={`Assegnato a ${taskAssignee.name}`}>
                                            <Avatar person={taskAssignee} size="sm" className="w-5 h-5 text-[8px]" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!task.completed && (
                                        <div className="flex flex-col mr-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveTask(branch.id, task.id, 'up'); }}
                                                disabled={!canMoveUp}
                                                className={`p-0.5 ${canMoveUp ? 'text-indigo-400 hover:text-indigo-600' : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'}`}
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveTask(branch.id, task.id, 'down'); }}
                                                disabled={!canMoveDown}
                                                className={`p-0.5 ${canMoveDown ? 'text-indigo-400 hover:text-indigo-600' : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'}`}
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <input 
                                        type="checkbox" 
                                        checked={selectedTaskIds.includes(task.id)} 
                                        onChange={(e) => e.target.checked ? setSelectedTaskIds([...selectedTaskIds, task.id]) : setSelectedTaskIds(selectedTaskIds.filter(id => id !== task.id))} 
                                        className="w-4 h-4 rounded border-amber-300 bg-amber-50 dark:bg-slate-700 text-amber-600 focus:ring-amber-500 mr-2 cursor-pointer shadow-sm" 
                                    />
                                    <button onClick={() => deleteTask(branch.id, task.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        );
                    })}
                    <form onSubmit={(e) => { e.preventDefault(); if(newTaskTitle.trim()){ addTask(branch.id, newTaskTitle); setNewTaskTitle(''); } }} className="flex gap-2">
                        <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Aggiungi task..." className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95"><Plus className="w-5 h-5"/></button>
                    </form>
                </div>
            )}
        </div>

        {/* Cloud Migration */}
        {session && !isOfflineMode && (
            <div className="pt-6 mt-6 border-t dark:border-slate-700">
                <button onClick={() => { setIsMigrateMode(!isMigrateMode); setIsLinkMode(false); if(!isMigrateMode) fetchRemoteData(); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-black uppercase tracking-wider border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors">
                    <Globe className="w-4 h-4" /> Sposta in Progetto Remoto
                </button>
                
                {isMigrateMode && (
                    <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-500 shadow-lg space-y-4 animate-in slide-in-from-bottom-4">
                        {isLoadingRemote ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">1. Scegli Progetto</label>
                                    <select value={selectedRemoteProj} onChange={(e) => setSelectedRemoteProj(e.target.value)} className="w-full p-2 text-xs rounded border border-slate-200 dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                        <option value="">Seleziona...</option>
                                        {remoteProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                {selectedRemoteProj && (
                                    <div className="space-y-2 animate-in fade-in">
                                        <label className="text-[10px] font-black uppercase text-slate-400">2. Scegli Genitore</label>
                                        <select value={selectedRemoteParent} onChange={(e) => setSelectedRemoteParent(e.target.value)} className="w-full p-2 text-xs rounded border border-slate-200 dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                            <option value="">Seleziona...</option>
                                            {remoteBranches.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                        </select>
                                    </div>
                                )}
                                <button onClick={handleMigrateToRemote} disabled={!selectedRemoteParent || isLoadingRemote} className="w-full py-2 bg-amber-600 text-white rounded font-bold text-xs disabled:opacity-50">Conferma Migrazione Cloud</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* Footer Actions */}
        <div className="pt-6 mt-6 border-t dark:border-slate-700 space-y-3">
            <button onClick={() => toggleBranchArchive(branch.id)} className="flex items-center justify-center gap-2 w-full px-4 py-3 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest">
                {branch.archived ? <RefreshCw className="w-4 h-4"/> : <Archive className="w-4 h-4"/>}
                {branch.archived ? 'Ripristina Ramo' : 'Archivia Ramo'}
            </button>
            
            {showDeleteConfirm ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900 rounded-xl animate-in shake duration-300">
                    <p className="text-[11px] text-red-700 dark:text-red-400 font-bold text-center mb-3">Eliminare definitivamente?</p>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 text-xs font-bold bg-white dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 border dark:border-slate-600">Annulla</button>
                        <button onClick={() => { deleteBranch(branch.id); selectBranch(null); }} className="flex-1 py-2 text-xs font-bold bg-red-600 text-white rounded-lg">Sì, Elimina</button>
                    </div>
                </div>
            ) : branch.id !== state.rootBranchId && (
                <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors uppercase tracking-widest">Elimina Ramo</button>
            )}
        </div>
      </div>
    </div>
  );
};

export default BranchDetails;
