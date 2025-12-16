# FlowTask 🌊

**FlowTask** è un gestore di progetti visivo progettato per organizzare flussi di lavoro complessi tramite una logica a rami (branching). A differenza delle classiche liste "To-Do", FlowTask permette di visualizzare la dipendenza tra le varie fasi di un progetto, assegnare compiti al team e monitorare l'avanzamento sia graficamente che cronologicamente.

## ✨ Funzionalità Principali

### 🌳 Gestione Workflow Visiva
*   **Visualizzazione a Nodi (Canvas)**: Un'interfaccia drag-and-drop su Desktop per navigare tra i rami del progetto.
*   **Visualizzazione ad Albero (Mobile)**: Una lista gerarchica ottimizzata per dispositivi mobili.
*   **Logica a Rami**: Crea rami figli, collega rami a più genitori (multi-link) e organizza il flusso logico.
*   **Stati del Ramo**: Gestisci lo stato di ogni fase (Pianificato, Attivo, Standby, Chiuso, Annullato).
*   **Etichette (Labels)**: Possibilità di trasformare i rami in semplici etichette visive per raggruppare sezioni logiche.

### ✅ Gestione Task Avanzata
*   **Task Dettagliati**: Aggiungi task con scadenze e assegnatari specifici.
*   **Bulk Edit**: Modalità di modifica massiva per incollare liste di task da file di testo o Excel.
*   **Ordinamento**: Riordina task e rami facilmente.

### 👥 Team e Comunicazione
*   **Anagrafica Team**: Gestione membri con email, telefono e colore identificativo.
*   **Solleciti Intelligenti**: Generatore automatico di messaggi (WhatsApp o Email) per sollecitare i task in sospeso, con template di apertura/chiusura personalizzabili.
*   **Importazione Contatti**: Integrazione (su mobile supportati) per importare membri dalla rubrica.

### 📅 Pianificazione
*   **Vista Calendario**: Timeline cronologica per visualizzare scadenze di task, inizio e fine rami.
*   **Vista Assegnazioni**: Panoramica del carico di lavoro diviso per utente con statistiche di completamento.

### ☁️ Sincronizzazione e Dati
*   **Supabase Sync**: Sincronizzazione in tempo reale su cloud con autenticazione utente.
*   **Offline First**: Funziona anche offline salvando i dati nel LocalStorage del browser.
*   **Import/Export**: Esporta l'intero progetto in JSON o scarica un'immagine PNG del grafico del flusso.

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **Backend / Database**: Supabase (PostgreSQL + Auth)
*   **Export**: html-to-image (per screenshot del canvas)

## 🚀 Installazione e Avvio

1.  **Clona il repository (o scarica i file)**
2.  **Installa le dipendenze**:
    ```bash
    npm install
    ```
3.  **Avvia il server di sviluppo**:
    ```bash
    npm run dev
    ```

## 🗄️ Configurazione Database (Supabase)

Per abilitare la sincronizzazione cloud e la collaborazione, è necessario collegare un progetto Supabase.

1.  Crea un nuovo progetto su [Supabase](https://supabase.com).
2.  Vai nell'**SQL Editor** di Supabase ed esegui lo script sottostante per creare le tabelle e le policy di sicurezza:

```sql
-- Projects
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  root_branch_id text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- People
create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  initials text,
  color text
);

-- Branches
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
  parent_ids text[],
  children_ids text[],
  position integer default 0
);

-- Tasks
create table public.flowtask_tasks (
  id text primary key,
  branch_id text references public.flowtask_branches(id) on delete cascade,
  title text not null,
  assignee_id text references public.flowtask_people(id) on delete set null,
  due_date text,
  completed boolean default false,
  position integer default 0
);

-- RLS Security Policies
alter table public.flowtask_projects enable row level security;
alter table public.flowtask_people enable row level security;
alter table public.flowtask_branches enable row level security;
alter table public.flowtask_tasks enable row level security;

create policy "Users can all on own projects" on public.flowtask_projects for all using (auth.uid() = owner_id);

create policy "Users can all on people of own projects" on public.flowtask_people for all using (
  exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_people.project_id and public.flowtask_projects.owner_id = auth.uid())
);

create policy "Users can all on branches of own projects" on public.flowtask_branches for all using (
  exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_branches.project_id and public.flowtask_projects.owner_id = auth.uid())
);

create policy "Users can all on tasks of own projects" on public.flowtask_tasks for all using (
  exists (select 1 from public.flowtask_branches join public.flowtask_projects on public.flowtask_projects.id = public.flowtask_branches.project_id where public.flowtask_branches.id = public.flowtask_tasks.branch_id and public.flowtask_projects.owner_id = auth.uid())
);
```

3.  Nell'applicazione FlowTask, vai su **Impostazioni (Settings)**.
4.  Inserisci l'**URL del progetto** e la **Anon Public Key** (trovabili nelle impostazioni API di Supabase).
5.  Registrati o accedi tramite la schermata di login.

## 📱 Utilizzo

*   **Workflow View**: Clicca sullo sfondo per trascinare la vista. Clicca su un ramo per vedere i dettagli, aggiungere task o creare sotto-rami.
*   **Team View**: Aggiungi membri. Clicca sull'icona "messaggio" nei task o nella vista "Task" per generare un sollecito precompilato.
*   **Settings**: Qui puoi modificare i template dei messaggi (apertura/chiusura email e WhatsApp), gestire la connessione al database ed esportare i dati.

---
*Progetto sviluppato con React e ❤️.*
