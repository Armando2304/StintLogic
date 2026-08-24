import React from 'react';
import { Session } from '../types';

interface SessionSelectorProps {
    years: number[];
    selectedYear: number;
    onSelectYear: (year: number) => void;
    sessions: Session[];
    selectedSession: Session | null;
    onSelectSession: (session: Session) => void;
    isLoading: boolean;
    onRandomize: () => void;
    onRefresh: () => void;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({ 
    years, 
    selectedYear, 
    onSelectYear, 
    sessions, 
    selectedSession, 
    onSelectSession, 
    isLoading,
    onRandomize,
    onRefresh
}) => {
    
    // Group sessions by Meeting (Grand Prix)
    const meetings = React.useMemo(() => {
        const map = new Map<string, Session[]>();
        sessions.forEach(s => {
            const key = `${s.country_name} - ${s.circuit_short_name}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)?.push(s);
        });
        return map;
    }, [sessions]);

    // Current selection derived state
    const currentMeetingKey = selectedSession ? `${selectedSession.country_name} - ${selectedSession.circuit_short_name}` : '';

    return (
        <div className="flex flex-col md:flex-row gap-6 mb-10 p-1 items-end">
             <div className="w-full md:w-32">
                <label className="block text-[10px] uppercase text-f1-muted font-bold tracking-widest mb-2 ml-1">Season</label>
                <div className="relative group">
                    <select 
                        className="w-full appearance-none bg-f1-surface text-white p-3 pr-8 rounded border border-white/10 hover:border-f1-muted focus:border-f1-red focus:ring-1 focus:ring-f1-red focus:outline-none transition-all font-mono text-sm shadow-lg cursor-pointer h-[46px]"
                        disabled={isLoading}
                        value={selectedYear}
                        onChange={(e) => onSelectYear(Number(e.target.value))}
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-f1-muted group-hover:text-white transition-colors">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full">
                <label className="block text-[10px] uppercase text-f1-muted font-bold tracking-widest mb-2 ml-1">Grand Prix</label>
                <div className="relative group">
                    <select 
                        className="w-full appearance-none bg-f1-surface text-white p-3 pr-8 rounded border border-white/10 hover:border-f1-muted focus:border-f1-red focus:ring-1 focus:ring-f1-red focus:outline-none transition-all font-sans text-sm font-medium shadow-lg cursor-pointer h-[46px]"
                        disabled={isLoading || sessions.length === 0}
                        value={currentMeetingKey}
                        onChange={(e) => {
                            const meetingSessions = meetings.get(e.target.value);
                            if (meetingSessions && meetingSessions.length > 0) {
                                // Default to Race or first session
                                const race = meetingSessions.find(s => s.session_name === 'Race') 
                                          || meetingSessions.find(s => s.session_name === 'Qualifying')
                                          || meetingSessions[0];
                                onSelectSession(race);
                            }
                        }}
                    >
                        <option value="" disabled>{sessions.length === 0 ? 'No Data' : 'Select a Grand Prix'}</option>
                        {Array.from(meetings.keys()).map(key => (
                            <option key={key} value={key}>{key}</option>
                        ))}
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-f1-muted group-hover:text-white transition-colors">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full">
                {/* Revised Header Row: Label + Refresh Action */}
                <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-[10px] uppercase text-f1-muted font-bold tracking-widest">
                        Session
                    </label>
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        title="Refresh session list"
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-f1-muted hover:text-blue-400 transition-colors disabled:opacity-50 group cursor-pointer"
                    >
                         <svg className={`w-3 h-3 ${isLoading ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="hidden sm:inline">Refresh List</span>
                    </button>
                </div>

                 <div className="relative group">
                    <select 
                        className="w-full appearance-none bg-f1-surface text-white p-3 pr-8 rounded border border-white/10 hover:border-f1-muted focus:border-f1-red focus:ring-1 focus:ring-f1-red focus:outline-none transition-all font-sans text-sm font-medium shadow-lg cursor-pointer h-[46px]"
                        disabled={!selectedSession || isLoading}
                        value={selectedSession?.session_key || ''}
                        onChange={(e) => {
                            const s = sessions.find(sess => sess.session_key === Number(e.target.value));
                            if(s) onSelectSession(s);
                        }}
                    >
                        {selectedSession && meetings.get(currentMeetingKey)?.map(s => (
                            <option key={s.session_key} value={s.session_key}>
                                {s.session_name}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-f1-muted group-hover:text-white transition-colors">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="shrink-0">
                <button
                    onClick={onRandomize}
                    disabled={isLoading}
                    title="Load Random Demo Data (Qualifying Duel)"
                    className="bg-f1-surface hover:bg-f1-surface/80 border border-white/10 text-f1-red hover:text-red-400 p-3 rounded shadow-lg transition-all active:scale-95 group disabled:opacity-50 disabled:active:scale-100 h-[46px] w-[46px] flex items-center justify-center"
                >
                    <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default SessionSelector;