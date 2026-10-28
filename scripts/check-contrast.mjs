/**
 * Build-time WCAG 2.1 Contrast Checker for EduQuery Monochrome Glass Theme
 * 
 * Evaluates all semantic text/background token pairs in both Light and Dark themes
 * against worst-case background composites.
 * Exits with non-zero code if any pair fails WCAG AA (4.5:1 for normal text, 3.0:1 for large/UI).
 */

// WCAG relative luminance calculation
function sRGBtoLin(colorChannel) {
  const c = colorChannel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getLuminance(r, g, b) {
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function parseHex(hex) {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
      1.0
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    clean.length === 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1.0
  ];
}

function parseRgba(str) {
  if (str.startsWith('#')) return parseHex(str);
  const match = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!match) throw new Error(`Cannot parse color: ${str}`);
  return [
    parseFloat(match[1]),
    parseFloat(match[2]),
    parseFloat(match[3]),
    match[4] !== undefined ? parseFloat(match[4]) : 1.0
  ];
}

// Alpha blend: composite foreground over background
function composite(fgStr, bgStr) {
  const [fgR, fgG, fgB, fgA] = parseRgba(fgStr);
  const [bgR, bgG, bgB, bgA] = parseRgba(bgStr);

  const outA = fgA + bgA * (1 - fgA);
  if (outA === 0) return [0, 0, 0, 0];
  const outR = (fgR * fgA + bgR * bgA * (1 - fgA)) / outA;
  const outG = (fgG * fgA + bgG * bgA * (1 - fgA)) / outA;
  const outB = (fgB * fgA + bgB * bgA * (1 - fgA)) / outA;

  return [Math.round(outR), Math.round(outG), Math.round(outB), outA];
}

function getContrast(color1Str, color2Str) {
  const [r1, g1, b1] = parseRgba(color1Str);
  const [r2, g2, b2] = parseRgba(color2Str);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Token definitions for evaluation
const tokens = {
  light: {
    baseBg: '#FFFFFF',
    worstCaseBg: '#F2F2F3',
    surfaces: {
      'surface-glass-1': 'rgba(255, 255, 255, 0.55)',
      'surface-glass-2': 'rgba(255, 255, 255, 0.72)',
      'surface-glass-3': 'rgba(255, 255, 255, 0.88)',
      'surface-data': 'rgba(255, 255, 255, 0.86)',
      'surface-card': '#FFFFFF',
    },
    texts: {
      'text': '#171717',          // neutral-900
      'text-secondary': '#404040',// neutral-700
      'text-muted': '#595959',    // targeted dark gray >= 5.5:1
    },
    status: {
      success: { text: '#0A5C34', bg: 'rgba(16, 185, 129, 0.12)' },
      danger:  { text: '#991B1B', bg: 'rgba(239, 68, 68, 0.12)' },
      warning: { text: '#8A4B00', bg: 'rgba(245, 158, 11, 0.14)' },
      info:    { text: '#171717', bg: 'rgba(0, 0, 0, 0.05)' },
    },
    primaryButton: {
      bg: '#000000',
      text: '#FFFFFF'
    }
  },
  dark: {
    baseBg: '#000000',
    worstCaseBg: '#0B0B0C',
    surfaces: {
      'surface-glass-1': 'rgba(255, 255, 255, 0.05)',
      'surface-glass-2': 'rgba(255, 255, 255, 0.08)',
      'surface-glass-3': 'rgba(20, 20, 22, 0.82)',
      'surface-data': 'rgba(14, 14, 16, 0.80)',
      'surface-card': '#141416',
    },
    texts: {
      'text': '#FFFFFF',          // neutral-0
      'text-secondary': '#BDBDBD',// neutral-300
      'text-muted': '#A3A3A3',    // neutral-400 light gray
    },
    status: {
      success: { text: '#34D399', bg: 'rgba(16, 185, 129, 0.18)' },
      danger:  { text: '#F87171', bg: 'rgba(239, 68, 68, 0.18)' },
      warning: { text: '#FBBF24', bg: 'rgba(245, 158, 11, 0.18)' },
      info:    { text: '#FFFFFF', bg: 'rgba(255, 255, 255, 0.08)' },
    },
    primaryButton: {
      bg: '#FFFFFF',
      text: '#000000'
    }
  }
};

let failures = 0;
let passes = 0;

console.log('======================================================================');
console.log('EDUQUERY "MONOCHROME GLASS" THEME ACCESSIBILITY CONTRAST AUDIT');
console.log('======================================================================\n');

for (const theme of ['light', 'dark']) {
  console.log(`--- EVALUATING THEME: ${theme.toUpperCase()} ---`);
  const t = tokens[theme];

  // 1. Evaluate primary text against every surface composited over worstCaseBg
  for (const [sName, sBg] of Object.entries(t.surfaces)) {
    const compSurface = `rgba(${composite(sBg, t.worstCaseBg).slice(0, 3).join(', ')}, 1.0)`;
    for (const [tName, tColor] of Object.entries(t.texts)) {
      const ratio = getContrast(tColor, compSurface);
      const isMuted = tName === 'text-muted';
      const minRequired = 4.5;
      const ok = ratio >= minRequired;
      const formatted = ratio.toFixed(2);
      if (ok) {
        passes++;
        console.log(`  ✓ [PASS] ${theme} | ${tName} on ${sName}: ${formatted}:1 (min: ${minRequired}:1)`);
      } else {
        failures++;
        console.error(`  ✗ [FAIL] ${theme} | ${tName} on ${sName}: ${formatted}:1 (min: ${minRequired}:1)`);
      }
    }
  }

  // 2. Evaluate status badges
  for (const [statusName, sPair] of Object.entries(t.status)) {
    // Composite status bg over worstCaseBg
    const compStatusBg = `rgba(${composite(sPair.bg, t.worstCaseBg).slice(0, 3).join(', ')}, 1.0)`;
    const ratio = getContrast(sPair.text, compStatusBg);
    const minRequired = 4.5;
    const ok = ratio >= minRequired;
    const formatted = ratio.toFixed(2);
    if (ok) {
      passes++;
      console.log(`  ✓ [PASS] ${theme} | status.${statusName} badge text on fill: ${formatted}:1 (min: ${minRequired}:1)`);
    } else {
      failures++;
      console.error(`  ✗ [FAIL] ${theme} | status.${statusName} badge text on fill: ${formatted}:1 (min: ${minRequired}:1)`);
    }
  }

  // 3. Evaluate primary button
  const btnRatio = getContrast(t.primaryButton.text, t.primaryButton.bg);
  if (btnRatio >= 4.5) {
    passes++;
    console.log(`  ✓ [PASS] ${theme} | primary button text on bg: ${btnRatio.toFixed(2)}:1 (min: 4.5:1)`);
  } else {
    failures++;
    console.error(`  ✗ [FAIL] ${theme} | primary button text on bg: ${btnRatio.toFixed(2)}:1 (min: 4.5:1)`);
  }
  console.log('');
}

console.log('======================================================================');
console.log(`SUMMARY: ${passes} passed, ${failures} failed.`);
console.log('======================================================================');

if (failures > 0) {
  console.error(`\nContrast check FAILED with ${failures} violations.`);
  process.exit(1);
} else {
  console.log('\nAll contrast checks PASSED successfully! WCAG 2.1 AA compliant.');
  process.exit(0);
}
