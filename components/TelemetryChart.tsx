import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, CustomTooltipProps } from '@tremor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { TelemetryPoint } from '../types';

interface TelemetryChartProps {
  data: TelemetryPoint[];
  dataKey: 'speed' | 'throttle' | 'brake' | 'rpm' | 'gear';
  traceIds: string[]; // List of Unique IDs (e.g. LEC_L5)
  colors: string[]; // List of Tremor colors
}

// ----------------------------------------------------------------------
// EXTERNALIZED HELPERS & COMPONENTS (Performance Optimization)
// ----------------------------------------------------------------------

const valueFormatter = (number: number, dataKey: string) => {
    if (dataKey === 'speed') return `${Math.round(number)} km/h`;
    if (dataKey === 'rpm') return `${Math.round(number)}`;
    if (dataKey === 'gear') return `${number}`;
    return `${Math.round(number)}%`;
};

// Defined outside to keep reference stable across renders
const ChartTooltip = ({ payload, active, label, dataKey }: CustomTooltipProps & { dataKey: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-f1-dark/95 border border-f1-border p-2 rounded shadow-xl text-xs z-50 backdrop-blur-md min-w-[150px]">
        <p className="text-f1-muted font-mono mb-2 border-b border-f1-border pb-1">
          DIST: {Math.round(Number(label))}m
        </p>
        {payload.map((item: any, idx: number) => {
            const seriesKey = item.name || item.dataKey || item.category || '';
            const rawName = String(seriesKey).replace(`${dataKey}_`, '');
            // Format name nicely: "LEC_L5" -> "LEC L5"
            const displayName = rawName.replace('_', ' ');
            
            return (
                <div key={idx} className="flex items-center justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2">
                        <span 
                            className="w-2 h-2 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]" 
                            style={{ backgroundColor: item.color }} 
                        />
                        <span className="text-white font-bold uppercase">{displayName}</span>
                    </div>
                    <span className="font-mono text-f1-text">
                        {valueFormatter(item.value, dataKey)}
                    </span>
                </div>
            );
        })}
      </div>
    );
};

const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  dataKey,
  traceIds,
  colors,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
     setIsMounted(true);
  }, []);

  const categories = useMemo(() => traceIds.map(id => `${dataKey}_${id}`), [traceIds, dataKey]);

  // Create specific formatter instance for this chart type
  const specificFormatter = useMemo(() => (val: number) => valueFormatter(val, dataKey), [dataKey]);

  // Create specific tooltip instance
  const TooltipComponent = useMemo(() => {
      return (props: CustomTooltipProps) => <ChartTooltip {...props} dataKey={dataKey} />;
  }, [dataKey]);

  const commonChartProps = useMemo(() => ({
    className: "h-full w-full",
    data: data,
    index: "distance",
    categories: categories,
    colors: colors,
    valueFormatter: specificFormatter,
    autoMinValue: true,
    showAnimation: true,
    customTooltip: TooltipComponent,
    curveType: "monotone" as const,
    noDataText: "No Telemetry Data",
    connectNulls: true
  }), [data, categories, colors, specificFormatter, TooltipComponent]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-72 bg-f1-surface/30 border border-f1-border rounded-lg flex items-center justify-center">
        <span className="text-xs text-f1-muted uppercase tracking-widest">No Data Available</span>
      </div>
    );
  }

  return (
    <>
      <motion.div 
        layoutId={`chart-container-${dataKey}`}
        onClick={() => setIsExpanded(true)}
        className="relative w-full h-80 bg-f1-surface/50 border border-f1-border rounded-lg p-4 flex flex-col cursor-pointer group hover:border-f1-red/50 hover:bg-f1-surface transition-colors overflow-hidden"
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex justify-between items-center mb-4 shrink-0 h-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-f1-muted bg-f1-surface px-2 py-1 rounded border border-f1-border group-hover:text-white group-hover:border-f1-red/50 transition-colors">
                {dataKey}
            </h3>
            <span className="text-[10px] text-f1-muted uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                Expand
            </span>
        </div>

        <div className="flex-1 w-full min-h-0 relative -ml-2">
            {!isMounted ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-f1-red border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="w-full h-full">
                     <LineChart 
                        {...commonChartProps}
                        showLegend={false}
                        showYAxis={false}
                        showXAxis={false}
                        startEndOnly={true}
                     />
                </div>
            )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={() => setIsExpanded(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                
                <motion.div 
                    layoutId={`chart-container-${dataKey}`}
                    className="relative w-full max-w-6xl h-[80vh] bg-f1-dark border border-f1-border rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col"
                >
                     <div className="flex justify-between items-center mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                             <h3 className="text-sm font-bold uppercase tracking-widest text-white bg-f1-surface px-3 py-1.5 rounded border border-f1-border">
                                {dataKey} Analysis
                            </h3>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                            className="p-2 bg-f1-surface hover:bg-f1-red text-white rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="flex-1 w-full min-h-0 relative">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            transition={{ delay: 0.1, duration: 0.3 }}
                            className="w-full h-full"
                        >
                             <LineChart 
                                {...commonChartProps}
                                showLegend={true}
                                showYAxis={true}
                                showXAxis={true}
                                startEndOnly={false}
                             />
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TelemetryChart;