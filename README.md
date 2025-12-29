
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

Per abilitare la sincronizzazione cloud e la collaborazione, è necessario collegare un progetto Supabase. Esegui lo script SQL aggiornato disponibile nelle impostazioni dell'app o nel file `SettingsPanel.tsx`.

---
*Progetto sviluppato con React e ❤️.*
