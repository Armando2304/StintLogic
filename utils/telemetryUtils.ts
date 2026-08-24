import { CarData, Driver, LocationData } from "../types";

export interface ProcessedCarData extends CarData {
  calculatedDistance: number;
  relativeTime: number; // Seconds from start of lap (strictly 0-based)
}

// --- EXPORTED UTILS ---

export const formatLapTime = (seconds: number): string => {
  if (typeof seconds !== "number" || isNaN(seconds)) return "0:00.000";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
};

// --- INTERNAL HELPERS ---

/**
 * Robust Linear Interpolation (FastF1 style)
 */
const interpolate = (
  x: number,
  xPoints: number[],
  yPoints: number[],
): number => {
  if (xPoints.length === 0) return 0;
  if (x <= xPoints[0]) return yPoints[0];
  const len = xPoints.length;
  if (x >= xPoints[len - 1]) return yPoints[len - 1];

  let low = 0,
    high = len - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (xPoints[mid] < x) low = mid + 1;
    else high = mid;
  }

  const i = low > 0 ? low - 1 : 0;
  const x0 = xPoints[i];
  const x1 = xPoints[i + 1];
  const y0 = yPoints[i];
  const y1 = yPoints[i + 1];

  if (x1 - x0 === 0) return y0;

  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
};

/**
 * STEP 1: Enrich & Sanitize (Monotonicity Check)
 * Calculates Distance via Integration and enforces strictly increasing distance/time.
 */
const enrichAndSanitize = (
  data: CarData[],
  lapStartDate: string,
  lapDuration: number,
  knownTrackLength?: number,
) => {
  const len = data.length;
  if (len === 0) return null;

  // Sort chronologically
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const lapStartEpoch = new Date(lapStartDate).getTime();

  const rawPoints = [];
  let cumulativeDist = 0;
  let prevTime = -1;
  let prevSpeedMs = -1;

  for (let i = 0; i < len; i++) {
    const d = sortedData[i];
    const t = (new Date(d.date).getTime() - lapStartEpoch) / 1000;

    // Filter to slightly wider than lap window
    if (t >= -2.0 && t <= lapDuration + 2.0) {
      const speedMs = d.speed / 3.6;
      if (prevTime === -1) {
        prevTime = t;
        prevSpeedMs = speedMs;
      } else {
        const dt = t - prevTime;
        if (dt > 0) {
          // Trapezoidal integration for higher precision
          cumulativeDist += ((speedMs + prevSpeedMs) / 2) * dt;
        }
        prevTime = t;
        prevSpeedMs = speedMs;
      }

      rawPoints.push({
        ...d,
        calculatedDistance: cumulativeDist,
        relativeTime: t,
      });
    }
  }

  if (rawPoints.length < 10) return null;

  // 1.5 Find exact distance at t=0
  let distAtZero = 0;
  for (let i = 0; i < rawPoints.length - 1; i++) {
    if (rawPoints[i].relativeTime <= 0 && rawPoints[i + 1].relativeTime >= 0) {
      const t0 = rawPoints[i].relativeTime;
      const t1 = rawPoints[i + 1].relativeTime;
      const d0 = rawPoints[i].calculatedDistance;
      const d1 = rawPoints[i + 1].calculatedDistance;
      if (t1 > t0) {
        distAtZero = d0 + ((0 - t0) * (d1 - d0)) / (t1 - t0);
      } else {
        distAtZero = d0;
      }
      break;
    }
  }

  // 2. Monotonicity Enforcement
  const cleanPoints: ProcessedCarData[] = [];
  let maxDist = -Infinity;
  let maxTime = -Infinity;

  for (const p of rawPoints) {
    // Offset distance so that exactly at t=0, distance is 0. Do NOT offset time.
    const relDist = p.calculatedDistance - distAtZero;
    const relTime = p.relativeTime;

    // We only care about the lap duration window roughly, plus a tiny margin for interpolation
    if (relTime > lapDuration + 1.0) {
      break;
    }

    // Strict increasing check
    if (relDist > maxDist && relTime > maxTime) {
      maxDist = relDist;
      maxTime = relTime;

      cleanPoints.push({
        ...p,
        calculatedDistance: relDist,
        relativeTime: relTime,
      });
    }
  }

  if (cleanPoints.length < 2) return null;

  // Find exact final distance at t = lapDuration
  let finalDist = cleanPoints[cleanPoints.length - 1].calculatedDistance;
  let exactFinalDist = finalDist;

  for (let i = cleanPoints.length - 2; i >= 0; i--) {
    if (
      cleanPoints[i].relativeTime <= lapDuration &&
      cleanPoints[i + 1].relativeTime >= lapDuration
    ) {
      const t0 = cleanPoints[i].relativeTime;
      const t1 = cleanPoints[i + 1].relativeTime;
      const d0 = cleanPoints[i].calculatedDistance;
      const d1 = cleanPoints[i + 1].calculatedDistance;
      if (t1 > t0) {
        exactFinalDist = d0 + ((lapDuration - t0) * (d1 - d0)) / (t1 - t0);
      }
      break;
    }
  }

  // Normalize to exact official track length if available
  if (knownTrackLength && exactFinalDist > 0) {
    const scaleFactor = knownTrackLength / exactFinalDist;
    for (const p of cleanPoints) {
      p.calculatedDistance *= scaleFactor;
    }
    exactFinalDist = knownTrackLength;
  }

  return {
    processed: cleanPoints,
    totalDist: exactFinalDist,
    totalTime: lapDuration, // lapDuration is the official time
  };
};

/**
 * STEP 2 & 3: Master Axis Resampling & Bias Corrected Delta
 */
const buildFastF1Grid = (
  inputs: {
    traceId: string;
    processed: ProcessedCarData[];
    totalDist: number;
    totalTime: number;
  }[],
) => {
  if (inputs.length === 0) return [];

  // 1. Identify Reference (Fastest Lap)
  let refIndex = 0;
  let minTime = Infinity;
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].totalTime < minTime) {
      minTime = inputs[i].totalTime;
      refIndex = i;
    }
  }
  const refInput = inputs[refIndex];
  const refPoints = refInput.processed;
  const refTotalTime = refInput.totalTime;
  const refTotalDist = refInput.totalDist;

  // 2. Prepare Interpolation Sources
  const tracesData = inputs.map((input) => {
    const dists = input.processed.map((p) => p.calculatedDistance);
    const times = input.processed.map((p) => p.relativeTime);

    // Calculate drift for bias correction
    const trueGap = input.totalTime - refTotalTime;
    const compTimeAtEnd = interpolate(refTotalDist, dists, times);
    const graphGap = compTimeAtEnd - refTotalTime;
    const drift = trueGap - graphGap;

    return {
      id: input.traceId,
      dists,
      times,
      speeds: input.processed.map((p) => p.speed),
      rpms: input.processed.map((p) => p.rpm),
      gears: input.processed.map((p) => p.n_gear),
      throttles: input.processed.map((p) => p.throttle),
      brakes: input.processed.map((p) => p.brake),
      drs: input.processed.map((p) => p.drs),
      actualTotalTime: input.totalTime,
      drift,
    };
  });

  const combinedData = [];

  // 3. Iterate over REFERENCE points (Master Axis)
  for (let i = 0; i < refPoints.length; i++) {
    const refP = refPoints[i];
    const dist = refP.calculatedDistance;

    // Limit to positive distance and track length
    if (dist < 0) continue;
    if (dist > refTotalDist) break;

    const row: any = { distance: dist };

    tracesData.forEach((trace) => {
      const id = trace.id;

      // A. Interpolate Basic Telemetry at Reference Distance
      row[`speed_${id}`] = Math.round(
        interpolate(dist, trace.dists, trace.speeds),
      );
      row[`rpm_${id}`] = Math.round(interpolate(dist, trace.dists, trace.rpms));
      row[`throttle_${id}`] = Math.round(
        interpolate(dist, trace.dists, trace.throttles),
      );
      row[`brake_${id}`] = Math.round(
        interpolate(dist, trace.dists, trace.brakes),
      );

      // Discrete values: Round to nearest
      const gear = interpolate(dist, trace.dists, trace.gears);
      row[`gear_${id}`] = Math.round(gear);

      const drs = interpolate(dist, trace.dists, trace.drs);
      row[`drs_${id}`] = drs > 8 ? 1 : 0;

      // B. Calculate Delta
      if (id === refInput.traceId) {
        row[`delta_${id}`] = 0;
        row[`time_${id}`] = refP.relativeTime;
      } else {
        // 1. Interpolate Comparison Time at this Distance
        const compTime = interpolate(dist, trace.dists, trace.times);
        const refTime = refP.relativeTime;

        // 2. Raw Delta
        // Delta logic: Negative delta means the comparison lap is faster (took less time).
        const rawDelta = compTime - refTime;

        // 3. Bias Correction
        const driftCorrection = trace.drift * (dist / refTotalDist);

        row[`delta_${id}`] = rawDelta + driftCorrection;
        row[`time_${id}`] = compTime;
      }
    });

    combinedData.push(row);
  }
  
  // 4. Force a final exact point at refTotalDist to ensure graphs reach the very end cleanly
  if (combinedData.length > 0) {
      const lastDist = combinedData[combinedData.length - 1].distance;
      if (lastDist < refTotalDist - 1) { // If missing by more than 1 meter
          const dist = refTotalDist;
          const row: any = { distance: dist };
          tracesData.forEach((trace) => {
              const id = trace.id;
              row[`speed_${id}`] = Math.round(interpolate(dist, trace.dists, trace.speeds));
              row[`rpm_${id}`] = Math.round(interpolate(dist, trace.dists, trace.rpms));
              row[`throttle_${id}`] = Math.round(interpolate(dist, trace.dists, trace.throttles));
              row[`brake_${id}`] = Math.round(interpolate(dist, trace.dists, trace.brakes));
              row[`gear_${id}`] = Math.round(interpolate(dist, trace.dists, trace.gears));
              row[`drs_${id}`] = interpolate(dist, trace.dists, trace.drs) > 8 ? 1 : 0;
              
              if (id === refInput.traceId) {
                  row[`delta_${id}`] = 0;
                  row[`time_${id}`] = refTotalTime;
              } else {
                  const compTime = interpolate(dist, trace.dists, trace.times);
                  const refTime = refTotalTime;
                  const rawDelta = compTime - refTime;
                  const driftCorrection = trace.drift * (dist / refTotalDist);
                  row[`delta_${id}`] = rawDelta + driftCorrection;
                  row[`time_${id}`] = compTime;
              }
          });
          combinedData.push(row);
      }
  }

  return combinedData;
};

// --- MAIN PIPELINE EXPORT ---

export const processTelemetryData = (
  inputs: {
    driver: Driver;
    data: CarData[];
    lapStartDate: string;
    lapDuration: number;
    traceId: string;
  }[],
  circuitLength?: number,
) => {
  // 1. Enrich & Sanitize
  const enrichedInputs = [];
  for (const input of inputs) {
    const result = enrichAndSanitize(
      input.data,
      input.lapStartDate,
      input.lapDuration,
      circuitLength,
    );
    if (result) {
      enrichedInputs.push({
        traceId: input.traceId,
        processed: result.processed,
        totalDist: result.totalDist,
        totalTime: result.totalTime,
      });
    }
  }

  if (enrichedInputs.length === 0) return [];

  // 2. Resample & Delta
  return buildFastF1Grid(enrichedInputs);
};
