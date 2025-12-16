import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BranchStatus, Branch } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { X, Save, Trash2, CheckSquare, Square, ArrowUpLeft, Calendar, Plus, Link as LinkIcon, Unlink, PlayCircle, StopCircle, Clock, AlertTriangle, Archive, RefreshCw, Bold, Italic, List, Eye, Edit2, FileText, ChevronUp, ChevronDown, DownloadCloud, Loader2, GitMerge, ArrowRight, UploadCloud, Tag, Mail, Check, AlignLeft } from 'lucide-react';
import Avatar from '../ui/Avatar';

const BranchDetails: React.FC = () => {
  const { state, selectedBranchId, selectBranch, updateBranch, deleteBranch, linkBranch, unlinkBranch, addTask, updateTask, deleteTask, moveTask, bulkUpdateTasks, toggleBranchArchive, listProjectsFromSupabase, getProjectBranchesFromSupabase, moveLocalBranchToRemoteProject, session, showNotification, setEditingTask, setReadingTask } = useProject();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [parentToAdd, setParentToAdd] = useState('');
  
  // Move Mode State (Push to Remote)
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [selectedRemoteProj, setSelectedRemoteProj] = useState('');
  const [remoteBranches, setRemoteBranches] = useState<Branch[]>([]);
  const [selectedRemoteParent, setSelectedRemoteParent] = useState('');
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  // Description State
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Editor Popup State
  const [popupMode, setPopupMode] = useState<'link' | 'email' | null>(null);
  const [popupInput, setPopupInput] = useState('');
  const popupInputRef = useRef<HTMLInputElement>(null);

  const branch = selectedBranchId ? state.branches[selectedBranchId] : null;

  useEffect(() => {
    if (branch) {
      setBulkText(branch.tasks.map(t => t.title).join('\n'));
      setShowDeleteConfirm(false);
      setParentToAdd('');
      // Reset formatting mode on branch switch
      setIsPreviewMode(false); 
      setIsMoveMode(false);
      setSelectedRemoteProj('');
      setSelectedRemoteParent('');
      setPopupMode(null);
      setPopupInput('');
    }
  }, [branch?.tasks, branch?.id]); 

  useEffect(() => {
      if(branch) {
          setIsBulkMode(false);
          setNewTaskTitle('');
      }
  }, [branch?.id]);

  useEffect(() => {
      if (popupMode && popupInputRef.current) {
          popupInputRef.current.focus();
      }
  }, [popupMode]);

  // Load remote projects when move mode is toggled
  useEffect(() => {
      if (isMoveMode && session && remoteProjects.length === 0) {
          setIsLoadingRemote(true);
          listProjectsFromSupabase()
            .then(projs => setRemoteProjects(projs.filter(p => p.id !== state.id)))
            .catch(err => console.error(err))
            .finally(() => setIsLoadingRemote(false));
      }
  }, [isMoveMode, session]);

  // Load branches when remote project is selected
  useEffect(() => {
      if (selectedRemoteProj) {
          setIsLoadingRemote(true);
          getProjectBranchesFromSupabase(selectedRemoteProj)
            .then(branches => setRemoteBranches(branches))
            .catch(err => console.error(err))
            .finally(() => setIsLoadingRemote(false));
      } else {
          setRemoteBranches([]);
      }
  }, [selectedRemoteProj]);

  if (!branch) return null;

  const statusConfig = STATUS_CONFIG[branch.status];

  // Helper to check ancestry to prevent dropdown pollution
  const isAncestor = (childId: string, potentialAncestorId: string): boolean => {
     if (childId === potentialAncestorId) return true;
     const child = state.branches[childId];
     if (!child) return false;
     for (const pid of child.parentIds) {
         if (pid === potentialAncestorId) return true;
         if (isAncestor(pid, potentialAncestorId)) return true;
     }
     return false;
  };

  const eligibleParents = (Object.values(state.branches) as Branch[]).filter(b => 
      b.id !== branch.id && 
      !branch.parentIds.includes(b.id) && 
      !isAncestor(b.id, branch.id) 
  );

  const handleBulkSave = () => {
    bulkUpdateTasks(branch.id, bulkText);
    setIsBulkMode(false);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    addTask(branch.id, newTaskTitle);
    setNewTaskTitle('');
  };

  const handleAddParent = () => {
      if (isMoveMode) {
          if (selectedRemoteProj && selectedRemoteParent) {
              if (branch.id === state.rootBranchId) {
                  showNotification("Non puoi spostare il ramo principale del progetto.", 'error');
                  return;
              }
              if (!confirm("ATTENZIONE: Stai per SPOSTARE questo ramo (e i suoi figli) in un altro progetto. Verrà RIMOSSO da questo progetto. Continuare?")) {
                  return;
              }

              setIsLoadingRemote(true);
              // Push logic: Move THIS branch TO the selected remote parent
              moveLocalBranchToRemoteProject(branch.id, selectedRemoteProj, selectedRemoteParent)
                .then(() => {
                    setIsMoveMode(false);
                    setSelectedRemoteProj('');
                    setSelectedRemoteParent('');
                    showNotification("Ramo spostato con successo!", 'success');
                    selectBranch(null); // Deselect since it's gone
                })
                .catch(err => showNotification("Errore nello spostamento: " + err.message, 'error'))
                .finally(() => setIsLoadingRemote(false));
          }
      } else {
          if (parentToAdd) {
              linkBranch(branch.id, parentToAdd);
              setParentToAdd('');
          }
      }
  };

  // --- Markdown Logic ---
  const insertFormat = (prefix: string, suffix: string, selectionOverride?: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = branch.description || '';
    
    const before = text.substring(0, start);
    const selection = selectionOverride !== undefined ? selectionOverride : text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    updateBranch(branch.id, { description: newText });

    // Restore focus and cursor
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            if (selectionOverride !== undefined && prefix === '[' && suffix.includes('](')) {
                // Special case for Links: Select the description part
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
      }
  };

  const applyPopupValue = () => {
      if (popupMode === 'link') {
          // Standard Link: [link description](URL)
          const url = popupInput.trim() || 'url';
          // Using insertFormat with special suffix to enable auto-selection of "link description"
          // We pass "link description" as the selection to be wrapped
          insertFormat('[', `](${url})`, 'link');
      } else if (popupMode === 'email') {
          // Email Link: [📨 Subject](https://mail.google.com/...)
          const subject = popupInput.trim() || 'Oggetto';
          const encodedSubject = encodeURIComponent(subject);
          const mailUrl = `https://mail.google.com/mail/u/0/#search/subject%3A%22${encodedSubject}%22`;
          insertFormat(`[📨 ${subject}](${mailUrl})`, '', '');
      }
      setPopupMode(null);
      setPopupInput('');
  };

  const renderMarkdown = (text: string) => {
      if (!text) return <p className="text-gray-400 italic text-sm">Nessuna descrizione.</p>;
      
      // Simple regex-based parser
      let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic sanitize
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">$1<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>') // Link
        .replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>') // List items
        .replace(/\n/g, '<br />'); // Line breaks

      return <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-96 bg-white dark:bg-slate-900 md:border-l border-gray-200 dark:border-slate-700 flex flex-col shadow-xl">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
        <div className="flex-1 mr-4">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
               {branch.isLabel ? 'Etichetta' : 'Dettagli Ramo'}
               {branch.archived && <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded text-[10px]">Archiviato</span>}
           </span>
           <div className="flex items-center gap-2 mt-1">
             <input 
                type="text" 
                value={branch.title}
                onChange={(e) => updateBranch(branch.id, { title: e.target.value })}
                className="font-bold text-lg bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-slate-800 dark:text-white w-full"
             />
           </div>
        </div>
        <button onClick={() => selectBranch(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-300 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
        
        {/* Multi-parent Warning */}
        {branch.parentIds.length > 1 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-2">
                <GitMerge className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Ramo Condiviso</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Questo ramo ha {branch.parentIds.length} genitori. Apparirà in più punti del grafico. Le modifiche qui si rifletteranno ovunque.
                    </p>
                </div>
            </div>
        )}

        {/* Type Toggle: Branch / Label */}
        {/* Allow toggling even for root to manually migrate */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-500" />
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo: {branch.isLabel ? 'Etichetta' : 'Ramo Standard'}</span>
                    <span className="text-[10px] text-slate-400">{branch.isLabel ? 'Visualizzazione compatta, senza stato/task.' : 'Visualizzazione completa con task.'}</span>
                </div>
            </div>
            <button 
                onClick={() => updateBranch(branch.id, { isLabel: !branch.isLabel })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${branch.isLabel ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800' : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}
            >
                {branch.isLabel ? 'Converti in Ramo' : 'Converti in Etichetta'}
            </button>
        </div>

        {/* Description Section with Markdown Editor */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                 <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Descrizione
                 </label>
                 <button 
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                    title={isPreviewMode ? "Modifica" : "Anteprima"}
                 >
                    {isPreviewMode ? <Edit2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                 </button>
            </div>

            {isPreviewMode ? (
                <div className="min-h-[100px] p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    {renderMarkdown(branch.description || '')}
                </div>
            ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden transition-all focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 relative">
                    {/* WYSIWYG Toolbar */}
                    <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleToolbarAction('bold')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Grassetto">
                            <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToolbarAction('italic')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Corsivo">
                            <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToolbarAction('link')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Inserisci Link (URL)">
                            <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToolbarAction('email')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Link a Gmail Search">
                            <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToolbarAction('list')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Lista">
                            <List className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Editor Popup (Absolute over textarea) */}
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
                                placeholder={popupMode === 'link' ? "Inserisci URL (es. https://...)" : "Inserisci Oggetto Mail..."}
                                className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button onClick={applyPopupValue} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setPopupMode(null); setPopupInput(''); }} className="p-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <textarea 
                        ref={textareaRef}
                        value={branch.description || ''}
                        onChange={(e) => updateBranch(branch.id, { description: e.target.value })}
                        className="w-full h-28 p-3 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none resize-y"
                        placeholder="Aggiungi una descrizione (Markdown supportato)..."
                    />
                </div>
            )}
        </div>

        {/* Tasks Section (HIDDEN FOR LABELS) */}
        {!branch.isLabel && (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tasks</label>
                    <button 
                        onClick={() => setIsBulkMode(!isBulkMode)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                        {isBulkMode ? 'Lista Singola' : 'Modifica Bulk'}
                    </button>
                </div>

                {isBulkMode ? (
                    <div className="space-y-2">
                        <textarea 
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            className="w-full h-64 p-3 text-sm border rounded-md font-mono bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                            placeholder="Inserisci un task per riga..."
                        />
                        <button 
                            onClick={handleBulkSave}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <Save className="w-4 h-4" />
                            Salva Bulk
                        </button>
                        <p className="text-[10px] text-gray-400 text-center">Ogni riga diventerà un task separato. I nomi esistenti verranno mantenuti.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Add Task Input */}
                        <form onSubmit={handleAddTask} className="flex gap-2">
                            <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Aggiungi task veloce..."
                                className="flex-1 text-sm border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </form>

                        {/* Task List */}
                        <ul className="space-y-2">
                            {branch.tasks.length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">Nessun task.</p>}
                            {branch.tasks.map((task, index) => (
                                <li key={task.id} className="group bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-md p-2 hover:shadow-sm transition-all relative">
                                    <div className="flex items-start gap-2">
                                        <button 
                                            onClick={() => updateTask(branch.id, task.id, { completed: !task.completed })}
                                            className={`mt-0.5 ${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-slate-500 hover:text-indigo-500'}`}
                                        >
                                            {task.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                        </button>
                                        
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <p 
                                                    className={`text-sm cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${task.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                                                    onClick={() => setEditingTask({ branchId: branch.id, taskId: task.id })}
                                                    title="Clicca per modificare"
                                                >
                                                    {task.title}
                                                </p>
                                                {/* Description Icon Indicator */}
                                                {task.description && task.description.trim() !== '' && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReadingTask({ branchId: branch.id, taskId: task.id });
                                                        }}
                                                        className="text-slate-400 hover:text-indigo-500 transition-colors p-0.5 rounded"
                                                        title="Leggi descrizione"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setEditingTask({ branchId: branch.id, taskId: task.id })}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-500 rounded transition-opacity"
                                                    title="Modifica Task"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* Assignee Selector */}
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        value={task.assigneeId || ''}
                                                        onChange={(e) => updateTask(branch.id, task.id, { assigneeId: e.target.value || undefined })}
                                                        className="text-[10px] bg-gray-50 dark:bg-slate-700 border-none rounded py-0.5 px-1.5 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-0 max-w-[100px]"
                                                    >
                                                        <option value="">Chiunque</option>
                                                        {state.people.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                    {task.assigneeId && (
                                                        <Avatar person={state.people.find(p => p.id === task.assigneeId)!} size="sm" />
                                                    )}
                                                </div>

                                                {/* Task Due Date Picker (Using the Invisible Overlay pattern) */}
                                                <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-700 rounded px-1.5 py-0.5 relative group/date">
                                                    <span className="text-[10px] text-gray-600 dark:text-gray-300 min-w-[3rem]">
                                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'}) : 'No date'}
                                                    </span>
                                                    <Calendar className={`w-3 h-3 ${task.dueDate ? 'text-indigo-500' : 'text-gray-400'}`} />
                                                    <input 
                                                        type="date" 
                                                        value={task.dueDate || ''}
                                                        onChange={(e) => updateTask(branch.id, task.id, { dueDate: e.target.value })}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        title="Imposta scadenza task"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons (Right side) */}
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {index > 0 && (
                                                <button 
                                                    onClick={() => moveTask(branch.id, task.id, 'up')}
                                                    className="text-slate-300 hover:text-indigo-500"
                                                    title="Sposta su"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {index < branch.tasks.length - 1 && (
                                                <button 
                                                    onClick={() => moveTask(branch.id, task.id, 'down')}
                                                    className="text-slate-300 hover:text-indigo-500"
                                                    title="Sposta giù"
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => deleteTask(branch.id, task.id)}
                                                className="text-slate-300 hover:text-red-500"
                                                title="Elimina"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}

        {/* Dates Section - HIDDEN FOR LABELS */}
        {!branch.isLabel && (
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timeline</h4>
                
                {/* Start Date */}
                <div>
                    <label className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" />
                        Data Inizio
                    </label>
                    <div className="relative group">
                        <input 
                            type="date"
                            value={branch.startDate || ''}
                            onChange={(e) => updateBranch(branch.id, { startDate: e.target.value })}
                            className="w-full text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-1.5 pr-14 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {branch.startDate && (
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateBranch(branch.id, { startDate: '' });
                                    }}
                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                    title="Rimuovi data"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                            <div className="relative p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <Calendar className="w-3.5 h-3.5" />
                                <input 
                                    type="date"
                                    value={branch.startDate || ''}
                                    onChange={(e) => updateBranch(branch.id, { startDate: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    title="Seleziona data"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Due Date */}
                <div>
                     <label className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         Scadenza (Deadline)
                     </label>
                     <div className="relative group">
                        <input 
                            type="date"
                            value={branch.dueDate || ''}
                            onChange={(e) => updateBranch(branch.id, { dueDate: e.target.value })}
                            className="w-full text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-1.5 pr-14 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                         <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {branch.dueDate && (
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateBranch(branch.id, { dueDate: '' });
                                    }}
                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                    title="Rimuovi data"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                            <div className="relative p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <Calendar className="w-3.5 h-3.5" />
                                <input 
                                    type="date"
                                    value={branch.dueDate || ''}
                                    onChange={(e) => updateBranch(branch.id, { dueDate: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    title="Seleziona data"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* End Date */}
                <div>
                    <label className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
                        <StopCircle className="w-3 h-3" />
                        Data Chiusura
                    </label>
                    <div className="relative group">
                        <input 
                            type="date"
                            value={branch.endDate || ''}
                            onChange={(e) => updateBranch(branch.id, { endDate: e.target.value })}
                            className="w-full text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-1.5 pr-14 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                         <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {branch.endDate && (
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateBranch(branch.id, { endDate: '' });
                                    }}
                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                    title="Rimuovi data"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                             <div className="relative p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <Calendar className="w-3.5 h-3.5" />
                                <input 
                                    type="date"
                                    value={branch.endDate || ''}
                                    onChange={(e) => updateBranch(branch.id, { endDate: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    title="Seleziona data"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Status Selector - HIDDEN FOR LABELS */}
        {!branch.isLabel && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">Stato</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(BranchStatus).map((statusKey) => {
                  const status = statusKey as BranchStatus;
                  const config = STATUS_CONFIG[status];
                  const isActive = branch.status === status;
                  return (
                    <button
                      key={status}
                      onClick={() => updateBranch(branch.id, { status })}
                      className={`
                        flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-all
                        ${isActive 
                          ? `${config.color} border-current ring-1 ring-current` 
                          : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}
                      `}
                    >
                      {config.icon}
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
        )}

        {/* Parent Branches (Multiple) */}
        {branch.id !== state.rootBranchId && (
            <div>
                 <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <ArrowUpLeft className="w-3 h-3" />
                    Collegato a (Genitori)
                 </label>
                 
                 <ul className="space-y-2 mb-3">
                     {branch.parentIds.map(pid => {
                         const parent = state.branches[pid];
                         if (!parent) return null;
                         return (
                             <li key={pid} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 p-2 rounded text-sm border border-gray-100 dark:border-slate-700">
                                 <div className="flex items-center gap-2">
                                     <LinkIcon className="w-3 h-3 text-indigo-400" />
                                     <span className="text-slate-700 dark:text-slate-300">{parent.title}</span>
                                 </div>
                                 <button 
                                    onClick={() => unlinkBranch(branch.id, pid)}
                                    className="text-gray-400 hover:text-red-500"
                                    title="Scollega"
                                 >
                                     <Unlink className="w-4 h-4" />
                                 </button>
                             </li>
                         );
                     })}
                 </ul>

                 <div className="bg-gray-50 dark:bg-slate-800/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                     <div className="flex gap-2 text-[10px] font-medium text-slate-500 mb-2">
                         <button 
                            className={`flex-1 py-1 rounded ${!isMoveMode ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            onClick={() => setIsMoveMode(false)}
                         >
                             Progetto Corrente
                         </button>
                         <button 
                            className={`flex-1 py-1 rounded flex items-center justify-center gap-1 ${isMoveMode ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            onClick={() => {
                                if(!session) {
                                    showNotification("Devi essere connesso per gestire progetti esterni.", 'error');
                                    return;
                                }
                                setIsMoveMode(true);
                            }}
                         >
                             <UploadCloud className="w-3 h-3" />
                             Sposta in Altro
                         </button>
                     </div>

                     <div className="flex gap-2">
                        {isMoveMode ? (
                            <div className="flex-1 space-y-2">
                                <select
                                    value={selectedRemoteProj}
                                    onChange={(e) => {
                                        setSelectedRemoteProj(e.target.value);
                                        setSelectedRemoteParent('');
                                    }}
                                    className="w-full text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md p-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Seleziona Progetto Target...</option>
                                    {remoteProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                
                                {selectedRemoteProj && (
                                     <select
                                        value={selectedRemoteParent}
                                        onChange={(e) => setSelectedRemoteParent(e.target.value)}
                                        className="w-full text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md p-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">Seleziona Ramo Padre...</option>
                                        {remoteBranches.map(b => (
                                            <option key={b.id} value={b.id}>{b.title}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ) : (
                            <select
                                value={parentToAdd}
                                onChange={(e) => setParentToAdd(e.target.value)}
                                className="flex-1 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md p-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Aggiungi genitore...</option>
                                {eligibleParents.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                        )}
                        
                        <button 
                            onClick={handleAddParent}
                            disabled={isLoadingRemote || (isMoveMode ? (!selectedRemoteParent) : (!parentToAdd))}
                            className={`p-2 bg-indigo-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 flex items-center justify-center w-10 shrink-0 self-start ${isMoveMode ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                            title={isMoveMode ? "Sposta Qui" : "Collega"}
                        >
                            {isLoadingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : isMoveMode ? <ArrowRight className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                     </div>
                     {isMoveMode && selectedRemoteParent && (
                         <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-100 dark:border-amber-800">
                             <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                                 <AlertTriangle className="w-3 h-3" /> Attenzione: Azione Distruttiva
                             </p>
                             <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 leading-tight">
                                 Questo ramo verrà <strong>rimosso</strong> dal progetto attuale e spostato nel progetto selezionato.
                             </p>
                         </div>
                     )}
                 </div>
            </div>
        )}
        
        {/* Actions Footer: Archive and Delete */}
        {branch.id !== state.rootBranchId && (
             <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-700 pb-4 space-y-3">
                <button 
                    onClick={() => toggleBranchArchive(branch.id)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                    {branch.archived ? (
                         <>
                            <RefreshCw className="w-4 h-4" />
                            Ripristina Ramo
                         </>
                    ) : (
                         <>
                            <Archive className="w-4 h-4" />
                            Archivia Ramo
                         </>
                    )}
                </button>

                <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    Elimina Ramo definitivamente
                </button>
             </div>
        )}

      </div>

      {/* Delete Confirmation Modal Overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-sm transform scale-100 transition-transform">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Eliminare il ramo?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Questa azione è irreversibile. Il ramo e tutti i suoi task verranno rimossi.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2 text-sm font-medium bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Annulla
                        </button>
                        <button 
                            onClick={() => deleteBranch(branch.id)}
                            className="flex-1 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Elimina
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default BranchDetails;
