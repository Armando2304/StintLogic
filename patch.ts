import fs from 'fs';
let code = fs.readFileSync('utils/telemetryUtils.ts', 'utf8');

// Replace enrichAndSanitize completely
const regex = /const enrichAndSanitize = \(data: CarData\[\], locationData: LocationData\[\], lapStartDate: string, lapDuration: number, knownTrackLength\?: number\) => \{[\s\S]*?\/\/ --- MAIN PIPELINE EXPORT ---/m;

const newFunc = `const enrichAndSanitize = (data: CarData[], lapStartDate: string, lapDuration: number, knownTrackLength?: number) => {
    const len = data.length;
    if (len === 0) return null;
    
    // Sort chronologically
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lapStartEpoch = new Date(lapStartDate).getTime();
    
    const rawPoints = [];
    let cumulativeDist = 0;
    let prevTime = -1;
    
    for (let i = 0; i < len; i++) {
        const d = sortedData[i];
        const t = (new Date(d.date).getTime() - lapStartEpoch) / 1000;
        
        // Filter to slightly wider than lap window
        if (t >= -2.0 && t <= lapDuration + 2.0) {
            if (prevTime === -1) {
                prevTime = t;
            } else {
                const dt = t - prevTime;
                if (dt > 0) {
                    // Speed is in km/h, convert to m/s
                    const speedMs = d.speed / 3.6;
                    cumulativeDist += speedMs * dt;
                }
                prevTime = t;
            }
            rawPoints.push({ ...d, calculatedDistance: cumulativeDist, relativeTime: t });
        }
    }
    
    if (rawPoints.length < 10) return null;

    // 2. Monotonicity Enforcement
    const cleanPoints: ProcessedCarData[] = [];
    
    let zeroRefIndex = rawPoints.findIndex(p => p.relativeTime >= 0);
    if (zeroRefIndex === -1) zeroRefIndex = 0;
    
    const originDist = rawPoints[zeroRefIndex].calculatedDistance;
    const originTime = rawPoints[zeroRefIndex].relativeTime;
    
    let maxDist = -Infinity;
    let maxTime = -Infinity;
    
    for (const p of rawPoints) {
        // Normalize
        const relDist = p.calculatedDistance - originDist;
        const relTime = p.relativeTime - originTime;
        
        if (relTime > lapDuration) {
            break; // Stop adding points once the lap finishes
        }

        // Strict increasing check (epsilon 0.001)
        if (relDist > maxDist + 0.001 && relTime > maxTime + 0.001) {
            maxDist = relDist;
            maxTime = relTime;
            
            cleanPoints.push({
                ...p,
                calculatedDistance: relDist,
                relativeTime: relTime
            });
        }
    }

    if (cleanPoints.length < 2) return null;
    
    let finalDist = cleanPoints[cleanPoints.length - 1].calculatedDistance;

    // Normalize to exact official track length if available
    if (knownTrackLength && finalDist > 0) {
        const scaleFactor = knownTrackLength / finalDist;
        for (const p of cleanPoints) {
            p.calculatedDistance *= scaleFactor;
        }
        finalDist = knownTrackLength;
    }

    return {
        processed: cleanPoints,
        totalDist: finalDist,
        totalTime: cleanPoints[cleanPoints.length - 1].relativeTime
    };
};

/**
 * STEP 2 & 3: Master Axis Resampling & Bias Corrected Delta
 */
const buildFastF1Grid = (
    inputs: { traceId: string; processed: ProcessedCarData[]; totalDist: number; totalTime: number }[]
) => {
    if (inputs.length === 0) return [];
    
    // 1. Identify Reference (First Selected Lap)
    const refIndex = 0;
    const refInput = inputs[refIndex];
    const refPoints = refInput.processed;
    const refTotalTime = refInput.totalTime;
    const refTotalDist = refInput.totalDist;

    // 2. Prepare Interpolation Sources
    const tracesData = inputs.map(input => {
        const dists = input.processed.map(p => p.calculatedDistance);
        const times = input.processed.map(p => p.relativeTime);
        
        // Calculate drift for bias correction
        const trueGap = input.totalTime - refTotalTime;
        const compTimeAtEnd = interpolate(refTotalDist, dists, times);
        const graphGap = compTimeAtEnd - refTotalTime;
        const drift = trueGap - graphGap;

        return {
            id: input.traceId,
            dists,
            times,
            speeds: input.processed.map(p => p.speed),
            rpms: input.processed.map(p => p.rpm),
            gears: input.processed.map(p => p.n_gear),
            throttles: input.processed.map(p => p.throttle),
            brakes: input.processed.map(p => p.brake),
            drs: input.processed.map(p => p.drs),
            actualTotalTime: input.totalTime,
            drift
        };
    });

    const combinedData = [];

    // 3. Iterate over REFERENCE points (Master Axis)
    for (let i = 0; i < refPoints.length; i++) {
        const refP = refPoints[i];
        const dist = refP.calculatedDistance;
        
        // Limit to positive distance
        if (dist < 0) continue;

        const row: any = { distance: dist };

        tracesData.forEach(trace => {
            const id = trace.id;

            // A. Interpolate Basic Telemetry at Reference Distance
            row[\`speed_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.speeds));
            row[\`rpm_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.rpms));
            row[\`throttle_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.throttles));
            row[\`brake_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.brakes));
            
            // Discrete values: Round to nearest
            const gear = interpolate(dist, trace.dists, trace.gears);
            row[\`gear_\${id}\`] = Math.round(gear);

            const drs = interpolate(dist, trace.dists, trace.drs);
            row[\`drs_\${id}\`] = drs > 8 ? 1 : 0;

            // B. Calculate Delta
            if (id === refInput.traceId) {
                row[\`delta_\${id}\`] = 0;
                row[\`time_\${id}\`] = refP.relativeTime;
            } else {
                // 1. Interpolate Comparison Time at this Distance
                const compTime = interpolate(dist, trace.dists, trace.times);
                const refTime = refP.relativeTime;
                
                // 2. Raw Delta
                // Delta logic: Negative delta means the comparison lap is faster (took less time).
                const rawDelta = compTime - refTime;
                
                // 3. Bias Correction
                const driftCorrection = trace.drift * (dist / refTotalDist);
                
                row[\`delta_\${id}\`] = rawDelta + driftCorrection;
                row[\`time_\${id}\`] = compTime;
            }
        });

        combinedData.push(row);
    }

    return combinedData;
};

// --- MAIN PIPELINE EXPORT ---
`;

code = code.replace(regex, newFunc);
fs.writeFileSync('utils/telemetryUtils.ts', code);
