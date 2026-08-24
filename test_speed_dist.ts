import { getCarTelemetry, getLocationData } from './services/openf1Service';

async function run() {
    const sessionKey = 9158;
    const driverNumber = 1;
    const dateStart = "2023-09-15T09:33:40.496000+00:00";
    const lapDuration = 98.169;
    const buffer = 1.5;
    const startTime = new Date(new Date(dateStart).getTime() - 1500).toISOString();
    const endTime = new Date(new Date(dateStart).getTime() + (lapDuration + buffer) * 1000).toISOString();
    
    const carData = await getCarTelemetry(sessionKey, driverNumber, startTime, endTime);
    
    const sortedData = [...carData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let cumDist = 0;
    const lapStartEpoch = new Date(dateStart).getTime();
    
    // find index where lap starts
    let started = false;
    let prevTime = 0;
    
    for (let i = 0; i < sortedData.length; i++) {
        const d = sortedData[i];
        const t = (new Date(d.date).getTime() - lapStartEpoch) / 1000;
        
        if (t >= 0 && t <= lapDuration) {
            if (!started) {
                started = true;
                prevTime = t;
                continue;
            }
            const dt = t - prevTime;
            const speedMs = d.speed / 3.6;
            cumDist += speedMs * dt;
            prevTime = t;
        }
    }
    
    console.log("Total Distance from Speed Integration:", cumDist);
}
run().catch(console.error);
