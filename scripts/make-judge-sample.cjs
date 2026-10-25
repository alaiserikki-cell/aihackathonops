// Builds dist/sample-judge-test.xlsx from dist/template.xlsx.
// Rewrites only the sheetData of Applications (sheet1.xml) and Territories (sheet2.xml):
// rows 1-3 (title, headers, grey example) are kept exactly; judge data is written from row 4.
// Usage: node scripts/make-judge-sample.cjs
const fs = require('fs'), path = require('path');
const JSZip = require('../dist/vendor/jszip.min.js');
const { applications, territories } = require('./judge-sample-data.cjs');

const root = path.join(__dirname, '..');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; i++; while (i > 0) { let m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// Columns that carry style 7 (dropdown columns) in the template's empty data rows.
function cell(ref, v, styled) {
  const s = styled ? ' s="7"' : '';
  if (v === null || v === undefined || v === '') return styled ? `<c r="${ref}"${s}/>` : '';
  if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function rewrite(xml, rows, styledCols) {
  const start = xml.indexOf('<sheetData>'), end = xml.indexOf('</sheetData>');
  if (start < 0 || end < 0) throw Error('sheetData not found');
  const body = xml.slice(start + '<sheetData>'.length, end);
  const kept = [];
  for (const r of [1, 2, 3]) {
    const m = body.match(new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?</row>`));
    if (!m) throw Error('Template row ' + r + ' missing');
    kept.push(m[0]);
  }
  const data = rows.map((vals, i) => {
    const r = i + 4;
    const cells = vals.map((v, c) => cell(colName(c) + r, v, styledCols.includes(colName(c)))).join('');
    return `<row r="${r}">${cells}</row>`;
  });
  return xml.slice(0, start) + '<sheetData>' + kept.join('') + data.join('') + '</sheetData>' + xml.slice(end + '</sheetData>'.length);
}

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(root, 'dist/template.xlsx')));
  const s1 = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const s2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
  zip.file('xl/worksheets/sheet1.xml', rewrite(s1, applications, ['C', 'D', 'I', 'K', 'M']));
  zip.file('xl/worksheets/sheet2.xml', rewrite(s2, territories, ['B', 'C', 'E', 'G']));
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dest = path.join(root, 'dist/sample-judge-test.xlsx');
  fs.writeFileSync(dest, out);
  console.log(`Wrote ${dest} (${out.length} bytes): ${applications.length} applications, ${territories.length} territories.`);
}
main().catch(e => { console.error(e); process.exit(1); });
