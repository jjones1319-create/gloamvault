/**
 * `node tools/docs/md-to-pdf.ts <in.md> <out.pdf>` — a Markdown document printed to PDF through the installed Chrome
 * (Playwright, the same one `npm run shots` drives). A small converter of its own: headings, paragraphs, bullet and
 * numbered lists, tables, bold, italic, inline code, rules, block quotes — what the game docs use. No new dependency.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('usage: node tools/docs/md-to-pdf.ts <in.md> <out.pdf>')

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inline(s: string): string {
  let out = esc(s)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
  return out
}
function toHtml(md: string): string {
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let i = 0
  const flushPara = (buf: string[]) => { if (buf.length) { out.push(`<p>${inline(buf.join(' '))}</p>`); buf.length = 0 } }
  const para: string[] = []
  while (i < lines.length) {
    const line = lines[i]!
    if (/^\s*$/.test(line)) { flushPara(para); i++; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { flushPara(para); out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`); i++; continue }
    if (/^---+\s*$/.test(line)) { flushPara(para); out.push('<hr>'); i++; continue }
    if (/^>\s?/.test(line)) {
      flushPara(para)
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i]!)) { q.push(lines[i]!.replace(/^>\s?/, '')); i++ }
      out.push(`<blockquote>${toHtml(q.join('\n'))}</blockquote>`)
      continue
    }
    if (/^\|/.test(line)) {
      flushPara(para)
      const rows: string[] = []
      while (i < lines.length && /^\|/.test(lines[i]!)) { rows.push(lines[i]!); i++ }
      const cells = (r: string) => r.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
      const head = cells(rows[0]!)
      const body = rows.slice(/^\|\s*:?-+/.test(rows[1] ?? '') ? 2 : 1)
      out.push('<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' + body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>')
      continue
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line)
    if (li) {
      flushPara(para)
      const ordered = /\d+\./.test(li[2]!)
      const items: string[] = []
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]!)
        if (!m) break
        let text = m[3]!
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !/^\s*([-*]|\d+\.)\s/.test(lines[i]!)) { text += ' ' + lines[i]!.trim(); i++ }
        items.push(`<li>${inline(text)}</li>`)
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }
    para.push(line.trim())
    i++
  }
  flushPara(para)
  return out.join('\n')
}

const md = fs.readFileSync(input, 'utf8')
const title = (/^#\s+(.*)$/m.exec(md)?.[1] ?? path.basename(input)).replace(/[*_`]/g, '')
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1c1a1f; }
  h1 { font-size: 22pt; margin: 0 0 4pt; color: #7a2e12; }
  h2 { font-size: 15pt; margin: 18pt 0 6pt; color: #7a2e12; border-bottom: 1px solid #d8cfc2; padding-bottom: 2pt; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; color: #3a2a1a; page-break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 8pt 0 2pt; }
  p { margin: 0 0 6pt; }
  ul, ol { margin: 0 0 6pt 18pt; padding: 0; }
  li { margin: 0 0 2pt; }
  table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; font-size: 9pt; page-break-inside: auto; }
  th, td { border: 1px solid #c9bfb2; padding: 3pt 5pt; vertical-align: top; text-align: left; }
  th { background: #f1e9dd; }
  tr { page-break-inside: avoid; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f4f0ea; padding: 0 2pt; }
  blockquote { margin: 4pt 0 8pt; padding: 4pt 10pt; border-left: 3px solid #c2410c; background: #faf6f0; }
  hr { border: 0; border-top: 1px solid #d8cfc2; margin: 10pt 0; }
</style></head><body>${toHtml(md)}</body></html>`
const htmlPath = output.replace(/\.pdf$/i, '') + '.html'
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
fs.writeFileSync(htmlPath, html)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
await page.goto('file:///' + path.resolve(htmlPath).replace(/\\/g, '/'))
await page.pdf({ path: output, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="font-size:8pt;color:#777;width:100%;text-align:center;font-family:Arial">${esc(title)} · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>` })
await browser.close()
fs.unlinkSync(htmlPath)
console.log(`→ ${output} (${(fs.statSync(output).size / 1024).toFixed(0)} KB)`)
