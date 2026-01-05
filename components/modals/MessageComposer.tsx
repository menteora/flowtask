
import React, { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useTask } from '../../context/TaskContext';
import { X, Send, Mail, Smartphone, Copy } from 'lucide-react';
import { Branch } from '../../types';

const MessageComposer: React.FC = () => {
  const { state } = useProject();
  // Using TaskContext for reminders and message templates
  const { remindingUserId, setRemindingUserId, messageTemplates } = useTask();
  
  const [isVisible, setIsVisible] = useState(false);
  
  const [preamble, setPreamble] = useState('');
  const [postamble, setPostamble] = useState('');
  const [method, setMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  
  const person = remindingUserId ? state.people.find(p => p.id === remindingUserId) : null;

  // Build task list
  const pendingTasks = React.useMemo(() => {
      if (!remindingUserId) return [];
      const tasks: { title: string, branch: string, due?: string }[] = [];
      
      (Object.values(state.branches) as Branch[]).forEach(branch => {
          if (branch.archived || branch.status === 'CANCELLED') return;
          branch.tasks.forEach(t => {
              if (t.assigneeId === remindingUserId && !t.completed) {
                  tasks.push({ title: t.title, branch: branch.title, due: t.dueDate });
              }
          });
      });
      return tasks;
  }, [remindingUserId, state.branches]);

  useEffect(() => {
    if (remindingUserId) {
      setIsVisible(true);
      
      // Replace placeholders
      const firstName = person?.name.split(' ')[0] || '';
      const initialPreamble = messageTemplates.opening.replace('{name}', firstName);
      
      setPreamble(initialPreamble);
      setPostamble(messageTemplates.closing);
      
      // Auto-select method based on available data
      if (person?.phone && !person.email) setMethod('whatsapp');
      else if (!person?.phone && person?.email) setMethod('email');
    } else {
      setTimeout(() => setIsVisible(false), 200);
    }
  }, [remindingUserId, person, messageTemplates]);

  if (!remindingUserId && !isVisible) return null;
  if (!person) return null;

  const handleClose = () => setRemindingUserId(null);

  const generateMessageBody = () => {
      let body = `${preamble}\n\n`;
      if (pendingTasks.length === 0) {
          body += "Nessuna attività in sospeso! 🎉\n";
      } else {
          pendingTasks.forEach(t => {
              const due = t.due ? ` (Scad: ${new Date(t.due).toLocaleDateString()})` : '';
              const formatTitle = method === 'whatsapp' ? `*${t.title}*` : t.title;
              body += `- ${formatTitle} [${t.branch}]${due}\n`;
          });
      }
      body += `\n${postamble}`;
      return body;
  };

  const handleSend = () => {
      const body = generateMessageBody();
      
      if (method === 'whatsapp') {
          if (!person.phone) {
              alert("Numero di telefono mancante.");
              return;
          }
          // Remove non-numeric chars for the link
          const cleanPhone = person.phone.replace(/\D/g, '');
          const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;
          window.open(url, '_blank');
      } else {
          if (!person.email) {
              alert("Email mancante.");
              return;
          }
          const subject = `Riepilogo Attività - ${state.name}`;
          const url = `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          
          // Use a hidden link click to avoid page navigation/reload issues
          const link = document.createElement('a');
          link.href = url;
          link.click();
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(generateMessageBody());
      alert("Messaggio copiato negli appunti!");
  };

  return (
    <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${remindingUserId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 w-full max-lg rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col transition-transform duration-200 max-h-[90vh] ${remindingUserId ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Invia Sollecito a {person.name}
            </h3>
            <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-4 overflow-y-auto">
            {/* Method Selector */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setMethod('whatsapp')}
                    disabled={!person.phone}
                    className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors ${method === 'whatsapp' ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} ${!person.phone ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Smartphone className="w-4 h-4" /> WhatsApp
                </button>
                <button
                    onClick={() => setMethod('email')}
                    disabled={!person.email}
                    className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors ${method === 'email' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} ${!person.email ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Mail className="w-4 h-4" /> Email
                </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Preambolo</label>
                    <textarea 
                        value={preamble}
                        onChange={(e) => setPreamble(e.target.value)}
                        className="w-full text-sm p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        rows={2}
                    />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md border border-slate-100 dark:border-slate-700">
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Anteprima Lista ({pendingTasks.length})</label>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-mono space-y-1 max-h-32 overflow-y-auto">
                        {pendingTasks.map((t, i) => (
                            <div key={i}>- {t.title} [{t.branch}]</div>
                        ))}
                        {pendingTasks.length === 0 && <div className="italic text-slate-400">Nessun task in sospeso</div>}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Postambolo</label>
                    <textarea 
                        value={postamble}
                        onChange={(e) => setPostamble(e.target.value)}
                        className="w-full text-sm p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        rows={2}
                    />
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 rounded-b-xl flex justify-between items-center">
            <button 
                onClick={handleCopy}
                className="text-slate-500 hover:text-indigo-600 text-xs font-medium flex items-center gap-1"
            >
                <Copy className="w-3 h-3" /> Copia testo
            </button>
            <button 
                onClick={handleSend}
                className={`px-6 py-2 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${method === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                <Send className="w-4 h-4" /> Invia
            </button>
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
