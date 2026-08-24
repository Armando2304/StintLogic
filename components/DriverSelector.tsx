import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Driver } from '../types';

interface DriverSelectorProps {
    allDrivers: Driver[];
    selectedDrivers: Driver[];
    onToggleDriver: (driver: Driver) => void;
    maxSelection?: number;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({
    allDrivers,
    selectedDrivers,
    onToggleDriver,
    maxSelection = 6
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Filter out already selected drivers from the list
    const availableDrivers = useMemo(() => {
        return allDrivers.filter(d => !selectedDrivers.find(sd => sd.driver_number === d.driver_number));
    }, [allDrivers, selectedDrivers]);

    // Group available drivers by team
    const groupedDrivers = useMemo(() => {
        const groups: Record<string, Driver[]> = {};
        availableDrivers.forEach(d => {
            if (!groups[d.team_name]) groups[d.team_name] = [];
            groups[d.team_name].push(d);
        });
        return Object.keys(groups).sort().reduce((acc, team) => {
            acc[team] = groups[team];
            return acc;
        }, {} as Record<string, Driver[]>);
    }, [availableDrivers]);

    return (
        <div className="space-y-6">
            <div className="relative">
                {/* Main Dropdown Button */}
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={selectedDrivers.length >= maxSelection}
                    className="w-full bg-f1-surface border border-white/10 hover:border-f1-red/50 text-white p-3.5 rounded-lg flex justify-between items-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 group shadow-lg"
                >
                    <span className="text-xs font-bold uppercase tracking-widest text-f1-muted group-hover:text-white transition-colors">
                        {selectedDrivers.length >= maxSelection ? 'Max Selection Reached' : 'Add Driver'}
                    </span>
                    <svg className={`w-4 h-4 text-f1-muted transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-f1-dark border border-f1-border rounded-lg shadow-2xl z-50 max-h-[300px] overflow-y-auto scrollbar-hide ring-1 ring-white/5"
                            >
                                {availableDrivers.length === 0 ? (
                                    <div className="p-4 text-xs text-f1-muted text-center">No more drivers available</div>
                                ) : (
                                    Object.entries(groupedDrivers).map(([team, teamDrivers]) => (
                                        <div key={team}>
                                            <div className="sticky top-0 bg-f1-surface/95 backdrop-blur px-4 py-2 text-[9px] uppercase font-bold text-f1-muted tracking-widest border-b border-f1-border/50">
                                                {team}
                                            </div>
                                            {(teamDrivers as Driver[]).map(dr => (
                                                <button
                                                    key={dr.driver_number}
                                                    onClick={() => {
                                                        onToggleDriver(dr);
                                                        setIsOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-f1-border/10 last:border-0 text-left group"
                                                >
                                                    <span className="w-1 h-8 rounded-full shadow-sm" style={{ backgroundColor: `#${dr.team_colour}` }}></span>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">
                                                            {dr.first_name} {dr.last_name.toUpperCase()}
                                                        </div>
                                                        <div className="text-[10px] text-f1-muted font-mono group-hover:text-gray-400">
                                                            #{dr.driver_number} | {dr.name_acronym}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Horizontal Selected List */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
                <AnimatePresence>
                    {selectedDrivers.map((dr) => (
                        <motion.div
                            key={dr.driver_number}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="bg-f1-surface border border-white/10 pr-2 pl-3 py-1.5 rounded flex items-center gap-3 group hover:border-f1-muted hover:bg-white/5 transition-all shadow-sm select-none"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]" style={{ backgroundColor: `#${dr.team_colour}` }}></span>
                                <span className="text-xs font-bold font-mono text-white tracking-tight">{dr.name_acronym}</span>
                            </div>
                            <button 
                                onClick={() => onToggleDriver(dr)}
                                className="text-f1-muted hover:text-f1-red transition-colors p-1 rounded-full hover:bg-white/10"
                                title="Remove Driver"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {selectedDrivers.length === 0 && (
                    <div className="w-full text-center py-6 border-2 border-dashed border-f1-border rounded-lg bg-f1-surface/30">
                        <span className="text-[10px] text-f1-muted uppercase tracking-widest font-medium">Select drivers to compare</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverSelector;