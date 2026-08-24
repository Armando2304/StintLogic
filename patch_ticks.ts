import fs from 'fs';
let code = fs.readFileSync('components/TelemetrySingleChart.tsx', 'utf8');

code = code.replace(
/      yaxis: \{/,
`      yaxis: {
          tickAmount: 5,
          forceNiceScale: true,`
);

fs.writeFileSync('components/TelemetrySingleChart.tsx', code);
