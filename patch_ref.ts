import fs from 'fs';
let code = fs.readFileSync('utils/telemetryUtils.ts', 'utf8');

code = code.replace(
    /\/\/ 1\. Identify Reference \(First Selected Lap\)\n\s*const refIndex = 0;/,
    `// 1. Identify Reference (Fastest Lap)
    let refIndex = 0;
    let minTime = Infinity;
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].totalTime < minTime) {
            minTime = inputs[i].totalTime;
            refIndex = i;
        }
    }`
);

fs.writeFileSync('utils/telemetryUtils.ts', code);
