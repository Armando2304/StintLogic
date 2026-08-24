import { processTelemetryData } from './utils/telemetryUtils';
import { getCarTelemetry, getLocationData } from './services/openf1Service';
import fs from 'fs';

async function run() {
    const sessionKey = 9158;
    const driverNumber = 1;
    const dateStart = "2023-09-15T09:33:40.496000+00:00";
    const lapDuration = 98.169;
    const buffer = 1.5;
    const startTime = new Date(new Date(dateStart).getTime() - 1500).toISOString();
    const endTime = new Date(new Date(dateStart).getTime() + (lapDuration + buffer) * 1000).toISOString();
    
    const data = await getCarTelemetry(sessionKey, driverNumber, startTime, endTime);
    const locData = await getLocationData(sessionKey, driverNumber, startTime, endTime);
    
    const lapStartEpoch = new Date(dateStart).getTime();
    
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedLoc = [...locData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const locTimes: number[] = [];
    const locDists: number[] = [];
    let cumulativeDist = 0;
    
    let skips = 0;
    for (let i = 0; i < sortedLoc.length; i++) {
        const loc = sortedLoc[i];
        const t = (new Date(loc.date).getTime() - lapStartEpoch) / 1000;
        
        if (i > 0) {
            const prevLoc = sortedLoc[i-1];
            const dx = loc.x - prevLoc.x;
            const dy = loc.y - prevLoc.y;
            const distDelta = Math.sqrt(dx * dx + dy * dy);
            
            const timeDelta = t - locTimes[locTimes.length - 1];
            if (timeDelta > 0 && (distDelta / timeDelta) < 150) {
                cumulativeDist += distDelta;
            } else if (timeDelta <= 0) {
                skips++;
                continue;
            }
        }
        
        locTimes.push(t);
        locDists.push(cumulativeDist);
    }
    console.log("locTimes length:", locTimes.length, "skips:", skips);
    console.log("last dist:", locDists[locDists.length-1]);
    
    const rawPoints = [];
    
    const interpolate = (x: number, xPoints: number[], yPoints: number[]): number => {
        if (xPoints.length === 0) return 0;
        if (x <= xPoints[0]) return yPoints[0];
        const len = xPoints.length;
        if (x >= xPoints[len - 1]) return yPoints[len - 1];
    
        let low = 0, high = len - 1;
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
    
        return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
    };

    for (let i = 0; i < sortedData.length; i++) {
        const d = sortedData[i];
        const t = (new Date(d.date).getTime() - lapStartEpoch) / 1000;
        
        if (t >= -2.0 && t <= lapDuration + 2.0) {
            const dist = interpolate(t, locTimes, locDists);
            rawPoints.push({ ...d, calculatedDistance: dist, relativeTime: t });
        }
    }
    
    console.log("rawPoints length:", rawPoints.length);

    let zeroRefIndex = rawPoints.findIndex(p => p.relativeTime >= 0);
    if (zeroRefIndex === -1) zeroRefIndex = 0;

    const originDist = rawPoints[zeroRefIndex].calculatedDistance;
    const originTime = rawPoints[zeroRefIndex].relativeTime;

    let maxDist = -1;
    let maxTime = -1;
    const cleanPoints = [];
    
    let monoSkips = 0;
    for (const p of rawPoints) {
        const relDist = p.calculatedDistance - originDist;
        const relTime = p.relativeTime - originTime;

        if (relDist > maxDist + 0.001 && relTime > maxTime + 0.001) {
            maxDist = relDist;
            maxTime = relTime;
            
            cleanPoints.push({
                ...p,
                calculatedDistance: relDist,
                relativeTime: relTime
            });
        } else {
            monoSkips++;
            if (monoSkips < 5) console.log("skipped relDist:", relDist, "maxDist:", maxDist, "relTime:", relTime, "maxTime:", maxTime);
        }
    }
    console.log("cleanPoints length:", cleanPoints.length, "monoSkips:", monoSkips);
}
run().catch(console.error);
