# FlowTask 🌊

**FlowTask** è un gestore di progetti visivo progettato per organizzare flussi di lavoro complessi tramite una logica a rami (branching). A differenza delle classiche liste "To-Do", FlowTask permette di visualizzare la dipendenza tra le varie fasi di un progetto, assegnare compiti al team e monitorare l'avanzamento sia graficamente che cronologicamente.

## ✨ Funzionalità Principali

### 🌳 Gestione Workflow Visiva
*   **Visualizzazione a Nodi (Canvas)**: Un'interfaccia drag-and-drop su Desktop.
*   **Visualizzazione ad Albero (Mobile)**: Una lista gerarchica ottimizzata per il touch.
*   **Logica a Rami**: Crea rami figli, collega rami a più genitori e organizza il flusso.
*   **Modalità Sprint 🚀**: Rami speciali che generano automaticamente i nomi dei figli seguendo il pattern `[NomePadre] YY-NN`.

### ✅ Gestione Task Avanzata
*   **Focus & Pin**: Aggiungi i task più importanti alla vista Focus per averli sempre sott'occhio.
*   **Bulk Edit**: Modifica massiva per incollare liste di task da appunti.
*   **Sincronizzazione Real-time**: I dati vengono salvati automaticamente su Supabase.

## 🗄️ Configurazione Database (Supabase)

Per abilitare la sincronizzazione cloud, esegui questo script nell'**SQL Editor** di Supabase:

```sql
-- 1. PROGETTI
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  root_branch_id text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PERSONE / TEAM
create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  initials text,
  color text
);

-- 3. RAMI / BRANCHES
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

-- 4. TASKS
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

-- 5. SICUREZZA (RLS)
alter table public.flowtask_projects enable row level security;
alter table public.flowtask_people enable row level security;
alter table public.flowtask_branches enable row level security;
alter table public.flowtask_tasks enable row level security;

create policy "Users can all on own projects" on public.flowtask_projects for all using (auth.uid() = owner_id);
create policy "Users can all on people of own projects" on public.flowtask_people for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_people.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on branches of own projects" on public.flowtask_branches for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_branches.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on tasks of own projects" on public.flowtask_tasks for all using (exists (select 1 from public.flowtask_branches join public.flowtask_projects on public.flowtask_projects.id = public.flowtask_branches.project_id where public.flowtask_branches.id = public.flowtask_tasks.branch_id and public.flowtask_projects.owner_id = auth.uid()));
```

---
*Progetto sviluppato con React 19 e ❤️.*