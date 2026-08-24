import fs from 'fs';
let code = fs.readFileSync('utils/telemetryUtils.ts', 'utf8');

const regex = /\/\/ 3\. Iterate over REFERENCE points \(Master Axis\)\n\s*for \(let i = 0; i < refPoints\.length; i\+\+\) \{[\s\S]*?return combinedData;\n\};/m;

const replacement = `// 3. Iterate over REFERENCE points (Master Axis)
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
      row[\`speed_\${id}\`] = Math.round(
        interpolate(dist, trace.dists, trace.speeds),
      );
      row[\`rpm_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.rpms));
      row[\`throttle_\${id}\`] = Math.round(
        interpolate(dist, trace.dists, trace.throttles),
      );
      row[\`brake_\${id}\`] = Math.round(
        interpolate(dist, trace.dists, trace.brakes),
      );

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
  
  // 4. Force a final exact point at refTotalDist to ensure graphs reach the very end cleanly
  if (combinedData.length > 0) {
      const lastDist = combinedData[combinedData.length - 1].distance;
      if (lastDist < refTotalDist - 1) { // If missing by more than 1 meter
          const dist = refTotalDist;
          const row: any = { distance: dist };
          tracesData.forEach((trace) => {
              const id = trace.id;
              row[\`speed_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.speeds));
              row[\`rpm_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.rpms));
              row[\`throttle_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.throttles));
              row[\`brake_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.brakes));
              row[\`gear_\${id}\`] = Math.round(interpolate(dist, trace.dists, trace.gears));
              row[\`drs_\${id}\`] = interpolate(dist, trace.dists, trace.drs) > 8 ? 1 : 0;
              
              if (id === refInput.traceId) {
                  row[\`delta_\${id}\`] = 0;
                  row[\`time_\${id}\`] = refTotalTime;
              } else {
                  const compTime = interpolate(dist, trace.dists, trace.times);
                  const refTime = refTotalTime;
                  const rawDelta = compTime - refTime;
                  const driftCorrection = trace.drift * (dist / refTotalDist);
                  row[\`delta_\${id}\`] = rawDelta + driftCorrection;
                  row[\`time_\${id}\`] = compTime;
              }
          });
          combinedData.push(row);
      }
  }

  return combinedData;
};`

if (!regex.test(code)) {
    console.error("Regex did not match");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('utils/telemetryUtils.ts', code);
