import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Plus, Trash2, Users, Mail, Edit2, X, Save } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { Person } from '../../types';

const PeopleManager: React.FC = () => {
  const { state, addPerson, updatePerson, removePerson } = useProject();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      if (editingId) {
          updatePerson(editingId, { name: newName.trim(), email: newEmail.trim() });
          setEditingId(null);
      } else {
          addPerson(newName.trim(), newEmail.trim());
      }
      setNewName('');
      setNewEmail('');
    }
  };

  const handleEdit = (person: Person) => {
      setNewName(person.name);
      setNewEmail(person.email || '');
      setEditingId(person.id);
  };

  const handleCancel = () => {
      setNewName('');
      setNewEmail('');
      setEditingId(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            Gestione Team
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Aggiungi, modifica o rimuovi membri del team.</p>
      </div>

      {/* Add/Edit Person Bar */}
      <div className={`p-4 rounded-lg shadow-sm border mb-6 transition-colors ${editingId ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-gray-200 dark:bg-slate-800 dark:border-slate-700'}`}>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome..."
                    className="flex-1 text-base rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                />
                <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email (opzionale)..."
                    className="flex-1 text-base rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div className="flex gap-2">
                {editingId && (
                    <button 
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors flex items-center justify-center gap-2 font-medium shrink-0"
                    >
                        <X className="w-4 h-4" />
                        <span>Annulla</span>
                    </button>
                )}
                <button 
                    type="submit"
                    className={`px-6 py-2 text-white rounded-md transition-colors flex items-center justify-center gap-2 font-medium shrink-0 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
                    <span>{editingId ? 'Salva' : 'Aggiungi'}</span>
                </button>
            </div>
        </form>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pb-20">
        {state.people.map(person => (
          <div key={person.id} className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border flex items-center justify-between group transition-all ${editingId === person.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-500'}`}>
            <div className="flex items-center gap-4 min-w-0">
              <Avatar person={person} size="lg" />
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800 dark:text-white truncate">{person.name}</h3>
                {person.email && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate" title={person.email}>
                        <Mail className="w-3 h-3" />
                        {person.email}
                    </p>
                )}
                {!person.email && (
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">{person.initials}</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => handleEdit(person)}
                    className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-all"
                    title="Modifica"
                    disabled={!!editingId && editingId !== person.id}
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => removePerson(person.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                    title="Rimuovi"
                    disabled={!!editingId}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
          </div>
        ))}
        
        {state.people.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 italic">
                Nessun membro nel team. Aggiungine uno sopra.
            </div>
        )}
      </div>
    </div>
  );
};

export default PeopleManager;