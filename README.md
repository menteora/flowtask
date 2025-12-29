# FlowTask 🌊

**FlowTask** è un gestore di progetti visivo progettato per organizzare flussi di lavoro complessi tramite una logica a rami (branching). A differenza delle classiche liste "To-Do", FlowTask permette di visualizzare la dipendenza tra le varie fasi di un progetto, assegnare compiti al team e monitorare l'avanzamento sia graficamente che cronologicamente.

## ✨ Funzionalità Principali

### 🌳 Gestione Workflow Visiva
*   **Visualizzazione a Nodi (Canvas)**: Un'interfaccia drag-and-drop su Desktop per navigare tra i rami del progetto.
*   **Visualizzazione ad Albero (Mobile)**: Una lista gerarchica ottimizzata per dispositivi mobili.
*   **Logica a Rami**: Crea rami figli, collega rami a più genitori (multi-link) e organizza il flusso logico.
*   **Stati del Ramo**: Gestisci lo stato di ogni fase (Pianificato, Attivo, Standby, Chiuso, Annullato).
*   **Etichette (Labels)**: Raggruppa sezioni logiche senza gestire stati operativi.
*   **Modalità Sprint 🚀**: Un tipo speciale di ramo che genera automaticamente i nomi dei rami figli seguendo il pattern `[NomePadre] YY-NN` (es. "Sviluppo 25-01") e incrementa un contatore interno.

### ✅ Gestione Task Avanzata
*   **Task Dettagliati**: Aggiungi task con scadenze e assegnatari specifici.
*   **Bulk Edit**: Modalità di modifica massiva per incollare liste di task da file di testo o Excel.
*   **Ordinamento**: Riordina task e rami facilmente.

### 👥 Team e Comunicazione
*   **Anagrafica Team**: Gestione membri con email, telefono e colore identificativo.
*   **Solleciti Intelligenti**: Generatore automatico di messaggi (WhatsApp o Email) per sollecitare i task in sospeso, con template di apertura/chiusura personalizzabili.

### 📅 Pianificazione
*   **Vista Calendario**: Timeline cronologica per visualizzare scadenze di task, inizio e fine rami.
*   **Vista Assegnazioni**: Panoramica del carico di lavoro diviso per utente con statistiche di completamento.

## 🗄️ Configurazione Database (Supabase)

Per abilitare la sincronizzazione cloud, crea le seguenti tabelle nel tuo progetto Supabase tramite l'SQL Editor:

```sql
-- CANCELLAZIONE VECCHIE TABELLE (Opzionale)
-- DROP TABLE IF EXISTS public.flowtask_tasks;
-- DROP TABLE IF EXISTS public.flowtask_branches;
-- DROP TABLE IF EXISTS public.flowtask_people;
-- DROP TABLE IF EXISTS public.flowtask_projects;

-- PROGETTI
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  root_branch_id text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PERSONE / TEAM
create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  initials text,
  color text
);

-- RAMI / BRANCHES
create table public.flowtask_branches (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null,
  start_date text,
  end_date text,
  due_date text,
  archived boolean default false,
  collapsed boolean default false,
  is_label boolean default false,
  is_sprint boolean default false,
  sprint_counter integer default 1,
  parent_ids text[],
  children_ids text[],
  position integer default 0
);

-- TASKS
create table public.flowtask_tasks (
  id text primary key,
  branch_id text references public.flowtask_branches(id) on delete cascade,
  title text not null,
  description text,
  assignee_id text references public.flowtask_people(id) on delete set null,
  due_date text,
  completed boolean default false,
  completed_at text,
  position integer default 0,
  pinned boolean default false
);

-- ABILITA RLS
alter table public.flowtask_projects enable row level security;
alter table public.flowtask_people enable row level security;
alter table public.flowtask_branches enable row level security;
alter table public.flowtask_tasks enable row level security;

-- POLICIES (Sicurezza lato utente)
create policy "Users can all on own projects" on public.flowtask_projects for all using (auth.uid() = owner_id);
create policy "Users can all on people of own projects" on public.flowtask_people for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_people.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on branches of own projects" on public.flowtask_branches for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_branches.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on tasks of own projects" on public.flowtask_tasks for all using (exists (select 1 from public.flowtask_branches join public.flowtask_projects on public.flowtask_projects.id = public.flowtask_branches.project_id where public.flowtask_branches.id = public.flowtask_tasks.branch_id and public.flowtask_projects.owner_id = auth.uid()));
```

## 🛠 Tech Stack
*   React 19, TypeScript, Tailwind CSS, Lucide React, Supabase.

---
*Progetto sviluppato con React e ❤️.*