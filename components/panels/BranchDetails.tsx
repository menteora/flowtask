
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BranchStatus, Branch } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { X, Save, Trash2, CheckSquare, Square, ArrowUpLeft, Calendar, Plus, Link as LinkIcon, Unlink, PlayCircle, StopCircle, Clock, AlertCircle, Archive, RefreshCw, Bold, Italic, List, Eye, Edit2, FileText, ChevronUp, ChevronDown, DownloadCloud, Loader2, GitMerge, ArrowRight, UploadCloud, Tag, Mail, Check, AlignLeft, Pin, Move, CalendarDays, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import Avatar from '../ui/Avatar';
import DatePicker from '../ui/DatePicker';

const BranchDetails: React.FC = () => {
  const { state, selectedBranchId, selectBranch, updateBranch, deleteBranch, linkBranch, unlinkBranch, addTask, updateTask, deleteTask, moveTask, bulkUpdateTasks, bulkMoveTasks, toggleBranchArchive, listProjectsFromSupabase, getProjectBranchesFromSupabase, moveLocalBranchToRemoteProject, session, showNotification, setEditingTask, setReadingTask, showOnlyOpen } = useProject();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [parentToAdd, setParentToAdd] = useState('');
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkMoveMode, setIsBulkMoveMode] = useState(false);
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState('');

  const [isMoveMode, setIsMoveMode] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [selectedRemoteProj, setSelectedRemoteProj] = useState('');
  const [remoteBranches, setRemoteBranches] = useState<Branch[]>([]);
  const [selectedRemoteParent, setSelectedRemoteParent] = useState('');
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [popupMode, setPopupMode] = useState<'link' | 'email' | null>(null);
  const [popupInput, setPopupInput] = useState('');
  const popupInputRef = useRef<HTMLInputElement>(null);

  const branch = selectedBranchId ? state.branches[selectedBranchId] : null;

  useEffect(() => {
    if (branch) {
      setBulkText(branch.tasks.map(t => t.title).join('\n'));
      setShowDeleteConfirm(false);
      setParentToAdd('');
      setIsPreviewMode(false); 
      setIsMoveMode(false);
      setSelectedRemoteProj('');
      setSelectedRemoteParent('');
      setPopupMode(null);
      setPopupInput('');
      setSelectedTaskIds([]);
      setIsBulkMoveMode(false);
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

  const sortedTasks = useMemo(() => {
    if (!branch) return [];
    let list = [...branch.tasks];
    if (showOnlyOpen) {
        list = list.filter(t => !t.completed);
    }
    return list.sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });
  }, [branch?.tasks, showOnlyOpen]);

  useEffect(() => {
      if (isMoveMode && session && remoteProjects.length === 0) {
          setIsLoadingRemote(true);
          listProjectsFromSupabase()
            .then(projs => setRemoteProjects(projs.filter(p => p.id !== state.id)))
            .catch(err => console.error(err))
            .finally(() => setIsLoadingRemote(false));
      }
  }, [isMoveMode, session]);

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

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    addTask(branch.id, newTaskTitle);
    setNewTaskTitle('');
  };

  const toggleTaskSelection = (taskId: string) => {
      setSelectedTaskIds(prev => 
          prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      );
  };

  const handleBulkMove = () => {
      if (!bulkMoveTargetId || selectedTaskIds.length === 0) return;
      bulkMoveTasks(selectedTaskIds, branch.id, bulkMoveTargetId);
      setSelectedTaskIds([]);
      setIsBulkMoveMode(false);
      setBulkMoveTargetId('');
      showNotification(`${selectedTaskIds.length} task spostati con successo!`, 'success');
  };

  const handleBulkSave = () => {
    bulkUpdateTasks(branch.id, bulkText);
    setIsBulkMode(false);
  };

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
      if (action === 'link') { setPopupMode('link'); setPopupInput(''); }
      else if (action === 'email') { setPopupMode('email'); setPopupInput(''); }
      else if (action === 'bold') insertFormat('**', '**');
      else if (action === 'italic') insertFormat('*', '*');
      else if (action === 'list') insertFormat('\n- ', '');
      else if (action === 'today-date') {
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

  const renderMarkdown = (text: string) => {
      if (!text) return <p className="text-gray-400 italic text-sm">Nessuna descrizione.</p>;
      let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">$1</a>')
        .replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/\n/g, '<br />');
      return <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handleBranchMoveToProject = async () => {
      if (!selectedRemoteProj || !selectedRemoteParent) return;
      if (!confirm(`Sei sicuro di voler spostare il ramo "${branch.title}" e TUTTA la sua gerarchia nel progetto selezionato?`)) return;
      
      try {
          await moveLocalBranchToRemoteProject(branch.id, selectedRemoteProj, selectedRemoteParent);
          setIsMoveMode(false);
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-96 bg-white dark:bg-slate-900 md:border-l border-gray-200 dark:border-slate-700 flex flex-col shadow-xl">
      <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
        <div className="flex-1 mr-4">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
               {branch.isLabel ? 'Etichetta' : 'Dettagli Ramo'}
               {branch.archived && <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded text-[10px]">Archiviato</span>}
           </span>
           <div className="flex items-center gap-2 mt-1">
             <input type="text" value={branch.title} onChange={(e) => updateBranch(branch.id, { title: e.target.value })} className="font-bold text-lg bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-slate-800 dark:text-white w-full" />
           </div>
        </div>
        <button onClick={() => selectBranch(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-300 transition-colors"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
        {/* Gestione Gerarchia (Spostamento Ramo) */}
        {branch.id !== state.rootBranchId && (
            <div className="space-y-3 bg-indigo-50/30 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                        <ArrowUpLeft className="w-3.5 h-3.5" /> 
                        Gerarchia & Collegamenti
                    </label>
                    <button 
                        onClick={() => setIsMoveMode(!isMoveMode)}
                        className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${isMoveMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        {isMoveMode ? 'Esci da Sposta' : 'Sposta Progetto'}
                    </button>
                </div>
                
                {isMoveMode ? (
                    <div className="space-y-3 p-2 bg-white dark:bg-slate-800 rounded border border-indigo-200 dark:border-indigo-800 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Sposta in un altro progetto</p>
                        <select 
                            value={selectedRemoteProj}
                            onChange={(e) => setSelectedRemoteProj(e.target.value)}
                            className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                            disabled={isLoadingRemote}
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
                                className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                disabled={isLoadingRemote}
                            >
                                <option value="">Sotto quale ramo?</option>
                                {remoteBranches.map(b => (
                                    <option key={b.id} value={b.id}>{b.title}</option>
                                ))}
                            </select>
                        )}

                        {isLoadingRemote ? (
                            <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /></div>
                        ) : (
                            <button 
                                onClick={handleBranchMoveToProject}
                                disabled={!selectedRemoteProj || !selectedRemoteParent}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
                            >
                                Esegui Spostamento
                            </button>
                        )}
                        <p className="text-[9px] text-slate-400 italic leading-tight">Nota: Lo spostamento trasferirà questo ramo e tutti i suoi discendenti (figli e task).</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Genitori attuali (da dove arriva il ramo):</p>
                            <div className="flex flex-wrap gap-2">
                                {branch.parentIds.map(pid => {
                                    const pBranch = state.branches[pid];
                                    return (
                                        <div key={pid} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                                                {pBranch?.title || 'Radice'}
                                            </span>
                                            {branch.parentIds.length > 1 && (
                                                <button 
                                                    onClick={() => unlinkBranch(branch.id, pid)}
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                    title="Scollega"
                                                >
                                                    <Unlink className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-2">
                            <div className="flex gap-2">
                                <select 
                                    value={parentToAdd}
                                    onChange={(e) => setParentToAdd(e.target.value)}
                                    className="flex-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Aggiungi Genitore...</option>
                                    {(Object.values(state.branches) as Branch[])
                                        .filter(b => b.id !== branch.id && !branch.parentIds.includes(b.id) && !b.childrenIds.includes(branch.id))
                                        .map(b => (
                                            <option key={b.id} value={b.id}>{b.title}</option>
                                        ))
                                    }
                                </select>
                                <button 
                                    onClick={() => {
                                        if (parentToAdd) {
                                            linkBranch(branch.id, parentToAdd);
                                            setParentToAdd('');
                                        }
                                    }}
                                    disabled={!parentToAdd}
                                    className="bg-indigo-600 text-white p-1.5 rounded disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                                    title="Collega ramo"
                                >
                                    <LinkIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1.5 italic">
                                Il ramo apparirà sotto ogni genitore collegato (Multi-Parent).
                            </p>
                        </div>
                    </>
                )}
            </div>
        )}

        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo: {branch.isLabel ? 'Etichetta' : 'Ramo'}</span>
            </div>
            <button onClick={() => updateBranch(branch.id, { isLabel: !branch.isLabel })} className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${branch.isLabel ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800' : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}>
                {branch.isLabel ? 'Converti in Ramo' : 'Converti in Etichetta'}
            </button>
        </div>

        <div className="space-y-2">
            <div className="flex items-center justify-between">
                 <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Descrizione</label>
                 <button onClick={() => setIsPreviewMode(!isPreviewMode)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">{isPreviewMode ? <Edit2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
            </div>
            {isPreviewMode ? <div className="min-h-[100px] p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">{renderMarkdown(branch.description || '')}</div> : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden relative focus-within:ring-2 focus-within:ring-indigo-500/50">
                    <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleToolbarAction('bold')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Bold className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('italic')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Italic className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('link')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><LinkIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('email')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Mail className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('list')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><List className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToolbarAction('today-date')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><CalendarDays className="w-3.5 h-3.5" /></button>
                    </div>
                    {popupMode && (
                        <div className="absolute top-[40px] left-2 right-2 z-10 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-lg rounded-lg p-2 flex gap-2">
                            <input ref={popupInputRef} type="text" value={popupInput} onChange={(e) => setPopupInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') applyPopupValue(); if(e.key === 'Escape') { setPopupMode(null); setPopupInput(''); } }} placeholder={popupMode === 'link' ? "URL..." : "Oggetto..."} className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            <button onClick={applyPopupValue} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check className="w-4 h-4" /></button>
                        </div>
                    )}
                    <textarea ref={textareaRef} value={branch.description || ''} onChange={(e) => updateBranch(branch.id, { description: e.target.value })} className="w-full h-28 p-3 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none resize-y" placeholder="Descrizione..." />
                </div>
            )}
        </div>

        {!branch.isLabel && (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Tasks {sortedTasks.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">{sortedTasks.length}</span>}</label>
                    <div className="flex items-center gap-3">
                        {sortedTasks.length > 0 && (
                            <button onClick={() => setIsBulkMoveMode(!isBulkMoveMode)} className={`text-xs flex items-center gap-1 transition-colors ${isBulkMoveMode ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-indigo-600'}`}><Move className="w-3 h-3" />{isBulkMoveMode ? 'Annulla' : 'Sposta Bulk'}</button>
                        )}
                        <button onClick={() => setIsBulkMode(!isBulkMode)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{isBulkMode ? 'Lista Singola' : 'Bulk Edit'}</button>
                    </div>
                </div>

                {isBulkMode ? (
                    <div className="space-y-2">
                        <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} className="w-full h-64 p-3 text-sm border rounded-md font-mono bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" placeholder="Un task per riga..." />
                        <button onClick={handleBulkSave} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center justify-center gap-2 text-sm font-medium"><Save className="w-4 h-4" /> Salva Bulk</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isBulkMoveMode && selectedTaskIds.length > 0 && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg animate-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{selectedTaskIds.length} task selezionati</span></div>
                                <div className="flex gap-2">
                                    <select value={bulkMoveTargetId} onChange={(e) => setBulkMoveTargetId(e.target.value)} className="flex-1 text-xs bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Sposta in...</option>{(Object.values(state.branches) as Branch[]).filter(b => b.id !== branch.id).map(b => (<option key={b.id} value={b.id}>{b.title}</option>))}</select>
                                    <button onClick={handleBulkMove} disabled={!bulkMoveTargetId} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-bold disabled:opacity-50">Vai</button>
                                </div>
                            </div>
                        )}
                        <form onSubmit={handleAddTask} className="flex gap-2"><input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Aggiungi task..." className="flex-1 text-sm border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></form>
                        <ul className="space-y-2">
                            {sortedTasks.map((task) => {
                                const assignee = task.assigneeId ? state.people.find(p => p.id === task.assigneeId) : null;
                                return (
                                    <li key={task.id} className={`group bg-white dark:bg-slate-800 border rounded-xl p-3 hover:shadow-sm transition-all relative ${selectedTaskIds.includes(task.id) ? 'border-indigo-400 ring-1 ring-indigo-400/20 bg-indigo-50/30' : 'border-gray-100 dark:border-slate-700'}`}>
                                        <div className="flex items-start gap-3">
                                            <button onClick={() => isBulkMoveMode ? toggleTaskSelection(task.id) : updateTask(branch.id, task.id, { completed: !task.completed })} className={`mt-0.5 shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-slate-500 hover:text-indigo-500'}`}>{isBulkMoveMode ? (selectedTaskIds.includes(task.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />) : (task.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />)}</button>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className={`text-sm font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`} onClick={() => isBulkMoveMode ? toggleTaskSelection(task.id) : setEditingTask({ branchId: branch.id, taskId: task.id })}>{task.title}</p>
                                                    <button onClick={() => updateTask(branch.id, task.id, { pinned: !task.pinned })} className={`p-1 rounded transition-colors ml-auto ${task.pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'}`}><Pin className={`w-3.5 h-3.5 ${task.pinned ? 'fill-current' : ''}`} /></button>
                                                </div>
                                                
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                                                    <div className="flex items-center gap-2 group/assignee relative">
                                                        <div className="relative">
                                                            {assignee ? <Avatar person={assignee} size="sm" className="w-5 h-5 text-[8px]" /> : <div className="w-5 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400"><UserPlus className="w-2.5 h-2.5" /></div>}
                                                            <select 
                                                                value={task.assigneeId || ''} 
                                                                onChange={(e) => updateTask(branch.id, task.id, { assigneeId: e.target.value || undefined })} 
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                            >
                                                                <option value="">Team</option>
                                                                {state.people.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                                            </select>
                                                        </div>
                                                        {assignee && <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[60px]">{assignee.name.split(' ')[0]}</span>}
                                                    </div>

                                                    <span className="w-px h-3 bg-slate-100 dark:bg-slate-700" />

                                                    <div className="flex items-center gap-1.5 relative">
                                                        {task.completed && task.completedAt ? (
                                                            <div className="flex items-center gap-1 text-[9px] font-black text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded" title={`Chiuso il ${new Date(task.completedAt).toLocaleString()}`}>
                                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                                <span>{new Date(task.completedAt).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}</span>
                                                            </div>
                                                        ) : (
                                                            <DatePicker 
                                                                value={task.dueDate}
                                                                onChange={(val) => updateTask(branch.id, task.id, { dueDate: val })}
                                                                placeholder="Scadenza"
                                                                className={`px-2 py-0.5 rounded border transition-colors min-h-[28px] min-w-[90px] ${task.dueDate ? (new Date(task.dueDate) < new Date() ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200') : 'text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'}`}
                                                                icon={<Calendar className={`w-3 h-3 ${task.dueDate ? (new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-amber-500') : 'text-slate-400'}`} />}
                                                            />
                                                        )}
                                                    </div>

                                                    {task.description && (
                                                        <>
                                                            <span className="w-px h-3 bg-slate-100 dark:bg-slate-700" />
                                                            <button onClick={(e) => { e.stopPropagation(); setReadingTask({ branchId: branch.id, taskId: task.id }); }} className="text-slate-400 hover:text-indigo-500 shrink-0"><FileText className="w-3.5 h-3.5" /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => deleteTask(branch.id, task.id)} className="p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/10"><X className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        )}

        {!branch.isLabel && (
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timeline</h4>
                <div>
                    <label className="text-[10px] font-medium text-gray-400 mb-1 flex items-center gap-1 pointer-events-none"><PlayCircle className="w-3 h-3" /> Data Inizio</label>
                    <DatePicker 
                        value={branch.startDate}
                        onChange={(val) => updateBranch(branch.id, { startDate: val })}
                        placeholder="Inizio progetto"
                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-2 min-h-[36px]"
                    />
                </div>
                <div>
                     <label className="text-[10px] font-medium text-gray-400 mb-1 flex items-center gap-1 pointer-events-none"><Clock className="w-3 h-3" /> Scadenza Ramo</label>
                     <DatePicker 
                        value={branch.dueDate}
                        onChange={(val) => updateBranch(branch.id, { dueDate: val })}
                        placeholder="Fine progetto"
                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-2 min-h-[36px]"
                    />
                </div>
            </div>
        )}

        {!branch.isLabel && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">Stato</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(BranchStatus).map((statusKey) => {
                  const status = statusKey as BranchStatus;
                  const config = STATUS_CONFIG[status];
                  return (
                    <button key={status} onClick={() => updateBranch(branch.id, { status })} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-all ${branch.status === status ? `${config.color} border-current ring-1 ring-current` : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>{config.icon}{config.label}</button>
                  );
                })}
              </div>
            </div>
        )}

        {branch.id !== state.rootBranchId && (
             <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-700 pb-4 space-y-3">
                <button onClick={() => toggleBranchArchive(branch.id)} className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">{branch.archived ? (<><RefreshCw className="w-4 h-4" /> Ripristina Ramo</>) : (<><Archive className="w-4 h-4" /> Archivia Ramo</>)}</button>
                <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm w-full flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Elimina Ramo</button>
             </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-sm animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500"><AlertTriangle className="w-6 h-6" /></div>
                    <div><h3 className="text-lg font-bold text-slate-800 dark:text-white">Eliminare il ramo?</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Questa azione è irreversibile.</p></div>
                    <div className="flex gap-3 w-full mt-2"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 text-sm font-medium bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">Annulla</button><button onClick={() => deleteBranch(branch.id)} className="flex-1 py-2 text-sm font-bold bg-red-600 text-white rounded-lg shadow-sm">Elimina</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BranchDetails;
