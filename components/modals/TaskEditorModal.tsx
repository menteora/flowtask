
import React, { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { X, Calendar, User, Trash2, CheckSquare, Square, Save, ArrowRight } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { Branch } from '../../types';

const TaskEditorModal: React.FC = () => {
  const { editingTask, setEditingTask, state, updateTask, deleteTask, moveTaskToBranch } = useProject();
  const [isVisible, setIsVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [completed, setCompleted] = useState(false);
  
  // Move to Branch State
  const [targetBranchId, setTargetBranchId] = useState('');

  // Sync state when editingTask changes
  useEffect(() => {
    if (editingTask) {
        const branch = state.branches[editingTask.branchId];
        const task = branch?.tasks.find(t => t.id === editingTask.taskId);
        
        if (task) {
            setTitle(task.title);
            setAssigneeId(task.assigneeId || '');
            setDueDate(task.dueDate || '');
            setCompleted(task.completed);
            setTargetBranchId(''); // Reset selector
            setIsVisible(true);
        } else {
            setEditingTask(null);
        }
    } else {
        setTimeout(() => setIsVisible(false), 200);
    }
  }, [editingTask, state.branches]);

  if (!editingTask && !isVisible) return null;

  const handleClose = () => {
      setEditingTask(null);
  };

  const handleSave = () => {
      if (!editingTask || !title.trim()) return;
      
      updateTask(editingTask.branchId, editingTask.taskId, {
          title: title.trim(),
          assigneeId: assigneeId || undefined,
          dueDate: dueDate || undefined,
          completed
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
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') handleClose();
  };

  return (
    <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${editingTask ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col transition-transform duration-200 ${editingTask ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-white">Modifica Task</h3>
            <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Title & Check */}
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

            {/* Assignee */}
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

            {/* Due Date */}
            <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Scadenza</label>
                 <div className="relative group">
                    <input 
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Calendar className="w-4 h-4" />
                    </div>
                </div>
            </div>
            
            {/* Move to Branch */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Sposta in un altro ramo</label>
                 <div className="flex gap-2">
                     <select
                        value={targetBranchId}
                        onChange={(e) => setTargetBranchId(e.target.value)}
                        className="flex-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
