#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PAGE = { width: 595, height: 842, margin: 48 };
const COLORS = {
  base: '0.97 0.99 0.98',
  mint: '0.67 0.82 0.71',
  green: '0.34 0.63 0.43',
  yellow: '0.96 0.82 0.36',
  text: '0.09 0.20 0.14',
  accent: '0.18 0.49 0.29'
};

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function normalizeMarkdown(md) {
  return md
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((line) => {
      if (/^\|[-\s|:]+\|?$/.test(line.trim())) return [];
      if (line.includes('|') && /^\|/.test(line.trim())) {
        return [line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((s) => s.trim()).filter(Boolean).join(' • ')];
      }
      return [line];
    });
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function markdownToStyledLines(md) {
  const lines = normalizeMarkdown(md);
  const styled = [];

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      styled.push({ text: '', size: 12, leading: 16, bold: false, gapBefore: 4 });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const size = level === 1 ? 25 : level === 2 ? 17 : 13;
      styled.push({ text: heading[2], size, leading: size + 5, bold: true, color: 'accent', gapBefore: level === 1 ? 6 : 4 });
      continue;
    }

    if (/^```/.test(line)) {
      styled.push({ text: '', size: 12, leading: 16, bold: false, gapBefore: 2 });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (bullet) {
      styled.push({ text: `• ${bullet[1]}`, size: 11.5, leading: 15, bold: false, gapBefore: 1 });
      continue;
    }

    styled.push({ text: line, size: 11.5, leading: 15, bold: false, gapBefore: 1 });
  }

  return styled;
}

function styledLinesToPages(styledLines) {
  const pages = [[]];
  let y = PAGE.height - PAGE.margin;

  const pushNewPage = () => {
    pages.push([]);
    y = PAGE.height - PAGE.margin;
  };

  for (const line of styledLines) {
    y -= line.gapBefore || 0;

    const maxChars = line.bold ? 62 : 78;
    const wrapped = line.text ? wrapText(line.text, maxChars) : [''];

    for (let i = 0; i < wrapped.length; i++) {
      const part = wrapped[i];
      const leading = line.leading || 15;
      if (y - leading < PAGE.margin) pushNewPage();
      pages[pages.length - 1].push({
        x: PAGE.margin,
        y,
        text: part,
        size: line.size,
        bold: line.bold,
        color: line.color || 'text'
      });
      y -= leading;
    }
  }

  return pages;
}

function pageContentStream(pageItems) {
  const out = [];
  out.push('q');
  out.push(`${COLORS.base} rg`);
  out.push(`0 0 ${PAGE.width} ${PAGE.height} re f`);

  out.push('/GS1 gs');
  out.push(`${COLORS.mint} rg`);
  out.push(`-40 ${PAGE.height * 0.63} ${PAGE.width * 0.92} ${PAGE.height * 0.42} re f`);

  out.push('/GS2 gs');
  out.push(`${COLORS.yellow} rg`);
  out.push(`${PAGE.width * 0.34} ${PAGE.height * 0.70} ${PAGE.width * 0.76} ${PAGE.height * 0.38} re f`);

  out.push('/GS3 gs');
  out.push(`${COLORS.green} rg`);
  out.push(`-20 -25 ${PAGE.width * 0.72} ${PAGE.height * 0.30} re f`);

  out.push('/GS4 gs');
  out.push(`${COLORS.yellow} rg`);
  out.push(`${PAGE.width * 0.56} -20 ${PAGE.width * 0.56} ${PAGE.height * 0.25} re f`);
  out.push('Q');

  for (const item of pageItems) {
    const color = item.color === 'accent' ? COLORS.accent : COLORS.text;
    out.push('BT');
    out.push(`${color} rg`);
    out.push(`/${item.bold ? 'F2' : 'F1'} ${item.size} Tf`);
    out.push(`1 0 0 1 ${item.x} ${item.y} Tm`);
    out.push(`(${escapePdfText(item.text)}) Tj`);
    out.push('ET');
  }

  return out.join('\n') + '\n';
}

function buildPdfFromPages(pages) {
  const objects = [];
  const addObj = (s) => objects.push(s);

  const totalPages = pages.length;
  const pageObjStart = 3;
  const contentObjStart = pageObjStart + totalPages;
  const fontObjStart = contentObjStart + totalPages;
  const gsObjStart = fontObjStart + 2;

  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = Array.from({ length: totalPages }, (_, i) => `${pageObjStart + i} 0 R`).join(' ');
  addObj(`<< /Type /Pages /Count ${totalPages} /Kids [ ${kids} ] >>`);

  for (let i = 0; i < totalPages; i++) {
    addObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fontObjStart} 0 R /F2 ${fontObjStart + 1} 0 R >> /ExtGState << /GS1 ${gsObjStart} 0 R /GS2 ${gsObjStart + 1} 0 R /GS3 ${gsObjStart + 2} 0 R /GS4 ${gsObjStart + 3} 0 R >> >> /Contents ${contentObjStart + i} 0 R >>`
    );
  }

  for (const pageItems of pages) {
    const stream = pageContentStream(pageItems);
    addObj(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream`);
  }

  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  addObj('<< /Type /ExtGState /ca 0.24 /CA 0.24 >>');
  addObj('<< /Type /ExtGState /ca 0.18 /CA 0.18 >>');
  addObj('<< /Type /ExtGState /ca 0.12 /CA 0.12 >>');
  addObj('<< /Type /ExtGState /ca 0.16 /CA 0.16 >>');

  let pdf = '%PDF-1.4\n';
  const xref = [0];
  objects.forEach((obj, i) => {
    xref.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < xref.length; i++) {
    pdf += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function convertFile(mdPath, pdfPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const styled = markdownToStyledLines(md);
  const pages = styledLinesToPages(styled);
  const pdf = buildPdfFromPages(pages);
  fs.writeFileSync(pdfPath, pdf);
  return { pages: pages.length, pdfPath };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/md-to-themed-pdf.js <file1.md> [file2.md ...]');
  process.exit(1);
}

for (const mdFile of files) {
  const abs = path.resolve(mdFile);
  const out = abs.replace(/\.md$/i, '.pdf');
  const result = convertFile(abs, out);
  console.log(`Created ${path.relative(process.cwd(), result.pdfPath)} (${result.pages} page(s))`);
}
