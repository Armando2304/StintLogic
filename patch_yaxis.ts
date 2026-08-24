import fs from 'fs';
let code = fs.readFileSync('components/TelemetrySingleChart.tsx', 'utf8');

code = code.replace(
/      yaxis: \{\s*labels: \{\s*style: \{ colors: '#94a3b8', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' \},\s*formatter: \(val\) => Math\.round\(Number\(val\)\)\.toString\(\),\s*\},\s*\}/,
`      yaxis: {
          decimalsInFloat: dataKey === 'delta' ? 3 : 0,
          labels: {
              style: { colors: '#94a3b8', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' },
              formatter: (val) => {
                  const num = Number(val);
                  if (dataKey === 'delta') return num.toFixed(3);
                  return Math.round(num).toString();
              },
          },
      }`
);

fs.writeFileSync('components/TelemetrySingleChart.tsx', code);
