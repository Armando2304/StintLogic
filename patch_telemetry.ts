import fs from 'fs';
let code = fs.readFileSync('utils/telemetryUtils.ts', 'utf8');

code = code.replace(
  /export const processTelemetryData = \([\s\S]*?circuitLength\?: number,\n\) => \{/m,
  `export const processTelemetryData = (
  inputs: {
    driver: Driver;
    data: CarData[];
    lapStartDate: string;
    lapDuration: number;
    traceId: string;
  }[],
  circuitLength?: number,
) => {`
);

code = code.replace(
  /const result = enrichAndSanitize\(\s*input\.data,\s*input\.locationData,\s*input\.lapStartDate,\s*input\.lapDuration,\s*circuitLength,\s*\);/m,
  `const result = enrichAndSanitize(
      input.data,
      input.lapStartDate,
      input.lapDuration,
      circuitLength,
    );`
);

fs.writeFileSync('utils/telemetryUtils.ts', code);
