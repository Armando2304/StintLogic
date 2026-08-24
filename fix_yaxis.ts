import fs from 'fs';
let code = fs.readFileSync('components/TelemetrySingleChart.tsx', 'utf8');

// revert the grid.yaxis
code = code.replace(
/yaxis: \{\s*tickAmount: 5,\s*forceNiceScale: true, lines: \{ show: true \} \},/,
`yaxis: { lines: { show: true } },`
);

// properly patch the main yaxis
code = code.replace(
/yaxis: \{\s*decimalsInFloat/,
`yaxis: {
          tickAmount: 5,
          decimalsInFloat`
);

fs.writeFileSync('components/TelemetrySingleChart.tsx', code);
