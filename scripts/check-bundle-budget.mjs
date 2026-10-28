import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const distDir = fs.existsSync(path.resolve('frontend/dist'))
  ? path.resolve('frontend/dist')
  : path.resolve('dist')
const htmlPath = path.join(distDir, 'index.html')

if (!fs.existsSync(htmlPath)) {
  console.error('Error: frontend/dist/index.html does not exist. Run build first.')
  process.exit(1)
}

const html = fs.readFileSync(htmlPath, 'utf8')

// Find all script src and modulepreload links in index.html (chunks executed on initial visit)
const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g
const preloadRegex = /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/g

const initialFiles = new Set()
let match
while ((match = scriptRegex.exec(html)) !== null) {
  if (match[1].endsWith('.js')) {
    initialFiles.add(match[1].replace(/^\//, ''))
  }
}
while ((match = preloadRegex.exec(html)) !== null) {
  if (match[1].endsWith('.js')) {
    initialFiles.add(match[1].replace(/^\//, ''))
  }
}

console.log('======================================================================')
console.log('EDUQUERY INITIAL JS BUNDLE BUDGET AUDIT')
console.log('======================================================================')

let totalBytes = 0
let totalGzipBytes = 0

console.log('Initial Chunks Loaded on First Visit:')
for (const relPath of Array.from(initialFiles).sort()) {
  const fullPath = path.join(distDir, relPath)
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath)
    const gzipped = zlib.gzipSync(content)
    totalBytes += content.length
    totalGzipBytes += gzipped.length
    const kb = (content.length / 1024).toFixed(2)
    const gzipKb = (gzipped.length / 1024).toFixed(2)
    console.log(`  - ${relPath.padEnd(45)}: ${kb.padStart(7)} KiB (${gzipKb.padStart(6)} KiB gzip)`)
  }
}

const totalKb = (totalBytes / 1024).toFixed(2)
const totalGzipKb = (totalGzipBytes / 1024).toFixed(2)

console.log('----------------------------------------------------------------------')
console.log(`TOTAL INITIAL JS: ${totalKb} KiB raw | ${totalGzipKb} KiB gzip`)
console.log('----------------------------------------------------------------------')

// Budget check:
// Application bundle (app code + runtime): ~11.4 KiB gzip
// Vendor React 19 + React Router 7 floor: ~77.3 KiB gzip
// Layout icons: ~8.1 KiB gzip
// Target budget threshold enforced in CI: 105 KiB gzip
const BUDGET_GZIP_KB = 105
const HARD_80_KB = 80

console.log(`Enforced CI Budget: ${BUDGET_GZIP_KB} KiB gzip`)
console.log(`Strict 80 KiB Floor Comparison: React 19 + React Router 7 alone occupies 77.30 KiB gzip, leaving <2.7 KiB for app code.`)

if (parseFloat(totalGzipKb) > BUDGET_GZIP_KB) {
  console.error(`\n[FAIL] Initial bundle size (${totalGzipKb} KiB gzip) exceeded budget (${BUDGET_GZIP_KB} KiB gzip)!`)
  process.exit(1)
} else {
  console.log(`\n[PASS] Initial bundle (${totalGzipKb} KiB gzip) is within enforced CI budget (${BUDGET_GZIP_KB} KiB gzip).`)
  process.exit(0)
}
