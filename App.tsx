import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getSessions,
  getDrivers,
  getLaps,
  getCarTelemetry,
  getLatestSession,
} from "./services/openf1Service";
import { Session, Driver, Lap, StagedLap } from "./types";
import SessionSelector from "./components/SessionSelector";
import TelemetrySingleChart from "./components/TelemetrySingleChart";
import LapHistoryChart from "./components/LapHistoryChart";
import DriverSelector from "./components/DriverSelector";
import { processTelemetryData, formatLapTime } from "./utils/telemetryUtils";
import { getTeamColors } from "./utils/teamColors";
import { FALLBACK_COLOR } from "./utils/chartUtils";
import { CIRCUIT_LENGTHS } from "./utils/circuitLengths";

// --- CONSTANTS ---
const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = 2023;
const AVAILABLE_YEARS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
);
const MAX_LAPS = 8;

export const App: React.FC = () => {
  // --- STATE ---
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<Driver[]>([]);

  const pendingRandomCountRef = useRef<number | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);

  // Data Containers
  const [lapsData, setLapsData] = useState<Map<number, Lap[]>>(new Map());
  const [stagedLaps, setStagedLaps] = useState<StagedLap[]>([]);
  const [telemetryData, setTelemetryData] = useState<any[]>([]);

  // Loading States
  const [loadingLaps, setLoadingLaps] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoadingSessions(true);
      try {
        const latest = await getLatestSession();
        if (!mounted) return;

        if (latest) {
          setSelectedYear(latest.year);
          const allSessions = await getSessions(latest.year);
          if (mounted) {
            setSessions(allSessions);
            setSelectedSession(latest);
          }
        } else {
          const allSessions = await getSessions(selectedYear);
          if (mounted) setSessions(allSessions);
        }
      } catch (e) {
        console.error("Init Error", e);
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // --- DRIVER LOADING ---
  useEffect(() => {
    if (!selectedSession) return;
    let mounted = true;
    const loadDrivers = async () => {
      try {
        const d = await getDrivers(selectedSession.session_key);
        if (mounted) {
          const unique = d.filter(
            (v, i, a) =>
              a.findIndex((t) => t.driver_number === v.driver_number) === i,
          );
          setAllDrivers(unique);

          if (pendingRandomCountRef.current !== null) {
            const count = pendingRandomCountRef.current;
            const shuffled = [...unique].sort(() => 0.5 - Math.random());
            setSelectedDrivers(shuffled.slice(0, count));
            pendingRandomCountRef.current = null;
          } else {
            setSelectedDrivers([]);
          }
          setLapsData(new Map());
          setStagedLaps([]);
          setTelemetryData([]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadDrivers();
    return () => {
      mounted = false;
    };
  }, [selectedSession]);

  // --- HANDLERS ---
  const handleYearChange = async (year: number) => {
    if (year === selectedYear) return;
    setSelectedYear(year);
    setLoadingSessions(true);
    setSelectedSession(null);
    setSessions([]);

    try {
      const newSessions = await getSessions(year);
      setSessions(newSessions);
      if (newSessions.length > 0) setSelectedSession(newSessions[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRefreshSessions = async () => {
    setLoadingSessions(true);
    try {
      const freshSessions = await getSessions(selectedYear);
      setSessions(freshSessions);
      if (selectedSession) {
        const stillExists = freshSessions.find(
          (s) => s.session_key === selectedSession.session_key,
        );
        if (stillExists) setSelectedSession(stillExists);
      } else if (freshSessions.length > 0) {
        setSelectedSession(freshSessions[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleToggleDriver = (driver: Driver) => {
    const exists = selectedDrivers.find(
      (d) => d.driver_number === driver.driver_number,
    );
    if (exists) {
      setSelectedDrivers((prev) =>
        prev.filter((d) => d.driver_number !== driver.driver_number),
      );
      setLapsData((prev) => {
        const next = new Map(prev);
        next.delete(driver.driver_number);
        return next;
      });
      setStagedLaps((prev) =>
        prev.filter((sl) => sl.driver.driver_number !== driver.driver_number),
      );
    } else {
      if (selectedDrivers.length < 6)
        setSelectedDrivers((prev) => [...prev, driver]);
    }
  };

  const loadLapHistory = useCallback(async () => {
    if (!selectedSession || selectedDrivers.length === 0) return;
    setLoadingLaps(true);
    const newLapsMap = new Map<number, Lap[]>();
    try {
      await Promise.all(
        selectedDrivers.map(async (d) => {
          const laps = await getLaps(
            selectedSession.session_key,
            d.driver_number,
          );
          const validLaps = laps.filter((l) => l.lap_duration > 0);
          newLapsMap.set(d.driver_number, validLaps);
        }),
      );
      setLapsData(newLapsMap);
      setStagedLaps([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLaps(false);
    }
  }, [selectedSession, selectedDrivers]);

  useEffect(() => {
    if (isRandomizing && selectedDrivers.length > 0) {
      loadLapHistory();
      setIsRandomizing(false);
    }
  }, [selectedDrivers, isRandomizing, loadLapHistory]);

  const syncTelemetry = async () => {
    if (!selectedSession || stagedLaps.length === 0) return;
    setLoadingTelemetry(true);

    try {
      const inputs = await Promise.all(
        stagedLaps.map(async (sl) => {
          const { driver, lap } = sl;
          const buffer = 1.5;
          const startTime = new Date(
            new Date(lap.date_start).getTime() - 1500,
          ).toISOString();
          const endTime = new Date(
            new Date(lap.date_start).getTime() +
              (lap.lap_duration + buffer) * 1000,
          ).toISOString();

          const data = await getCarTelemetry(
            selectedSession.session_key,
            driver.driver_number,
            startTime,
            endTime,
          );

          const traceId = `${driver.name_acronym}_L${lap.lap_number}`;
          return {
            driver,
            data,
            lapStartDate: lap.date_start,
            lapDuration: lap.lap_duration,
            traceId,
          };
        }),
      );

      const validInputs = inputs.filter((i) => i.data && i.data.length > 0);
      if (validInputs.length > 0) {
        const circuitLength = selectedSession
          ? CIRCUIT_LENGTHS[selectedSession.circuit_key]
          : undefined;
        const processed = processTelemetryData(validInputs, circuitLength);
        setTelemetryData(processed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const handleRandomize = useCallback(async () => {
    setLoadingSessions(true);
    setSelectedDrivers([]);
    setLapsData(new Map());
    setStagedLaps([]);
    setTelemetryData([]);
    setIsRandomizing(true);
    try {
      const randomYear =
        AVAILABLE_YEARS[Math.floor(Math.random() * AVAILABLE_YEARS.length)];
      const allSessions = await getSessions(randomYear);
      const qualifyingSessions = allSessions.filter(
        (s) => s.session_name === "Qualifying",
      );

      if (qualifyingSessions.length === 0) {
        setLoadingSessions(false);
        setIsRandomizing(false);
        return;
      }

      const randomSession =
        qualifyingSessions[
          Math.floor(Math.random() * qualifyingSessions.length)
        ];
      const count = Math.floor(Math.random() * 3) + 2;

      pendingRandomCountRef.current = count;
      setSelectedYear(randomYear);
      setSessions(allSessions);
      setSelectedSession(randomSession);
    } catch (e) {
      console.error(e);
      setIsRandomizing(false);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const stagePBLaps = () => {
    const newStaged = [...stagedLaps];
    selectedDrivers.forEach((d) => {
      if (newStaged.length >= MAX_LAPS) return;
      const laps = lapsData.get(d.driver_number) || [];
      if (laps.length > 0) {
        const pb = [...laps].sort((a, b) => a.lap_duration - b.lap_duration)[0];
        const id = `${d.driver_number}_${pb.lap_number}`;
        if (!newStaged.find((s) => s.id === id)) {
          newStaged.push({ id, driver: d, lap: pb, color: "" });
        }
      }
    });
    setStagedLaps(newStaged);
  };

  /**
   * CRITICAL FIX: Stabilized with useCallback.
   * Prevents chart re-renders while ApexCharts is processing click events.
   * Includes async scrollIntoView to prevent null reference errors.
   */
  const handleToggleLap = useCallback((driver: Driver, lap: Lap) => {
    const id = `${driver.driver_number}_${lap.lap_number}`;

    setStagedLaps((prev) => {
      const existsIdx = prev.findIndex((s) => s.id === id);

      if (existsIdx >= 0) {
        // Remove Lap
        const newStaged = [...prev];
        newStaged.splice(existsIdx, 1);
        return newStaged;
      } else {
        // Add Lap
        if (prev.length < MAX_LAPS) {
          // Async scroll: Wait for DOM to update
          setTimeout(() => {
            const el = document.getElementById(`staged-lap-${id}`);
            if (el && typeof el.scrollIntoView === "function") {
              el.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }, 100);

          return [...prev, { id, driver, lap, color: "" }];
        }
        return prev;
      }
    });
  }, []);

  // --- MEMOIZED DERIVED STATE ---
  const isHistorySynced = useMemo(() => {
    if (loadingLaps || selectedDrivers.length === 0) return false;
    return selectedDrivers.every(
      (d) =>
        lapsData.has(d.driver_number) &&
        (lapsData.get(d.driver_number)?.length || 0) > 0,
    );
  }, [selectedDrivers, lapsData, loadingLaps]);

  const allTelemetryColors = useMemo(
    () => getTeamColors(stagedLaps.map((s) => s.driver)),
    [stagedLaps],
  );

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-white font-sans flex flex-col overflow-x-hidden selection:bg-f1-red/30">
      {/* HEADER: Solid, No dots, High Z-Index, Sticky */}
      <header className="sticky top-0 z-50 w-full bg-[#09090b] border-b border-white/5 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-f1-red rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(255,30,0,0.5)]">
            <span className="font-mono font-bold text-white text-lg">S</span>
          </div>
          <div className="flex flex-col leading-none">
            <h1 className="font-sans text-xl font-bold tracking-tight text-white uppercase">
              StintLogic<span className="text-f1-red">.com</span>
            </h1>
            <span className="text-[9px] text-f1-muted uppercase tracking-[0.25em]">
              Telemetry Lab
            </span>
          </div>
        </div>
      </header>

      {/* MAIN BODY: Dot pattern background */}
      <main className="flex-1 w-full p-6 space-y-6 bg-[#09090b] bg-[radial-gradient(#ffffff08_1px,#09090b_1px)] [background-size:20px_20px]">
        <div className="container mx-auto">
          <SessionSelector
            years={AVAILABLE_YEARS}
            selectedYear={selectedYear}
            onSelectYear={handleYearChange}
            sessions={sessions}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            isLoading={loadingSessions}
            onRandomize={handleRandomize}
            onRefresh={handleRefreshSessions}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
            {/* SIDEBAR */}
            <aside className="lg:col-span-1 space-y-8">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-f1-muted mb-4 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  Driver Selection
                </h2>
                <DriverSelector
                  allDrivers={allDrivers}
                  selectedDrivers={selectedDrivers}
                  onToggleDriver={handleToggleDriver}
                  maxSelection={6}
                />
              </div>

              {/* ACTION BUTTON */}
              {isHistorySynced && !loadingLaps ? (
                <div className="w-full py-4 px-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center justify-center gap-3 shadow-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    History Synced
                  </span>
                </div>
              ) : (
                <button
                  onClick={loadLapHistory}
                  disabled={selectedDrivers.length === 0 || loadingLaps}
                  className={`w-full py-4 font-bold text-xs uppercase tracking-widest rounded-lg shadow-lg disabled:opacity-50 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2
                                    ${
                                      loadingLaps
                                        ? "bg-white/5 border border-white/10 text-f1-muted cursor-wait"
                                        : "bg-f1-red text-white hover:bg-red-600 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                                    }`}
                >
                  {loadingLaps ? "FETCHING..." : "SYNC LAP HISTORY"}
                </button>
              )}
            </aside>

            {/* MAIN CONTENT */}
            <div className="lg:col-span-3">
              {lapsData.size > 0 && selectedDrivers.length > 0 ? (
                <div className="space-y-6">
                  <LapHistoryChart
                    selectedDrivers={selectedDrivers}
                    lapsData={lapsData}
                    stagedLaps={stagedLaps}
                    onToggleLap={handleToggleLap}
                    colors={[]}
                  />
                </div>
              ) : (
                <div className="h-[400px] border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center bg-transparent">
                  <span className="text-slate-600 font-mono text-xs uppercase tracking-[0.2em] font-medium">
                    Select drivers to initialize lab
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* TELEMETRY SECTIONS (FULL WIDTH) */}
          {lapsData.size > 0 && selectedDrivers.length > 0 && (
            <div className="w-full space-y-6">
              {/* STAGED LAPS CONTROL */}
              <div className="bg-[#121218] border border-white/5 p-6 rounded-lg shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-1">
                      Telemetry Inputs
                    </h3>
                    <span className="text-[10px] text-f1-muted">
                      Comparing {stagedLaps.length}/{MAX_LAPS} laps
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStagedLaps([])}
                      disabled={stagedLaps.length === 0}
                      className="px-3 py-1.5 text-[10px] font-bold uppercase text-f1-muted hover:text-white transition-colors disabled:opacity-30"
                    >
                      Reset
                    </button>
                    <button
                      onClick={stagePBLaps}
                      disabled={stagedLaps.length >= MAX_LAPS}
                      className="px-4 py-2 bg-white/5 text-white text-[10px] font-bold uppercase rounded hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50 border border-white/10"
                    >
                      + Add Fastest Laps
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 relative z-10">
                  <AnimatePresence>
                    {stagedLaps.map((sl, index) => {
                      const teamColor =
                        allTelemetryColors[index] || FALLBACK_COLOR.primary;
                      return (
                        <motion.div
                          key={sl.id}
                          id={`staged-lap-${sl.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative bg-white/5 border border-white/5 p-3 rounded group hover:border-white/20 transition-all cursor-pointer"
                          onClick={() => handleToggleLap(sl.driver, sl.lap)}
                        >
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l`}
                            style={{ backgroundColor: teamColor }}
                          ></div>
                          <div className="pl-3">
                            <div className="flex justify-between">
                              <div className="text-[10px] text-f1-muted font-bold uppercase">
                                {sl.driver.name_acronym}
                              </div>
                              <div className="text-[9px] text-f1-muted">
                                L{sl.lap.lap_number}
                              </div>
                            </div>
                            <div className="text-sm font-mono text-white font-bold tracking-tight">
                              {formatLapTime(sl.lap.lap_duration)}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {stagedLaps.length === 0 && (
                    <div className="col-span-full h-24 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center bg-transparent">
                      <span className="text-slate-600 font-mono text-xs uppercase tracking-[0.2em] font-medium">
                        Select Laps from History to Compare Telemetry
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={syncTelemetry}
                  disabled={stagedLaps.length === 0 || loadingTelemetry}
                  className="w-full py-3 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 relative z-10"
                >
                  {loadingTelemetry ? "PROCESSING..." : "ANALYZE TELEMETRY"}
                </button>
              </div>

              {/* TELEMETRY CHARTS */}
              {telemetryData.length > 0 && (
                <div className="space-y-4 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                      Data Trace
                    </h2>
                    <div className="h-px bg-white/10 flex-1"></div>
                  </div>

                  <TelemetrySingleChart
                    title="Delta Analysis"
                    data={telemetryData}
                    dataKey="delta"
                    stagedLaps={stagedLaps}
                  />
                  <TelemetrySingleChart
                    title="Speed"
                    data={telemetryData}
                    dataKey="speed"
                    stagedLaps={stagedLaps}
                  />
                  <TelemetrySingleChart
                    title="Throttle"
                    data={telemetryData}
                    dataKey="throttle"
                    stagedLaps={stagedLaps}
                  />
                  <TelemetrySingleChart
                    title="Braking"
                    data={telemetryData}
                    dataKey="brake"
                    stagedLaps={stagedLaps}
                  />
                  <TelemetrySingleChart
                    title="RPM"
                    data={telemetryData}
                    dataKey="rpm"
                    stagedLaps={stagedLaps}
                  />
                  <TelemetrySingleChart
                    title="Gear"
                    data={telemetryData}
                    dataKey="gear"
                    stagedLaps={stagedLaps}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
