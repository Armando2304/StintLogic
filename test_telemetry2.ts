import { processTelemetryData } from './utils/telemetryUtils';
import { getCarTelemetry, getLocationData } from './services/openf1Service';

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
    
    console.log("Raw CarData points:", data.length);
    console.log("Raw LocData points:", locData.length);
}
run().catch(console.error);
