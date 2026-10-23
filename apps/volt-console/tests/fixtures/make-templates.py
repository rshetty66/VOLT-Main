"""Build the sample Office templates used by tests/templates.test.ts.

    python3 tests/fixtures/make-templates.py

Each file carries a known brand (theme colours, theme fonts, styles, page setup) so the
tests can assert that the extractor reads the real values rather than Office defaults.
Requires python-docx, openpyxl and python-pptx.
"""
import io
import re
import struct
import zipfile
import zlib
from pathlib import Path

import docx
import openpyxl
import pptx
from docx.enum.section import WD_ORIENT
from docx.shared import Inches, Pt, RGBColor
from openpyxl.styles import Alignment, Font, NamedStyle, PatternFill
from openpyxl.worksheet.table import Table, TableStyleInfo
from pptx.util import Inches as PInches

HERE = Path(__file__).parent
NAVY, GOLD, TEAL = "1F3A5F", "D98E04", "2A9D8F"
HEADING_FONT, BODY_FONT = "Montserrat", "Source Sans Pro"


def png(width: int, height: int, rgb=(0x1F, 0x3A, 0x5F)) -> bytes:
    """A solid-colour PNG built with the standard library, used as the brand logo."""
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


LOGO = png(40, 16)


def add_master_logo(data: bytes) -> bytes:
    """Place LOGO on the PowerPoint slide master (python-pptx cannot add pictures to masters)."""
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    pic = ('<p:pic><p:nvPicPr><p:cNvPr id="99" name="Brand logo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr userDrawn="1"/></p:nvPicPr>'
           '<p:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
           '<p:spPr><a:xfrm><a:off x="457200" y="228600"/><a:ext cx="1371600" cy="548640"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            body = src.read(item.filename)
            if item.filename == "ppt/slideMasters/slideMaster1.xml":
                body = body.decode("utf-8").replace("</p:spTree>", pic + "</p:spTree>", 1).encode("utf-8")
            elif item.filename == "ppt/slideMasters/_rels/slideMaster1.xml.rels":
                rel = '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/brand-logo.png"/>'
                body = body.decode("utf-8").replace("</Relationships>", rel + "</Relationships>", 1).encode("utf-8")
            elif item.filename == "[Content_Types].xml" and b'Extension="png"' not in body:
                body = body.decode("utf-8").replace("<Default ", '<Default Extension="png" ContentType="image/png"/><Default ', 1).encode("utf-8")
            dst.writestr(item, body)
        dst.writestr("ppt/media/brand-logo.png", LOGO)
    return out.getvalue()


def rebrand(data: bytes, theme_part: str) -> bytes:
    """Replace the theme's accent colours and major/minor Latin fonts inside the OOXML zip."""
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            body = src.read(item.filename)
            if re.fullmatch(theme_part, item.filename):
                xml = body.decode("utf-8")
                for name, val in (("accent1", NAVY), ("accent2", GOLD), ("accent3", TEAL)):
                    xml = re.sub(rf"(<a:{name}>\s*<a:srgbClr val=\")[0-9A-Fa-f]{{6}}", rf"\g<1>{val}", xml)
                xml = re.sub(r"(<a:majorFont>\s*<a:latin typeface=\")[^\"]*", rf"\g<1>{HEADING_FONT}", xml)
                xml = re.sub(r"(<a:minorFont>\s*<a:latin typeface=\")[^\"]*", rf"\g<1>{BODY_FONT}", xml)
                xml = re.sub(r'(<a:theme [^>]*name=")[^"]*', r"\g<1>VOLT Brand", xml)
                body = xml.encode("utf-8")
            dst.writestr(item, body)
    return out.getvalue()


def save(build, name: str, theme_part: str, post=lambda b: b) -> None:
    buf = io.BytesIO()
    build(buf)
    (HERE / name).write_bytes(post(rebrand(buf.getvalue(), theme_part)))
    print("wrote", name)


def word(buf):
    d = docx.Document()
    normal = d.styles["Normal"]
    normal.font.name, normal.font.size, normal.font.color.rgb = "Georgia", Pt(11), RGBColor(0x33, 0x33, 0x33)
    normal.paragraph_format.space_after = Pt(6)
    h1 = d.styles["Heading 1"]
    h1.font.name, h1.font.size, h1.font.bold, h1.font.color.rgb = "Arial", Pt(20), True, RGBColor(0x1F, 0x3A, 0x5F)
    h1.paragraph_format.space_before, h1.paragraph_format.space_after = Pt(18), Pt(8)
    d.styles["Title"].font.size = Pt(32)
    s = d.sections[0]
    s.orientation, s.page_width, s.page_height = WD_ORIENT.PORTRAIT, Inches(8.5), Inches(11)
    s.top_margin = s.bottom_margin = Inches(1)
    s.left_margin = s.right_margin = Inches(1.25)
    s.header.paragraphs[0].text = "Acme Advisory - Confidential"
    s.header.add_paragraph().add_run().add_picture(io.BytesIO(LOGO), width=Inches(1))
    s.footer.paragraphs[0].text = "acme-advisory.example"
    d.add_paragraph("Quarterly Finance Review", style="Title")
    d.add_heading("Executive summary", level=1)
    d.add_paragraph("Body text in the template's Normal style.")
    d.save(buf)


def excel(buf):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Summary"
    header = NamedStyle(name="VOLT Header")
    header.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    header.fill = PatternFill("solid", fgColor=NAVY)
    header.alignment = Alignment(horizontal="center")
    wb.add_named_style(header)
    ws.append(["Metric", "Actual", "Budget", "Variance %"])
    for c in ws[1]:
        c.style = "VOLT Header"
    ws.append(["Revenue", 1250000.5, 1200000, 0.0417])
    ws.append(["Opex", -480000, -500000, -0.04])
    for row in ws.iter_rows(min_row=2, min_col=2, max_col=3):
        for c in row:
            c.number_format = "#,##0.00;[Red](#,##0.00)"
    for row in ws.iter_rows(min_row=2, min_col=4, max_col=4):
        for c in row:
            c.number_format = "0.0%"
    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 16
    ws.freeze_panes = "A2"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    ws.page_setup.orientation = "landscape"
    ws.oddHeader.center.text = "Acme Advisory"
    data = wb.create_sheet("Data")
    data.append(["Entity", "Amount"])
    data.append(["CA01", 100])
    data.append(["US02", 250])
    t = Table(displayName="EntityAmounts", ref="A1:B3")
    t.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    data.add_table(t)
    wb.save(buf)


def powerpoint(buf):
    p = pptx.Presentation()
    p.slide_width, p.slide_height = PInches(13.333), PInches(7.5)
    title_layout = p.slide_layouts[0]
    title_layout.element.cSld.set("name", "VOLT Title")
    s1 = p.slides.add_slide(title_layout)
    s1.shapes.title.text = "Finance Transformation"
    s2 = p.slides.add_slide(p.slide_layouts[1])
    s2.shapes.title.text = "Agenda"
    p.save(buf)


save(word, "brand-template.docx", r"word/theme/theme1\.xml")
save(excel, "brand-template.xlsx", r"xl/theme/theme1\.xml")
save(powerpoint, "brand-template.pptx", r"ppt/theme/theme\d+\.xml", add_master_logo)
