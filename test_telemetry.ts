import { processTelemetryData } from './utils/telemetryUtils';
import { getCarTelemetry, getLocationData } from './services/openf1Service';

async function run() {
    const sessionKey = 9158;
    const driverNumber = 1;
    // from earlier curl: "date_start": "2023-09-15T09:33:40.496000+00:00"
    // lap duration: 98.169
    const dateStart = "2023-09-15T09:33:40.496000+00:00";
    const lapDuration = 98.169;
    const buffer = 1.5;
    const startTime = new Date(new Date(dateStart).getTime() - 1500).toISOString();
    const endTime = new Date(new Date(dateStart).getTime() + (lapDuration + buffer) * 1000).toISOString();
    
    console.log("Fetching car data", startTime, endTime);
    const data = await getCarTelemetry(sessionKey, driverNumber, startTime, endTime);
    console.log("Fetching location data");
    const locData = await getLocationData(sessionKey, driverNumber, startTime, endTime);
    
    const input = {
        driver: { driver_number: 1, name_acronym: 'VER', broadcast_name: 'M VERSTAPPEN' } as any,
        data,
        locationData: locData,
        lapStartDate: dateStart,
        lapDuration,
        traceId: "VER_L2"
    };
    
    const processed = processTelemetryData([input]);
    console.log("Result length:", processed.length);
}
run().catch(console.error);
