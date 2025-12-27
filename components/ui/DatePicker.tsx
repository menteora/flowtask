
import React, { useRef, useId } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  type?: 'date' | 'datetime-local';
  className?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  showValue?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({ 
  value, 
  onChange, 
  type = 'date', 
  className = '', 
  icon, 
  placeholder = 'Seleziona...',
  showValue = true
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const isDateTime = type === 'datetime-local';

  /**
   * Converte la data in formato accettato dall'input nativo (YYYY-MM-DD o YYYY-MM-DDTHH:mm).
   * Gestisce il fuso orario locale correttamente.
   */
  const toNativeFormat = (val: string | undefined): string => {
    if (!val) return '';
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) return '';
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const Y = date.getFullYear();
      const M = pad(date.getMonth() + 1);
      const D = pad(date.getDate());
      
      if (isDateTime) {
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        return `${Y}-${M}-${D}T${hh}:${mm}`;
      }
      return `${Y}-${M}-${D}`;
    } catch (e) {
      return '';
    }
  };

  /**
   * Formatta la data per la visualizzazione testuale nell'UI.
   */
  const toDisplayFormat = (val: string) => {
    if (!val) return placeholder;
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) return placeholder;
      
      return isDateTime 
        ? date.toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return placeholder;
    }
  };

  /**
   * Forza l'apertura del calendario nativo.
   */
  const handleContainerClick = (e: React.MouseEvent) => {
    // Evitiamo che il click si propaghi ad altri gestori di eventi (es. selezione del ramo)
    e.stopPropagation();
    
    if (inputRef.current) {
      // Metodo moderno supportato da Chrome, Edge e Safari recenti
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          inputRef.current.showPicker();
        } catch (err) {
          // Fallback al click classico se showPicker fallisce
          inputRef.current.click();
        }
      } else {
        // Fallback per browser datati
        inputRef.current.focus();
        inputRef.current.click();
      }
    }
  };

  const nativeValue = toNativeFormat(value);

  return (
    <div 
      onClick={handleContainerClick}
      className={`relative flex items-center justify-between group cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-md px-2 py-1 transition-all min-h-[32px] bg-slate-50/50 dark:bg-slate-800/30 ${className}`}
    >
      {/* 
          Layer Visivo: Testo a sinistra, Icona a destra. 
          pointer-events-none assicura che il click "passi attraverso" all'input sottostante.
      */}
      <div className="flex items-center justify-between w-full pointer-events-none gap-2">
        {showValue && (
          <span className={`text-[10px] font-bold whitespace-nowrap truncate ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
            {toDisplayFormat(value || '')}
          </span>
        )}
        <div className="shrink-0">
          {icon || (isDateTime ? 
            <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" /> : 
            <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          )}
        </div>
      </div>

      {/* 
          Layer Funzionale: Input Nativo.
          Usiamo opacity-0.01 invece di 0 perché alcuni browser in sandbox 
          disabilitano l'interazione con elementi totalmente trasparenti.
      */}
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={nativeValue}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 opacity-[0.01] w-full h-full cursor-pointer z-10"
        style={{ 
          colorScheme: 'light dark',
          // Importante per evitare lo zoom automatico su dispositivi mobili
          fontSize: '16px' 
        }}
      />
    </div>
  );
};

export default DatePicker;
