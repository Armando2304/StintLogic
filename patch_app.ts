import fs from 'fs';
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /const \[data, locationData\] = await Promise\.all\(\[\s*getCarTelemetry[^\n]*,\s*getLocationData[^\n]*\s*\]\);/;
const newCode = `const data = await getCarTelemetry(selectedSession.session_key, driver.driver_number, startTime, endTime);`;

code = code.replace(regex, newCode);
code = code.replace('return { driver, data, locationData, lapStartDate: lap.date_start, lapDuration: lap.lap_duration, traceId };', 'return { driver, data, lapStartDate: lap.date_start, lapDuration: lap.lap_duration, traceId };');
code = code.replace(/import \{ getSessions, getDrivers, getLaps, getCarTelemetry, getLocationData, getLatestSession \} from '.\/services\/openf1Service';/, `import { getSessions, getDrivers, getLaps, getCarTelemetry, getLatestSession } from './services/openf1Service';`);

fs.writeFileSync('App.tsx', code);
