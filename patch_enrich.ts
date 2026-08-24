import fs from 'fs';
let code = fs.readFileSync('utils/telemetryUtils.ts', 'utf8');

const regex = /const enrichAndSanitize = \([\s\S]*?\n\s*return \{\n\s*processed: cleanPoints,\n\s*totalDist: finalDist,\n\s*totalTime: cleanPoints\[cleanPoints\.length - 1\]\.relativeTime,\n\s*\};\n\};/m;

const replacement = `const enrichAndSanitize = (
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
    if (rawPoints[i].relativeTime <= 0 && rawPoints[i+1].relativeTime >= 0) {
      const t0 = rawPoints[i].relativeTime;
      const t1 = rawPoints[i+1].relativeTime;
      const d0 = rawPoints[i].calculatedDistance;
      const d1 = rawPoints[i+1].calculatedDistance;
      if (t1 > t0) {
        distAtZero = d0 + (0 - t0) * (d1 - d0) / (t1 - t0);
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
      if (cleanPoints[i].relativeTime <= lapDuration && cleanPoints[i+1].relativeTime >= lapDuration) {
          const t0 = cleanPoints[i].relativeTime;
          const t1 = cleanPoints[i+1].relativeTime;
          const d0 = cleanPoints[i].calculatedDistance;
          const d1 = cleanPoints[i+1].calculatedDistance;
          if (t1 > t0) {
              exactFinalDist = d0 + (lapDuration - t0) * (d1 - d0) / (t1 - t0);
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
};`;

if (!regex.test(code)) {
    console.error("Regex did not match");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('utils/telemetryUtils.ts', code);
