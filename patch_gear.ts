import fs from 'fs';
let code = fs.readFileSync('components/TelemetrySingleChart.tsx', 'utf8');

const replacement = `yaxis: {
          max: dataKey === 'gear' ? 8 : undefined,
          min: dataKey === 'gear' ? 0 : undefined,
          tickAmount: 5, forceNiceScale: true,`;

code = code.replace(/yaxis: \{\s*tickAmount: 5, forceNiceScale: true,/, replacement);

fs.writeFileSync('components/TelemetrySingleChart.tsx', code);
