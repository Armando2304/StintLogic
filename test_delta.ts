import { getCarTelemetry } from './services/openf1Service';

async function run() {
    // get some session data
    const res = await fetch('https://api.openf1.org/v1/sessions?year=2023&circuit_short_name=Zandvoort');
    const sessions = await res.json();
    const quali = sessions.find((s: any) => s.session_type === 'Qualifying');
    const sessionKey = quali.session_key;
    
    // Get Lando Norris lap 
    const lapResNOR = await fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}&driver_number=4`);
    const lapsNOR = await lapResNOR.json();
    const fastLapNOR = lapsNOR.find((l: any) => l.lap_duration && l.lap_duration < 80); // 1:11.162 is 71.162s
    
    // Get Charles Leclerc lap
    const lapResLEC = await fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}&driver_number=16`);
    const lapsLEC = await lapResLEC.json();
    const fastLapLEC = lapsLEC.find((l: any) => l.lap_duration && l.lap_duration < 80); // 1:11.558 is 71.558s

    const getTelemetry = async (lap: any, driverNum: number) => {
        const startTime = new Date(new Date(lap.date_start).getTime() - 1000).toISOString();
        const endTime = new Date(new Date(lap.date_start).getTime() + (lap.lap_duration + 1.0) * 1000).toISOString();
        const carData = await getCarTelemetry(sessionKey, driverNum, startTime, endTime);
        const sortedData = [...carData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const lapStartEpoch = new Date(lap.date_start).getTime();
        
        let cumDist = 0;
        let prevTime = -1;
        const processed = [];
        
        for (let i = 0; i < sortedData.length; i++) {
            const d = sortedData[i];
            const t = (new Date(d.date).getTime() - lapStartEpoch) / 1000;
            
            if (t >= 0 && t <= lap.lap_duration) {
                if (prevTime === -1) {
                    prevTime = t;
                    processed.push({ t, dist: 0 });
                    continue;
                }
                const dt = t - prevTime;
                const speedMs = d.speed / 3.6;
                cumDist += speedMs * dt;
                processed.push({ t, dist: cumDist });
                prevTime = t;
            }
        }
        return { lap, processed, finalDist: cumDist };
    };

    const nor = await getTelemetry(fastLapNOR, 4);
    const lec = await getTelemetry(fastLapLEC, 16);
    
    console.log("NOR dist:", nor.finalDist, "duration:", nor.lap.lap_duration);
    console.log("LEC dist:", lec.finalDist, "duration:", lec.lap.lap_duration);
}
run().catch(console.error);
