import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Lap, Driver, StagedLap } from '../types';
import { generateSeriesColors } from '../utils/teamColors';

interface LapHistoryChartProps {
  selectedDrivers: Driver[];
  lapsData: Map<number, Lap[]>;
  stagedLaps: StagedLap[];
  onToggleLap: (driver: Driver, lap: Lap) => void;
  colors: string[]; 
}

// --- INTERNAL COMPONENT: RESPONSIVE CHART WRAPPER ---
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

            if (width > 0 && height > 0) {
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
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                     <div className="w-6 h-6 border-2 border-f1-red border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
    );
};

// Utility for formatting time (m:ss.ms)
const formatTime = (val: number) => {
    if (typeof val !== 'number' || isNaN(val) || val <= 0) return '';
    const m = Math.floor(val / 60);
    const s = (val % 60).toFixed(3);
    return `${m}:${s.padStart(6, '0')}`;
};

const LapHistoryChart: React.FC<LapHistoryChartProps> = ({
  selectedDrivers,
  lapsData,
  onToggleLap,
}) => {
  // Local state for visibility toggling
  const [hiddenDrivers, setHiddenDrivers] = useState<Set<number>>(new Set());

  const toggleDriver = (driverNumber: number) => {
      const next = new Set(hiddenDrivers);
      if (next.has(driverNumber)) next.delete(driverNumber);
      else next.add(driverNumber);
      setHiddenDrivers(next);
  };

  // 1. DATA PREPARATION
  const { series, chartColors, activeDrivers } = useMemo(() => {
    if (selectedDrivers.length === 0) {
        return { series: [], chartColors: [], activeDrivers: [] };
    }

    const stableColors = generateSeriesColors(selectedDrivers);

    const activeSeries: any[] = [];
    const activeColors: string[] = [];
    const driversRef: Driver[] = [];

    selectedDrivers.forEach((driver, index) => {
        if (hiddenDrivers.has(driver.driver_number)) return;

        const rawLaps = lapsData.get(driver.driver_number);
        if (!rawLaps || !Array.isArray(rawLaps)) return;

        const cleanData = rawLaps
            .filter(l => {
                const val = l.lap_duration;
                return typeof val === 'number' && !isNaN(val) && val > 0 && val < 600; 
            })
            .sort((a, b) => a.lap_number - b.lap_number)
            .map(l => ({
                x: l.lap_number,
                y: l.lap_duration
            }));

        if (cleanData.length > 0) {
            activeSeries.push({
                name: driver.name_acronym,
                data: cleanData
            });
            activeColors.push(stableColors[index]);
            driversRef.push(driver);
        }
    });

    return { series: activeSeries, chartColors: activeColors, activeDrivers: driversRef };
  }, [selectedDrivers, lapsData, hiddenDrivers]);

  // 2. CHART OPTIONS
  const options: ApexOptions = useMemo(() => ({
      chart: {
          type: 'line', 
          background: 'transparent',
          height: 350,
          toolbar: { show: false }, 
          zoom: { enabled: false }, 
          animations: { enabled: false }, 
          events: {
            markerClick: (event, chartContext, { seriesIndex, dataPointIndex }) => {
                if (!event || !chartContext || !chartContext.w || !chartContext.w.config.series) return;

                const target = event.target as HTMLElement | SVGElement;
                if (target) {
                    target.style.transformBox = 'fill-box';
                    target.style.transformOrigin = 'center';
                    target.style.transition = 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

                    requestAnimationFrame(() => {
                        target.style.transform = 'scale(0.8)';
                        setTimeout(() => {
                            target.style.transform = 'scale(1.4)';
                            setTimeout(() => {
                                target.style.transform = 'scale(1)';
                            }, 150);
                        }, 100);
                    });
                }

                const clickedSeries = chartContext.w.config.series[seriesIndex];
                if (!clickedSeries) return;

                const driverName = clickedSeries.name;
                const lapNumber = clickedSeries.data[dataPointIndex]?.x;

                if (lapNumber === undefined) return;

                const driver = activeDrivers.find(d => d.name_acronym === driverName);
                if (driver) {
                    const laps = lapsData.get(driver.driver_number);
                    const lap = laps?.find(l => l.lap_number === lapNumber);
                    if (lap) onToggleLap(driver, lap);
                }
            },
            dataPointMouseEnter: (event) => {
                if (event && event.target) {
                    (event.target as HTMLElement).style.cursor = 'pointer';
                }
            },
            dataPointMouseLeave: (event) => {
                if (event && event.target) {
                    (event.target as HTMLElement).style.cursor = 'default';
                }
            }
          }
      },
      theme: { mode: 'dark' },
      colors: chartColors,
      stroke: {
          curve: 'monotoneCubic', 
          width: 2,
      },
      fill: {
          type: 'solid',
          opacity: 1, 
      },
      grid: {
          borderColor: '#334155',
          strokeDashArray: 3,
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } },
          padding: { 
              top: 10,
              right: 30, 
              bottom: 10,
              left: 20   
          }
      },
      markers: {
          size: 4,
          strokeWidth: 0,
          strokeColors: '#fff',
          hover: { size: 6 }
      },
      xaxis: {
          type: 'numeric',
          title: { text: 'Lap Number', style: { color: '#64748b', fontSize: '10px' } },
          labels: { 
              style: { colors: '#94a3b8', fontFamily: 'JetBrains Mono' },
              formatter: (val) => Math.floor(Number(val)).toString()
          },
          tooltip: { enabled: false },
          axisBorder: { show: false },
          axisTicks: { show: false },
          decimalsInFloat: 0,
      },
      yaxis: {
          labels: {
              style: { colors: '#94a3b8', fontFamily: 'JetBrains Mono' },
              formatter: (val) => formatTime(val),
          },
      },
      legend: { show: false }, 
      tooltip: {
          theme: 'dark',
          shared: true,
          intersect: false,
          followCursor: true,
          y: {
              formatter: (val) => formatTime(val)
          },
          style: {
              fontSize: '12px',
              fontFamily: 'JetBrains Mono'
          }
      },
  }), [chartColors, activeDrivers, lapsData, onToggleLap]);

  // 3. UI RENDER
  if (selectedDrivers.length === 0) {
      return (
        <div className="w-full h-[380px] border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center bg-transparent mb-6">
            <span className="text-slate-600 font-mono text-xs uppercase tracking-[0.2em] font-medium">
                Waiting for Lap Data...
            </span>
        </div>
      );
  }

  const legendColors = generateSeriesColors(selectedDrivers);

  return (
    <div className="w-full h-[380px] bg-f1-surface border border-white/5 rounded-lg p-5 pb-2 mb-6 shadow-xl relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 h-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-f1-muted flex items-center gap-2">
              <span className="w-2 h-2 bg-f1-red rounded-full shadow-[0_0_8px_rgba(255,30,0,0.6)] animate-pulse"></span>
              Lap History Overview
          </h3>
          
          <div className="flex gap-2">
             {selectedDrivers.map((d, i) => {
                 const isHidden = hiddenDrivers.has(d.driver_number);
                 const color = legendColors[i];
                 return (
                     <button 
                        key={d.driver_number}
                        onClick={() => toggleDriver(d.driver_number)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all active:scale-95 duration-200 border border-transparent hover:border-white/10 ${isHidden ? 'opacity-40 grayscale decoration-white/30 line-through' : 'bg-white/5 hover:bg-white/10'}`}
                        title={isHidden ? "Show Driver" : "Hide Driver"}
                     >
                         <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color }}></span>
                         <span className={`text-[10px] font-bold text-gray-300 uppercase ${isHidden ? 'text-f1-muted' : ''}`}>{d.name_acronym}</span>
                     </button>
                 );
             })}
          </div>
      </div>
      
      {/* CHART CONTAINER - Uses Responsive Wrapper */}
      <div className="flex-1 w-full min-h-0 relative h-[300px]">
         {series.length > 0 ? (
             <ResponsiveApexChart 
                options={options} 
                series={series} 
                type="line" 
             />
         ) : (
            <div className="flex items-center justify-center h-full text-f1-muted text-xs uppercase tracking-widest">
                All drivers hidden
            </div>
         )}
      </div>
      <div className="absolute bottom-4 right-6 text-[9px] text-f1-muted uppercase tracking-widest opacity-50 pointer-events-none">
        Click point to compare telemetry
      </div>
    </div>
  );
};

export default React.memo(LapHistoryChart);