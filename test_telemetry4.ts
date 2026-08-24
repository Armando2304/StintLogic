import fs from 'fs';
import { getCarTelemetry, getLocationData } from './services/openf1Service';

async function run() {
    const sessionKey = 9158;
    const driverNumber = 1;
    const dateStart = "2023-09-15T09:33:40.496000+00:00";
    const lapDuration = 98.169;
    const buffer = 1.5;
    const startTime = new Date(new Date(dateStart).getTime() - 1500).toISOString();
    const endTime = new Date(new Date(dateStart).getTime() + (lapDuration + buffer) * 1000).toISOString();
    
    const locData = await getLocationData(sessionKey, driverNumber, startTime, endTime);
    const lapStartEpoch = new Date(dateStart).getTime();
    const sortedLoc = [...locData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let locTimes: number[] = [];
    let locDists: number[] = [];
    let cumulativeDist = 0;
    
    for (let i = 0; i < sortedLoc.length; i++) {
        const loc = sortedLoc[i];
        const t = (new Date(loc.date).getTime() - lapStartEpoch) / 1000;
        
        if (i > 0) {
            const prevLoc = sortedLoc[i-1];
            const dx = loc.x - prevLoc.x;
            const dy = loc.y - prevLoc.y;
            const distDelta = Math.sqrt(dx * dx + dy * dy);
            
            const timeDelta = t - locTimes[locTimes.length - 1];
            if (timeDelta > 0) {
                // Remove physics filter for testing
                cumulativeDist += distDelta;
            } else if (timeDelta <= 0) {
                continue;
            }
        }
        
        locTimes.push(t);
        locDists.push(cumulativeDist);
    }
    console.log("Total Distance:", cumulativeDist);
}
run().catch(console.error);
