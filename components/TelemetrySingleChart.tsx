import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { motion, AnimatePresence } from 'framer-motion';
import { TelemetryPoint, StagedLap } from '../types';
import { generateSeriesColors } from '../utils/teamColors';

// --- INTERNAL COMPONENT: RESPONSIVE CHART WRAPPER ---
// Encapsulates the ResizeObserver logic to ensure ApexCharts only renders
// when the parent container has valid dimensions.
const ResponsiveApexChart: React.FC<{
    options: ApexOptions;
    series: ApexOptions['series'];
    type: "line" | "area" | "bar";
    className?: string;
}> = ({ options, series, type, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldRender, setShouldRender] = useState(false);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            if (!Array.isArray(entries) || !entries.length) return;
            
            const entry = entries[0];
            const { width, height } = entry.contentRect;

            // Only trigger render if dimensions are valid
            if (width > 0 && height > 0) {
                // Use requestAnimationFrame to prevent "ResizeObserver loop limit exceeded"
                requestAnimationFrame(() => {
                    setShouldRender(true);
                });
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div ref={containerRef} className={`w-full h-full relative min-h-[50px] ${className || ''}`}>
            {shouldRender ? (
                <ReactApexChart
                    options={options}
                    series={series}
                    type={type}
                    height="100%"
                    width="100%"
                />
            ) : (
                // Optional: Subtle skeleton/loading state while calculating layout
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                     <div className="w-6 h-6 border-2 border-f1-red border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
    );
};

interface TelemetrySingleChartProps {
  title: string;
  data: TelemetryPoint[];
  dataKey: 'speed' | 'throttle' | 'brake' | 'rpm' | 'gear' | 'delta';
  stagedLaps: StagedLap[];
}

const TelemetrySingleChart: React.FC<TelemetrySingleChartProps> = ({
  title,
  data,
  dataKey,
  stagedLaps,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());

  // --- MEMOIZED DATA TRANSFORMATION ---
  const { series, chartColors, allColors } = useMemo(() => {
      const activeSeries: any[] = [];
      const activeColors: string[] = [];
      
      const baseColors = generateSeriesColors(stagedLaps.map(s => ({ team_name: s.driver.team_name })));

      stagedLaps.forEach((sl, index) => {
          if (hiddenIndices.has(index)) return;

          const traceId = `${sl.driver.name_acronym}_L${sl.lap.lap_number}`;
          const key = `${dataKey}_${traceId}`;
          
          const seriesData = [];
          const len = data.length;
          
          for(let i = 0; i < len; i++) {
              const row = data[i] as any;
              const val = row[key];
              if (val !== null && val !== undefined && row.distance !== undefined) {
                  seriesData.push([row.distance, val]);
              }
          }

          activeSeries.push({
              name: `${sl.driver.name_acronym} (L${sl.lap.lap_number})`,
              data: seriesData
          });
          activeColors.push(baseColors[index]);
      });

      return { series: activeSeries, chartColors: activeColors, allColors: baseColors };
  }, [data, stagedLaps, hiddenIndices, dataKey]);

  // --- PERFORMANCE CONFIGURATION ---
  const options: ApexOptions = useMemo(() => ({
      chart: {
          type: 'line',
          animations: { enabled: false }, 
          background: 'transparent',
          fontFamily: 'Inter, sans-serif',
          toolbar: { show: isExpanded },
          zoom: { enabled: isExpanded, type: 'x', autoScaleYaxis: true },
          parentHeightOffset: 0,
      },
      theme: { mode: 'dark' },
      colors: chartColors,
      fill: {
        type: 'solid',
        opacity: 1,
      },
      stroke: {
          curve: 'monotoneCubic', 
          width: 2,
      },
      grid: {
          borderColor: '#334155', 
          strokeDashArray: 3,
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } },
          padding: { top: 10, right: 10, bottom: 0, left: 10 }
      },
      xaxis: {
          type: 'numeric',
          tooltip: { enabled: isExpanded },
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
              style: { colors: '#94a3b8', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' },
              formatter: (val: string) => `${Math.round(Number(val))}m`
          }
      },
      yaxis: {
          max: dataKey === 'gear' ? 8 : (dataKey === 'throttle' || dataKey === 'brake' ? 100 : undefined),
          min: dataKey === 'gear' ? 0 : (dataKey === 'throttle' || dataKey === 'brake' ? 0 : undefined),
          tickAmount: 5, forceNiceScale: true,
          decimalsInFloat: dataKey === 'delta' ? 3 : 0,
          labels: {
              style: { colors: '#94a3b8', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' },
              formatter: (val) => {
                  const num = Number(val);
                  if (dataKey === 'delta') return num.toFixed(3);
                  return Math.round(num).toString();
              },
          },
      },
      markers: {
          size: 0,
          hover: { size: 5, strokeWidth: 0, strokeColors: '#fff' }
      },
      legend: { show: false }, 
      tooltip: {
          theme: 'dark',
          style: { fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' },
          x: { formatter: (val) => `${Math.round(Number(val))}m` },
          y: { 
              formatter: (val) => {
                  const numVal = Number(val);
                  if (dataKey === 'speed') return `${Math.round(numVal)} km/h`;
                  if (dataKey === 'rpm') return `${Math.round(numVal)}`;
                  if (dataKey === 'gear') return `${numVal}`;
                  if (dataKey === 'delta') return `${numVal > 0 ? '+' : ''}${numVal.toFixed(3)}s`;
                  return `${Math.round(numVal)}%`;
              } 
          }
      }
  }), [chartColors, dataKey, isExpanded]);

  const toggleVisibility = (index: number) => {
      const next = new Set(hiddenIndices);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setHiddenIndices(next);
  };
  
  if (!data || data.length === 0) return null;

  return (
    <>
      <div className="relative w-full h-[320px] bg-f1-surface border border-white/5 rounded-lg p-4 flex flex-col mb-6 hover:border-white/10 transition-colors shadow-lg group/chart">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-2 shrink-0 h-8">
            <div className="flex items-center gap-2">
                 <button 
                    onClick={() => setIsExpanded(true)}
                    className="p-1.5 rounded hover:bg-white/10 text-f1-muted hover:text-white transition-colors active:scale-95"
                    title="Expand Chart"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>
                <h3 className="text-xs font-bold uppercase tracking-widest text-f1-muted px-1">
                    {title}
                </h3>
            </div>

            <div className="flex flex-wrap gap-2">
                {stagedLaps.map((sl, index) => {
                    const isHidden = hiddenIndices.has(index);
                    const color = allColors[index];
                    return (
                        <button 
                            key={sl.id} 
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(index); }}
                            className={`flex items-center gap-2 px-2 py-1 rounded border border-transparent text-[10px] font-medium transition-all active:scale-95 duration-100 ${isHidden ? 'opacity-40 grayscale bg-transparent line-through text-f1-muted' : 'bg-white/5 hover:bg-white/10 text-f1-text'}`}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                            <span className="uppercase">{sl.driver.name_acronym} (L{sl.lap.lap_number})</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* CHART CONTAINER - Uses Responsive Wrapper */}
        <div className="flex-1 w-full min-h-0 relative">
            <ResponsiveApexChart 
                options={options}
                series={series}
                type="line"
            />
        </div>
      </div>

      {/* FULLSCREEN MODAL */}
      <AnimatePresence>
        {isExpanded && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={() => setIsExpanded(false)}
                    className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                />
                
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-7xl h-[85vh] bg-[#0F1014] border border-f1-border rounded-xl p-6 shadow-2xl flex flex-col"
                >
                     <div className="flex justify-between items-center mb-6 shrink-0">
                        <div>
                             <h3 className="text-lg font-bold uppercase tracking-widest text-white">
                                {title} Analysis
                            </h3>
                             <div className="flex flex-wrap gap-3 mt-2">
                                {stagedLaps.map((sl, index) => {
                                    const isHidden = hiddenIndices.has(index);
                                    const color = allColors[index];
                                    return (
                                        <button 
                                            key={sl.id} 
                                            onClick={() => toggleVisibility(index)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all active:scale-95 ${isHidden ? 'opacity-40 bg-white/5 line-through' : 'bg-white/10 ring-1 ring-white/10'}`}
                                        >
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                                            <span className="text-xs font-bold text-white uppercase">{sl.driver.name_acronym} (L{sl.lap.lap_number})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsExpanded(false)}
                            className="p-3 bg-white/5 hover:bg-white/10 hover:text-white text-f1-muted rounded-full transition-all active:scale-95"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="flex-1 w-full min-h-0 bg-[#0B0B0F] rounded-lg p-2 border border-white/5">
                        {/* 
                            RESPOINSIVE WRAPPER IN MODAL
                            Crucial here because Framer Motion animates from scale 0.95/opacity 0.
                            The Observer waits for valid dimensions before rendering.
                         */}
                         <ResponsiveApexChart 
                            options={options}
                            series={series}
                            type="line"
                         />
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default React.memo(TelemetrySingleChart);