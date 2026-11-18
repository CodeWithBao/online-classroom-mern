"""Build the verified Vietnamese report, then render pages for external visual QA.

Usage: python scripts/report/generate_report.py --check
       python scripts/report/generate_report.py --final --evidence docs/report-assets/evidence.json

Final generation refuses unresolved PENDING markers and missing evidence/images.
PDF_SKILL_DIR may override the installed official PDF skill directory.
No visual approval is implied by successful generation. Submit rendered PNGs to
one external visual-judge gate; this script does not inspect their appearance.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs' / 'bao-cao.md'
OUTPUT = ROOT / 'docs' / 'bao-cao.pdf'
SKILL = Path(os.environ.get('PDF_SKILL_DIR', str(Path.home() / '.zcode/cli/plugins/cache/zcode-plugins-official/pdf/0.2.3/skills/pdf')))
AUTHOR = 'Phạm Đình Bảo'
TITLE = 'Online Classroom - Báo cáo cuối kỳ Lập trình Web'
# Five roles selected from the official palette.cascade output generated for
# "Online Classroom MERN technical report", minimal mode. No handpicked colors.
PALETTE = {'bg': '#f1f2f2', 'primary': '#415864', 'text': '#202223',
           'muted': '#415864', 'secondary': '#c6cfd4', 'stripe': '#f0f2f3'}


def run_skill(script, *args):
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    subprocess.run([sys.executable, str(SKILL / 'scripts' / script), *map(str, args)],
                   check=True, env=env)


def prerequisites():
    for module in ('reportlab', 'pypdf', 'fitz', 'PIL'):
        __import__(module)
    fonts = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    for name in ('arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'arialbi.ttf'):
        if not (fonts / name).is_file():
            raise RuntimeError(f'Missing local Vietnamese font: {fonts / name}')
    if not (SKILL / 'scripts/cover_render.py').is_file():
        raise RuntimeError('Set PDF_SKILL_DIR to the official PDF skill root.')
    return fonts


def verify_evidence(path, source):
    if 'PENDING:' in source:
        raise ValueError('Unresolved PENDING markers: finalize verified source first.')
    if not path:
        raise ValueError('--evidence is required for final generation.')
    evidence = json.loads(Path(path).read_text(encoding='utf-8'))
    for key in ('implementation_verified', 'installation_verified', 'tests_verified'):
        if evidence.get(key) is not True:
            raise ValueError(f'Evidence not confirmed: {key}')
    if not evidence.get('test_results') or not evidence.get('screenshots'):
        raise ValueError('Actual test_results and screenshots are required.')
    for item in evidence['screenshots']:
        image = ROOT / item['path']
        if not image.is_file() or not item.get('caption'):
            raise ValueError(f'Missing screenshot/caption: {item}')
    return evidence


def inline(text):
    text = html.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    return re.sub(r'`([^`]+)`', r'<font name="Arial">\1</font>', text)


def build(source, fonts, output):
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                   CondPageBreak, KeepTogether, Table, TableStyle, Image)
    from reportlab.platypus.tableofcontents import TableOfContents
    from pypdf import PdfReader, PdfWriter
    from PIL import Image as PILImage

    for name, file in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf'),
                       ('Arial-Italic', 'ariali.ttf'), ('Arial-BoldItalic', 'arialbi.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(fonts / file)))
    pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold',
                                  italic='Arial-Italic', boldItalic='Arial-BoldItalic')
    missing = sorted({c for c in source if not c.isspace()
                      and ord(c) not in pdfmetrics.getFont('Arial').face.charToGlyph})
    if missing:
        raise ValueError(f'Font lacks characters: {missing}')
    color = {k: HexColor(v) for k, v in PALETTE.items()}
    body = ParagraphStyle('Body', fontName='Arial', fontSize=14, leading=21,
                          textColor=color['text'], spaceAfter=10,
                          allowWidows=0, allowOrphans=0)
    h1 = ParagraphStyle('H1', parent=body, fontName='Arial-Bold', fontSize=24,
                        leading=31, spaceBefore=20, spaceAfter=12)
    h2 = ParagraphStyle('H2', parent=h1, fontSize=18, leading=25, spaceBefore=14)
    cell = ParagraphStyle('Cell', parent=body, fontSize=10, leading=14, spaceAfter=0)
    header = ParagraphStyle('Header', parent=cell, fontName='Arial-Bold', textColor=color['bg'])
    caption = ParagraphStyle('Caption', parent=body, fontSize=11, leading=16,
                             alignment=1, spaceBefore=6, spaceAfter=14)
    width, height = A4
    margin = 48
    usable = width - margin * 2 - 12

    class ReportDoc(SimpleDocTemplate):
        def afterFlowable(self, f):
            if hasattr(f, 'toc_key'):
                self.canv.bookmarkPage(f.toc_key)
                self.canv.addOutlineEntry(f.toc_text, f.toc_key, f.toc_level)
                self.notify('TOCEntry', (f.toc_level, f.toc_text, self.page + 1, f.toc_key))

    def page_chrome(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(color['bg'])
        canvas.rect(0, 0, width, height, stroke=0, fill=1)
        canvas.setFillColor(color['primary'])
        canvas.setFont('Arial', 9)
        canvas.drawString(margin, height - 29, 'ONLINE CLASSROOM | BÁO CÁO CUỐI KỲ')
        canvas.drawString(margin, 27, AUTHOR + ' | 1822040642')
        canvas.drawRightString(width - margin, 27, str(doc.page + 1))
        canvas.restoreState()

    story = [Paragraph('Mục lục', h1)]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('TOC1', parent=body, fontSize=12, leading=18,
                                      spaceBefore=6),
                       ParagraphStyle('TOC2', parent=body, fontSize=11, leading=16,
                                      leftIndent=16, spaceBefore=2)]
    story.extend([toc, PageBreak()])
    source = re.sub(r'<!--.*?-->', '', source, flags=re.S)
    # The Markdown preamble is represented once, on the official engine cover.
    source = source[source.index('## '):]
    lines = source.splitlines()
    i = 0
    table_number = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith('## ' ) or line.startswith('### '):
            level = 1 if line.startswith('### ') else 0
            text = line.lstrip('# ').strip()
            key = 'h' + hashlib.sha256(text.encode()).hexdigest()[:12]
            heading = Paragraph(f'<a name="{key}"/>' + inline(text), h2 if level else h1)
            heading.toc_key, heading.toc_text, heading.toc_level = key, text, level
            story.extend([CondPageBreak((height - 108) * (0.18 if level else 0.25)), heading])
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                values = [v.strip() for v in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', v) for v in values):
                    rows.append(values)
                i += 1
            n = len(rows[0])
            if any(len(row) != n for row in rows):
                raise ValueError('Markdown table has inconsistent column count.')
            ratios = [0.35, 0.22, 0.43] if n == 3 else [1/n] * n
            widths = [usable * r for r in ratios]
            assert sum(widths) <= usable + 0.01
            data = [[Paragraph(inline(v), header if ri == 0 else cell)
                     for v in row] for ri, row in enumerate(rows)]
            table = Table(data, colWidths=widths, repeatRows=1, hAlign='CENTER')
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), color['primary']),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [color['bg'], color['stripe']]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ('LINEBELOW', (0, 0), (-1, 0), 0.4, color['secondary'])]))
            table_number += 1
            story.extend([Spacer(1, 12), table, Paragraph(f'Bảng {table_number}.', caption)])
        elif line.startswith('!['):
            match = re.fullmatch(r'!\[(.*?)\]\((.*?)\)', line)
            if not match:
                raise ValueError('Use one complete Markdown image per line.')
            image_path = (SOURCE.parent / match[2]).resolve()
            with PILImage.open(image_path) as image:
                w, h = image.size
            ratio = min(usable / w, 285 / h)
            story.append(KeepTogether([Image(str(image_path), w * ratio, h * ratio),
                                       Paragraph(inline(match[1]), caption)]))
            i += 1
        elif line.startswith('```'):
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                story.append(Paragraph(html.escape(lines[i]) or ' ', cell))
                i += 1
            i += 1
            story.append(Spacer(1, 10))
        else:
            paragraph = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#', '|', '![', '```')):
                paragraph.append(lines[i].strip())
                i += 1
            story.append(Paragraph(inline(' '.join(paragraph)), body))

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='report-', dir=ROOT / 'scripts/report') as tmp:
        tmp = Path(tmp)
        doc = ReportDoc(str(tmp / 'body.pdf'), pagesize=A4, leftMargin=margin,
                        rightMargin=margin, topMargin=54, bottomMargin=54,
                        title=TITLE, author=AUTHOR, subject='Ứng dụng lớp học trực tuyến MERN',
                        creator=AUTHOR)
        doc.multiBuild(story, onFirstPage=page_chrome, onLaterPages=page_chrome)
        sys.path.insert(0, str(SKILL / 'scripts'))
        from cover_render import render_cover
        # Technical report: restrained template 01. No invented institution or lecturer.
        content = {'kicker': 'BÁO CÁO CUỐI KỲ', 'hero': 'Online<br/>Classroom',
                   'summary': 'Ứng dụng lớp học trực tuyến.<br/>Thiết kế và triển khai với MERN.',
                   'meta': 'Phạm Đình Bảo<br/>MSSV: 1822040642<br/>Bài làm cá nhân'}
        render_cover('01', content, str(tmp / 'cover.pdf'), palette=PALETTE,
                     fonts={'sans': 'Arial', 'serif': 'Arial', 'latin': 'Arial', 'kai': 'Arial'})
        writer = PdfWriter()
        writer.append(str(tmp / 'cover.pdf'))
        writer.append(str(tmp / 'body.pdf'))
        writer.add_metadata({'/Title': TITLE, '/Author': AUTHOR, '/Creator': AUTHOR,
                             '/Subject': 'Báo cáo ứng dụng lớp học trực tuyến sử dụng MERN'})
        writer.write(str(output))
        for number, page in enumerate(PdfReader(str(output)).pages, 1):
            if not page.extract_text().strip():
                raise ValueError(f'Unexpected blank page {number}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate prerequisites; do not create a PDF')
    parser.add_argument('--final', action='store_true')
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    fonts = prerequisites()
    source = SOURCE.read_text(encoding='utf-8')
    if args.check:
        print(f'Python: {sys.executable}\nFonts: {fonts}\nSkill: {SKILL}')
        print(f'Source ready; unresolved markers: {source.count("PENDING:")}')
        return
    if not args.final:
        parser.error('Choose --check or --final. Draft PDF generation is intentionally disabled.')
    verify_evidence(args.evidence, source)
    build(source, fonts, OUTPUT)
    run_skill('pdf.py', 'font.check', OUTPUT)
    run_skill('toc_validate.py', 'check-pdf', OUTPUT)
    run_skill('pdf_qa.py', '--skip-cover', OUTPUT)
    import fitz
    render_dir = ROOT / 'docs/report-assets/rendered'
    render_dir.mkdir(parents=True, exist_ok=True)
    with fitz.open(OUTPUT) as pdf:
        for i, page in enumerate(pdf):
            page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(str(render_dir / f'page-{i + 1:02d}.png'))
        print(f'Generated {OUTPUT}; pages={len(pdf)}; bytes={OUTPUT.stat().st_size}')
    print(f'External visual-judge gate REQUIRED. Rendered pages: {render_dir}')


if __name__ == '__main__':
    main()
