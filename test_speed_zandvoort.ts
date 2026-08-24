import { getCarTelemetry } from './services/openf1Service';

async function run() {
    // 2023 Zandvoort Quali or FP? Let's use 2023 Zandvoort session.
    // Zandvoort circuit_key is usually 55, let's just get the session key for Zandvoort 2023 quali
    const res = await fetch('https://api.openf1.org/v1/sessions?year=2023&circuit_short_name=Zandvoort');
    const sessions = await res.json();
    const quali = sessions.find((s: any) => s.session_type === 'Qualifying');
    console.log("Session:", quali.session_key);
    
    // Get Lando Norris lap 
    const lapRes = await fetch(`https://api.openf1.org/v1/laps?session_key=${quali.session_key}&driver_number=4`);
    const laps = await lapRes.json();
    // find a fast lap (around 1:11.162)
    const fastLap = laps.find((l: any) => l.lap_duration && l.lap_duration < 80);
    console.log("Fast Lap:", fastLap.lap_duration);
    
    const dateStart = fastLap.date_start;
    const lapDuration = fastLap.lap_duration;
    
    const startTime = new Date(new Date(dateStart).getTime() - 1500).toISOString();
    const endTime = new Date(new Date(dateStart).getTime() + (lapDuration + 1.5) * 1000).toISOString();
    
    const carData = await getCarTelemetry(quali.session_key, 4, startTime, endTime);
    
    let cumDistSpeed = 0;
    const lapStartEpoch = new Date(dateStart).getTime();
    
    const sortedData = [...carData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
            cumDistSpeed += speedMs * dt;
            prevTime = t;
        }
    }
    console.log("Total Distance (Speed):", cumDistSpeed);
}
run().catch(console.error);
