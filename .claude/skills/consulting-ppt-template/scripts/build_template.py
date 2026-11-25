#!/usr/bin/env python3
"""Build the consulting PowerPoint template from assets/theme.json.

Every colour, font, size and grid value comes from theme.json, so a rebrand is a
JSON edit and a rerun. The output has one master and the layout library in
references/layout-catalog.md, each built from real placeholders, so
template-deck-builder's build_deck.py can fill it and PowerPoint users get the
layouts under New Slide.

Usage:
  python3 build_template.py [--theme assets/theme.json] [-o assets/consulting-template.pptx] [--potx]
"""
import argparse
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from lxml import etree
from pptx import Presentation
from pptx.opc.constants import CONTENT_TYPE as CT, RELATIONSHIP_TYPE as RT
from pptx.opc.packuri import PackURI
from pptx.parts.slide import SlideLayoutPart
from pptx.util import Inches

HERE = Path(__file__).resolve().parent
NSA = "http://schemas.openxmlformats.org/drawingml/2006/main"
NSP = "http://schemas.openxmlformats.org/presentationml/2006/main"
NSR = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"a": NSA, "p": NSP, "r": NSR}
EMU = 914400
SQUARE = "■"

T = {}  # theme.json, set in main()


def emu(v):
    return int(round(v * EMU))


def xfrm(x, y, w, h, rot=0):
    r = f' rot="{rot}"' if rot else ""
    return f'<a:xfrm{r}><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm>'


def fill_xml(fill):
    return f'<a:solidFill><a:schemeClr val="{fill}"/></a:solidFill>' if fill else "<a:noFill/>"


class Shapes:
    """Collects the p:sp elements of one master or layout, numbering their ids."""

    def __init__(self):
        self.items, self.next_id = [], 2

    def _id(self):
        self.next_id += 1
        return self.next_id

    def rect(self, x, y, w, h, fill="tx1", geom="rect", line=None, name="Decor"):
        ln = f'<a:ln w="12700"><a:solidFill><a:schemeClr val="{line}"/></a:solidFill></a:ln>' if line else "<a:ln><a:noFill/></a:ln>"
        self.items.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{self._id()}" name="{name}"/><p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr>'
            f'<p:spPr>{xfrm(x, y, w, h)}<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>{fill_xml(fill)}{ln}</p:spPr></p:sp>')

    def text(self, x, y, w, h, runs, size, color="tx1", font="+mn-lt", bold=False, align="l", anchor="t",
             fill=None, geom="rect", name="Label"):
        """Static (non-placeholder) text. `runs` is a string, or 'SLIDENUM' for the slide-number field."""
        b = ' b="1"' if bold else ""
        rpr = (f'<a:rPr lang="en-US" sz="{int(size * 100)}"{b} dirty="0"><a:solidFill><a:schemeClr val="{color}"/></a:solidFill>'
               f'<a:latin typeface="{font}"/></a:rPr>')
        if runs == "SLIDENUM":
            body = f'<a:fld id="{{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}}" type="slidenum">{rpr}<a:t>&#8249;#&#8250;</a:t></a:fld>'
        else:
            body = f"<a:r>{rpr}<a:t>{escape(runs)}</a:t></a:r>"
        self.items.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{self._id()}" name="{name}"/><p:cNvSpPr txBox="1"/><p:nvPr userDrawn="1"/></p:nvSpPr>'
            f'<p:spPr>{xfrm(x, y, w, h)}<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>{fill_xml(fill)}</p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="{anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>'
            f'<a:p><a:pPr algn="{align}"/>{body}</a:p></p:txBody></p:sp>')

    def ph(self, kind, idx, x, y, w, h, prompt, size, color="tx1", font="+mn-lt", bold=False, align="l", anchor="t",
           bullets=False, fill=None, geom="rect", name=None, rot=0, inset=0.0):
        """A placeholder. kind: title | ctrTitle | body | obj | chart | tbl. Geometry and fill sit on the placeholder
        itself, so a cell the storyboard leaves empty is pruned with its card, chevron or tile."""
        ph_attr = {"title": 'type="title"', "ctrTitle": 'type="ctrTitle"', "obj": f'idx="{idx}"',
                   "body": f'type="body" idx="{idx}"', "chart": f'type="chart" idx="{idx}"',
                   "tbl": f'type="tbl" idx="{idx}"'}[kind]
        name = name or {"title": "Title", "ctrTitle": "Title"}.get(kind, f"Placeholder {idx}")
        b = ' b="1"' if bold else ' b="0"'
        bu = "" if bullets else '<a:buNone/>'
        ppr = "" if bullets else ' marL="0" indent="0"'
        ins = emu(inset)
        geom_xml = f'<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>{fill_xml(fill) if fill else ""}' if (fill or geom != "rect") else ""
        lvl1 = (f'<a:lvl1pPr algn="{align}"{ppr}>{bu}<a:defRPr sz="{int(size * 100)}"{b}><a:solidFill><a:schemeClr val="{color}"/></a:solidFill>'
                f'<a:latin typeface="{font}"/></a:defRPr></a:lvl1pPr>')
        lvl2 = ""
        if bullets:  # sub-bullets keep the colour of this placeholder, one step smaller
            lvl2 = (f'<a:lvl2pPr><a:defRPr sz="{int((size - 1) * 100)}"><a:solidFill><a:schemeClr val="{color}"/></a:solidFill>'
                    f'</a:defRPr></a:lvl2pPr>')
        self.items.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{self._id()}" name="{escape(name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
            f'<p:nvPr><p:ph {ph_attr}/></p:nvPr></p:nvSpPr><p:spPr>{xfrm(x, y, w, h, rot)}{geom_xml}</p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="{ins}" tIns="{ins}" rIns="{ins}" bIns="{ins}" anchor="{anchor}"><a:noAutofit/></a:bodyPr>'
            f'<a:lstStyle>{lvl1}{lvl2}</a:lstStyle><a:p><a:r><a:rPr lang="en-US"/><a:t>{escape(prompt)}</a:t></a:r></a:p></p:txBody></p:sp>')

    def xml(self):
        return "".join(self.items)


# ---------------------------------------------------------------- shared pieces

def G():
    g = T["grid"]
    W, H, M = T["slide"]["width_in"], T["slide"]["height_in"], g["margin_in"]
    return W, H, M, W - 2 * M, g


def sz(key):
    return T["type_pt"][key]


def title_ph(s, dark=False, w=None):
    W, H, M, CW, g = G()
    s.ph("title", 0, M, g["title_top_in"], w or CW, g["title_height_in"],
         "Takeaway headline: the so-what in one sentence, about 15 words", sz("title"),
         color="bg1" if dark else "tx2", font="+mj-lt", anchor="b")


def source_ph(s, x=None, w=None, dark=False):
    W, H, M, CW, g = G()
    s.ph("body", 90, x if x is not None else M, g["source_top_in"], w or CW - 1.0, 0.36,
         "Source: owner, dataset, period. Label estimates and illustrative figures.", sz("source"),
         color="bg2" if dark else "tx1", name="Source")


def squares(s, x_right, y, n=3, size=0.3, gap=0.22):
    for i in range(n):
        s.rect(x_right - (n - i) * size - (n - 1 - i) * gap, y, size, size, fill="accent1", name="Accent square")


# ---------------------------------------------------------------- layouts
# Placeholder numbering (references/layout-catalog.md): title; 1 main content; 10+2k heading and 11+2k body of
# cell k in reading order; 30+k chart of cell k; 40-43 layout extras; 90 source.

def lay_cover(s):
    W, H, M, CW, g = G()
    s.rect(0, 4.65, W, H - 4.65, fill="tx1", name="Base band")
    s.rect(M, 1.35, 3.55, 4.75, fill="tx2", name="Image block")
    s.text(M + 0.35, 5.45, 2.8, 0.4, T["brand"]["wordmark"], 16, color="bg1", bold=True, name="Wordmark")
    s.rect(4.35, 1.35, W - M - 4.35, 4.75, fill="bg1", name="Card")
    squares(s, W - M - 0.25, 5.5)
    s.ph("body", 13, 4.75, 1.6, 4.6, 0.35, "Prepared for: client, audience", sz("small"), name="Prepared for")
    s.ph("body", 14, 9.4, 1.6, W - M - 0.4 - 9.4, 0.35, "Date: Month YYYY", sz("small"), align="r", name="Date")
    s.ph("ctrTitle", 0, 4.75, 1.95, 7.55, 2.2, "Deck title in two lines or fewer", sz("cover_title"),
         color="tx2", font="+mj-lt", anchor="b")
    s.ph("body", 1, 4.75, 4.35, 6.0, 1.0, "Subtitle: the decision this deck supports", 18, name="Subtitle")


def lay_section(s):
    W, H, M, CW, g = G()
    s.ph("body", 13, M, 1.9, 3.0, 1.1, "01", 60, color="accent1", font="+mj-lt", anchor="b", name="Section number")
    s.ph("title", 0, M, 3.1, 9.5, 1.6, "Section title", sz("section_title"), color="bg1", font="+mj-lt")
    s.ph("body", 1, M, 4.8, 9.5, 1.0, "What this section proves, in one line", 16, color="bg2", name="Section summary")
    squares(s, W - M, H - 1.0)


def lay_exec_summary(s):
    W, H, M, CW, g = G()
    s.rect(0, 0, 4.6, H, fill="tx1", name="Panel")
    s.ph("title", 0, M, 0.6, 3.5, 2.6, "Executive summary headline: the answer in one sentence", sz("panel_title"),
         color="bg1", font="+mj-lt")
    s.ph("body", 13, M, 3.4, 3.5, 3.3, "Context: the question, the governing thought and the ask", 13, color="bg1",
         name="Panel text")
    s.ph("obj", 1, 5.1, 0.6, W - M - 5.1, 6.05, "Three to five findings, each a full sentence with its number",
         16, bullets=True)
    source_ph(s, x=5.1, w=W - M - 5.1 - 1.0)
    s.text(W - M - 0.8, g["footer_top_in"], 0.8, 0.25, "SLIDENUM", sz("footer"), align="r", name="Page number")


def lay_title_content(s):
    W, H, M, CW, g = G()
    title_ph(s)
    s.ph("obj", 1, M, g["content_top_in"], CW, g["content_bottom_in"] - g["content_top_in"],
         "Evidence for the headline: chart, table or up to six bullets", sz("body"), bullets=True)
    source_ph(s)


def lay_single_insight(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top = g["content_top_in"]
    s.rect(M, top, 0.08, 1.4, fill="accent1", name="Stat rule")
    s.ph("body", 10, M + 0.3, top, 4.0, 1.4, "38%", 48, color="tx2", font="+mj-lt", anchor="ctr", name="Stat")
    s.ph("body", 11, M, top + 1.7, 4.3, 3.4, "What the number means and why it matters", sz("body"), name="Stat text")
    s.rect(5.25, top, 0.02, 5.1, fill="bg2", name="Divider")
    s.ph("obj", 1, 5.6, top, W - M - 5.6, 5.1, "Supporting evidence: one chart or table", sz("body"), bullets=True)
    source_ph(s)


def _two_col(s, filled):
    W, H, M, CW, g = G()
    title_ph(s)
    top = g["content_top_in"]
    cw = (CW - 0.7) / 2
    xs = [M, M + cw + 0.7]
    if filled:
        s.rect(M + cw + 0.15, top + 2.3, 0.4, 0.5, fill="accent1", geom="rightArrow", name="Arrow")
    for k, x in enumerate(xs):
        if filled:
            s.ph("body", 10 + 2 * k, x, top, cw, 0.55, ["Today", "Target"][k], 16, color="bg1" if k else "tx1",
                 bold=True, anchor="ctr", fill="accent1" if k else "bg2", inset=0.15, name=f"Heading {k + 1}")
        else:
            s.rect(x, top + 0.55, cw, 0.03, fill="accent1", name="Heading rule")
            s.ph("body", 10 + 2 * k, x, top, cw, 0.5, f"Column {k + 1} heading", sz("heading"), color="tx2",
                 font="+mj-lt", anchor="b", name=f"Heading {k + 1}")
        s.ph("obj", 11 + 2 * k, x, top + 0.75, cw, 4.35, "Points, chart or table", sz("body"), bullets=True)
    source_ph(s)


def lay_two_column(s):
    _two_col(s, False)


def lay_current_future(s):
    _two_col(s, True)


def _cards(s, n, charts):
    W, H, M, CW, g = G()
    title_ph(s)
    top = g["content_top_in"] + 0.15
    gap = 0.3
    cw = (CW - (n - 1) * gap) / n
    for k in range(n):
        x = M + k * (cw + gap)
        s.rect(x, top, cw, 4.95, fill="bg1", line="bg2", name="Card")
        s.rect(x + cw / 2 - 0.15, top - 0.15, 0.3, 0.3, fill="accent1", name="Card tab")
        y = top + 0.35
        if charts:
            s.ph("chart", 30 + k, x + 0.35, y, cw - 0.7, 2.1, "Chart", sz("small"))
            y += 2.2
        s.ph("body", 10 + 2 * k, x + 0.3, y, cw - 0.6, 0.6, f"Pillar {k + 1}", sz("heading") + 2, color="tx2",
             font="+mj-lt", align="ctr", anchor="ctr", name=f"Heading {k + 1}")
        s.ph("body", 11 + 2 * k, x + 0.3, y + 0.7, cw - 0.6, top + 4.8 - (y + 0.7),
             "Two or three short points", 13, align="ctr" if charts else "l", bullets=not charts, name=f"Body {k + 1}")
    source_ph(s)


def lay_three_pillars(s):
    _cards(s, 3, False)


def lay_three_charts(s):
    _cards(s, 3, True)


def lay_four_points(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top = g["content_top_in"] + 0.1
    ph_h, gap = 2.35, 0.25
    half = CW / 2
    for row in range(2):
        y = top + row * (ph_h + gap)
        s.rect(M, y, CW, ph_h, fill="tx1", name="Panel")
        for col in range(2):
            k = row * 2 + col
            x = M + col * half
            s.text(x + 0.4, y + 0.5, 0.65, 0.65, str(k + 1), 24, color="bg1", font="+mj-lt", align="ctr",
                   anchor="ctr", fill="accent1", geom="ellipse", name="Number")
            s.ph("body", 10 + 2 * k, x + 1.3, y + 0.45, half - 1.7, 0.5, "A main point", sz("heading") + 2, color="bg1",
                 font="+mj-lt", name=f"Heading {k + 1}")
            s.ph("body", 11 + 2 * k, x + 1.3, y + 1.0, half - 1.7, 1.15, "One or two lines on what it means",
                 13, color="bg2", name=f"Body {k + 1}")
    source_ph(s)


def lay_kpi(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top = g["content_top_in"] + 0.1
    gap = 0.25
    tw = (CW - 3 * gap) / 4
    for k in range(4):
        x = M + k * (tw + gap)
        s.rect(x, top, tw, 2.6, fill="bg1", line="bg2", name="Tile")
        s.rect(x, top, tw, 0.08, fill="accent1", name="Tile bar")
        s.ph("body", 10 + 2 * k, x + 0.25, top + 0.25, tw - 0.5, 0.8, "5 days", sz("stat"), color="tx2",
             font="+mj-lt", anchor="b", name=f"KPI value {k + 1}")
        s.ph("body", 11 + 2 * k, x + 0.25, top + 1.15, tw - 0.5, 1.35, "KPI name, unit\nchange vs baseline",
             sz("small"), name=f"KPI label {k + 1}")
    s.ph("obj", 1, M, top + 2.9, CW, g["content_bottom_in"] - top - 2.9,
         "What the KPIs say together, or a trend chart", sz("body"), bullets=True)
    source_ph(s)


def lay_chart_takeaways(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top, bottom = g["content_top_in"], g["content_bottom_in"]
    pw = 3.65
    s.ph("obj", 1, M, top, CW - pw - 0.3, bottom - top, "One chart: bar, column, line or waterfall", sz("body"),
         bullets=True)
    px = W - M - pw
    s.rect(px, top, pw, bottom - top, fill="tx1", name="Panel")
    s.rect(px + 0.3, top + 0.3, 0.3, 0.3, fill="accent1", name="Accent square")
    s.ph("body", 10, px + 0.3, top + 0.75, pw - 0.6, 0.5, "Key takeaways", sz("heading"), color="bg1", font="+mj-lt",
         name="Panel heading")
    s.ph("body", 11, px + 0.3, top + 1.35, pw - 0.6, bottom - top - 1.6, "Two or three readings of the chart",
         13, color="bg1", bullets=True, name="Panel body")
    source_ph(s, w=CW - pw - 0.3)


def lay_matrix(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top, bottom = g["content_top_in"], g["content_bottom_in"]
    ax, aw = M + 0.55, 7.6
    s.rect(ax - 0.05, top, 0.03, bottom - top - 0.45, fill="tx1", name="Y axis")
    s.rect(ax - 0.05, bottom - 0.48, aw, 0.03, fill="tx1", name="X axis")
    qw, qh = (aw - 0.25) / 2, (bottom - top - 0.65) / 2
    for k in range(4):
        r, c = divmod(k, 2)
        x, y = ax + 0.1 + c * (qw + 0.1), top + r * (qh + 0.1)
        hot = k == 1
        s.rect(x, y, qw, qh, fill="accent1" if hot else "bg2", name="Quadrant")
        ink = "bg1" if hot else "tx1"
        s.ph("body", 10 + 2 * k, x + 0.2, y + 0.15, qw - 0.4, 0.45, ["Quick wins later", "Do first", "Deprioritise",
             "Plan"][k], 16, color=ink, font="+mj-lt", name=f"Quadrant heading {k + 1}")
        s.ph("body", 11 + 2 * k, x + 0.2, y + 0.65, qw - 0.4, qh - 0.8, "Initiatives in this quadrant", sz("small"),
             color=ink, name=f"Quadrant body {k + 1}")
    s.ph("body", 40, M - 0.05, top + (bottom - top) / 2 - 0.2, 0.4, 0.4, "Value", sz("small"), bold=True,
         align="ctr", anchor="ctr", name="Y axis label", rot=-5400000)
    s.ph("body", 41, ax, bottom - 0.38, aw, 0.32, "Ease of delivery", sz("small"), bold=True, align="ctr",
         name="X axis label")
    s.ph("obj", 1, ax + aw + 0.35, top, W - M - (ax + aw + 0.35), bottom - top, "How to read the matrix and what to do",
         13, bullets=True)
    source_ph(s)


def lay_process(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top = g["content_top_in"] + 0.15
    n, gap = 6, 0.04
    w = (CW - (n - 1) * gap) / n
    for k in range(n):
        x = M + k * (w + gap)
        s.ph("body", 10 + 2 * k, x, top, w, 0.85, f"Step {k + 1}", 13, color="bg1", bold=True, align="ctr",
             anchor="ctr", fill="accent1" if k % 2 == 0 else "tx2", geom="homePlate" if k == 0 else "chevron",
             inset=0.05, name=f"Step {k + 1}")
        s.ph("body", 11 + 2 * k, x + 0.05, top + 1.05, w - 0.35, 2.1, "What happens, who, which system", sz("small"),
             name=f"Step text {k + 1}")
    s.rect(M, top + 3.3, CW, 0.02, fill="bg2", name="Divider")
    s.ph("obj", 1, M, top + 3.45, CW, g["content_bottom_in"] - top - 3.45, "Enablers, controls or hand-offs", 13,
         bullets=True)
    source_ph(s)


def lay_roadmap(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top, bottom = g["content_top_in"], g["content_bottom_in"]
    s.rect(M, top, CW, bottom - top, fill="tx1", name="Panel")
    line_y = top + 1.45
    s.rect(M + 0.4, line_y, CW - 0.8, 0.025, fill="bg1", name="Timeline")
    n = 4
    pw = (CW - 0.8) / n
    for k in range(n):
        x = M + 0.4 + k * pw
        s.rect(x, line_y - 0.15, 0.3, 0.3, fill="accent1", name="Milestone")
        s.ph("body", 10 + 2 * k, x, top + 0.35, pw - 0.25, 0.85, f"Phase {k + 1}", 22, color="bg1", font="+mj-lt",
             anchor="b", name=f"Phase {k + 1}")
        s.ph("body", 11 + 2 * k, x, line_y + 0.4, pw - 0.3, bottom - line_y - 0.6, "Actions, owner, exit criterion",
             sz("small"), color="bg1", bullets=True, name=f"Phase text {k + 1}")
    source_ph(s)


def lay_recommendations(s):
    W, H, M, CW, g = G()
    title_ph(s)
    top, bottom = g["content_top_in"], g["content_bottom_in"]
    pw = 4.3
    s.ph("obj", 1, M, top, CW - pw - 0.35, bottom - top, "Recommendations, each with its rationale", sz("body"),
         bullets=True)
    px = W - M - pw
    s.rect(px, top, pw, bottom - top, fill="tx1", name="Panel")
    s.rect(px, top, pw, 0.08, fill="accent1", name="Panel bar")
    s.ph("body", 10, px + 0.35, top + 0.35, pw - 0.7, 0.55, "Decisions required", 20, color="bg1", font="+mj-lt",
         name="Panel heading")
    s.ph("body", 11, px + 0.35, top + 1.05, pw - 0.7, bottom - top - 1.3, "Decision, owner, date", 13, color="bg1",
         bullets=True, name="Panel body")
    source_ph(s, w=CW - pw - 0.35)


def lay_data_flow(s):
    W, H, M, CW, g = G()
    title_ph(s)
    s.ph("body", 40, M, 1.45, CW, 0.3, "Legend: {built} Built   {mapped} Mapped, not designed   {new} New",
         sz("dense"), name="Legend")
    top, bottom, gap = 1.95, g["content_bottom_in"], 0.15
    # (cell, width): Sources, Silver A, Silver B (shares the Silver header), Gold, Use cases; the panel takes the rest.
    cols = [(0, 1.9), (1, 1.7), (2, 1.7), (3, 2.35), (4, 2.0)]
    x, xs = M, {}
    for k, w in cols:
        xs[k] = x
        x += w + (0.1 if k == 1 else gap)
    headers = {0: ("Sources", 1.9), 1: ("Silver", 3.5), 3: ("Gold", 2.35), 4: ("Use cases", 2.0)}
    for k, (label, w) in headers.items():
        s.ph("body", 10 + 2 * k, xs[k], top, w, 0.45, label, 13, color="bg1", bold=True, anchor="ctr",
             fill="tx2", geom="homePlate", inset=0.08, name=f"Header {k + 1}")
    for k, w in cols:
        s.ph("body", 11 + 2 * k, xs[k], top + 0.6, w, bottom - top - 0.6, "Items, each with a status tag",
             sz("dense"), name=f"Column {k + 1}")
    px = x
    tw = W - M - px
    s.rect(px, top, tw, bottom - top, fill="tx1", name="Panel")
    s.ph("body", 20, px + 0.2, top + 0.2, tw - 0.4, 0.45, "Key takeaway", 14, color="bg1", font="+mj-lt",
         name="Panel heading")
    s.ph("body", 21, px + 0.2, top + 0.75, tw - 0.4, bottom - top - 0.95, "Stat, then what it means", sz("small"),
         color="bg1", name="Panel body")
    source_ph(s)


LAYOUTS = [
    ("Cover", lay_cover, "dark_base", False),
    ("Section Divider", lay_section, "dark", False),
    ("Executive Summary", lay_exec_summary, None, False),
    ("Title and Content", lay_title_content, None, True),
    ("Single Insight", lay_single_insight, None, True),
    ("Two Column", lay_two_column, None, True),
    ("Current vs Future", lay_current_future, None, True),
    ("Three Pillars", lay_three_pillars, None, True),
    ("Three Charts", lay_three_charts, None, True),
    ("Four Points", lay_four_points, None, True),
    ("KPI Dashboard", lay_kpi, None, True),
    ("Chart with Takeaways", lay_chart_takeaways, None, True),
    ("Prioritisation Matrix", lay_matrix, None, True),
    ("Process Flow", lay_process, None, True),
    ("Roadmap", lay_roadmap, None, True),
    ("Recommendations and Decisions", lay_recommendations, None, True),
    ("Data Architecture Flow", lay_data_flow, None, True),
]


# ---------------------------------------------------------------- theme and master

def set_theme(master):
    part = master.part.part_related_by(RT.THEME)
    root = etree.fromstring(part.blob)
    root.set("name", T["name"])
    cs = root.find(".//a:clrScheme", NS)
    cs.set("name", T["name"])
    for child in list(cs):
        tag = etree.QName(child).localname
        for c in list(child):
            child.remove(c)
        etree.SubElement(child, f"{{{NSA}}}srgbClr", val=T["colors"][tag])
    fs = root.find(".//a:fontScheme", NS)
    fs.set("name", T["name"])
    for kind, face in (("majorFont", T["fonts"]["heading"]), ("minorFont", T["fonts"]["body"])):
        fs.find(f"a:{kind}/a:latin", NS).set("typeface", face)
    part._blob = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def master_xml(master):
    W, H, M, CW, g = G()
    s = Shapes()
    s.ph("title", 0, M, g["title_top_in"], CW, g["title_height_in"], "Title", sz("title"), color="tx2",
         font="+mj-lt", anchor="b")
    s.ph("obj", 1, M, g["content_top_in"], CW, g["content_bottom_in"] - g["content_top_in"], "Body", sz("body"),
         bullets=True)
    f = g["footer_top_in"]
    s.rect(M, f + 0.06, 0.12, 0.12, fill="accent1", name="Footer square")
    s.text(M + 0.22, f, 3.0, 0.25, T["brand"]["footer"], sz("footer"), color="tx2", bold=True, name="Footer")
    s.text(W - M - 0.8, f, 0.8, 0.25, "SLIDENUM", sz("footer"), align="r", name="Page number")
    root = master._element
    tree = root.find("p:cSld/p:spTree", NS)
    for el in list(tree)[2:]:
        tree.remove(el)
    for el in etree.fromstring(f'<x xmlns:a="{NSA}" xmlns:p="{NSP}" xmlns:r="{NSR}">{s.xml()}</x>'):
        tree.append(el)
    bg = root.find("p:cSld/p:bg", NS)
    if bg is not None:
        bg.getparent().remove(bg)
    root.find("p:cSld", NS).insert(0, etree.fromstring(
        f'<p:bg xmlns:p="{NSP}" xmlns:a="{NSA}"><p:bgPr><a:gradFill rotWithShape="1"><a:gsLst>'
        '<a:gs pos="0"><a:schemeClr val="bg2"/></a:gs><a:gs pos="45000"><a:schemeClr val="bg1"/></a:gs>'
        '</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:effectLst/></p:bgPr></p:bg>'))
    # Text styles: titles in the heading font, body in the body font with square accent bullets.
    tx = root.find("p:txStyles", NS)
    title = tx.find("p:titleStyle/a:lvl1pPr", NS)
    for c in list(title):
        title.remove(c)
    title.append(etree.fromstring(
        f'<a:defRPr xmlns:a="{NSA}" sz="{sz("title") * 100}" b="0" kern="0"><a:solidFill><a:schemeClr val="tx2"/>'
        '</a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr>'))
    title.set("algn", "l")
    body = tx.find("p:bodyStyle", NS)
    for lvl in range(1, 10):
        el = body.find(f"a:lvl{lvl}pPr", NS)
        if el is None:
            continue
        for c in list(el):
            el.remove(c)
        size = {1: sz("body"), 2: sz("body") - 1}.get(lvl, sz("small"))
        mar = 0.22 + (lvl - 1) * 0.25
        el.attrib.update({"marL": str(emu(mar)), "indent": str(-emu(0.22)), "algn": "l"})
        char = SQUARE if lvl == 1 else "–"
        clr = "accent1" if lvl == 1 else "tx1"
        el.append(etree.fromstring(f'<a:lnSpc xmlns:a="{NSA}"><a:spcPct val="100000"/></a:lnSpc>'))
        el.append(etree.fromstring(f'<a:spcBef xmlns:a="{NSA}"><a:spcPts val="{600 if lvl == 1 else 300}"/></a:spcBef>'))
        el.append(etree.fromstring(f'<a:buClr xmlns:a="{NSA}"><a:schemeClr val="{clr}"/></a:buClr>'))
        el.append(etree.fromstring(f'<a:buSzPct xmlns:a="{NSA}" val="{70000 if lvl == 1 else 100000}"/>'))
        el.append(etree.fromstring(f'<a:buFont xmlns:a="{NSA}" typeface="Arial"/>'))
        el.append(etree.fromstring(f'<a:buChar xmlns:a="{NSA}" char="{char}"/>'))
        el.append(etree.fromstring(
            f'<a:defRPr xmlns:a="{NSA}" sz="{size * 100}" kern="0"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>'
            '<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr>'))


def layout_blob(name, build, bg, show_master):
    s = Shapes()
    build(s)
    bg_xml = ""
    if bg == "dark":
        bg_xml = '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
    elif bg == "dark_base":
        bg_xml = '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
    sm = "" if show_master else ' showMasterSp="0"'
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<p:sldLayout xmlns:a="{NSA}" xmlns:r="{NSR}" xmlns:p="{NSP}" preserve="1"{sm}>'
            f'<p:cSld name="{escape(name)}">{bg_xml}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
            f'</p:nvGrpSpPr><p:grpSpPr/>{s.xml()}</p:spTree></p:cSld>'
            f'<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>').encode("utf-8")


def contrast(a, b):
    def lum(h):
        c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def check_contrast():
    """Text/background pairs the layouts use. WCAG AA needs 4.5:1 for body text, 3:1 for large text."""
    c = T["colors"]
    pairs = [("body on white", c["dk1"], c["lt1"], 4.5), ("body on light grey", c["dk1"], c["lt2"], 4.5),
             ("title on white", c["dk2"], c["lt1"], 3.0), ("white on navy panel", c["lt1"], c["dk1"], 4.5),
             ("light grey on navy panel", c["lt2"], c["dk1"], 4.5), ("white on accent 1", c["lt1"], c["accent1"], 4.5),
             ("accent 1 number on navy", c["accent1"], c["dk1"], 3.0)]
    bad = []
    for label, fg, bg, need in pairs:
        r = contrast(fg, bg)
        print(f"  contrast {label}: {r:.1f}:1 (needs {need})")
        if r < need:
            bad.append(label)
    return bad


def main():
    global T
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--theme", default=str(HERE.parent / "assets" / "theme.json"))
    ap.add_argument("-o", "--out", default=str(HERE.parent / "assets" / "consulting-template.pptx"))
    ap.add_argument("--potx", action="store_true", help="also write a .potx (same package, template content type)")
    a = ap.parse_args()
    T = json.loads(Path(a.theme).read_text())

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(T["slide"]["width_in"]), Inches(T["slide"]["height_in"])
    master = prs.slide_masters[0]
    set_theme(master)
    master_xml(master)

    # Replace python-pptx's default layouts with the library.
    lst = master._element.find("p:sldLayoutIdLst", NS)
    for el in list(lst):
        rid = el.get(f"{{{NSR}}}id")
        lst.remove(el)
        master.part.drop_rel(rid)
    pkg = prs.part.package
    next_id = 2147483649 + 100
    for i, (name, build, bg, show_master) in enumerate(LAYOUTS, 1):
        part = SlideLayoutPart.load(PackURI(f"/ppt/slideLayouts/slideLayout{i}.xml"), CT.PML_SLIDE_LAYOUT, pkg,
                                    layout_blob(name, build, bg, show_master))
        part.relate_to(master.part, RT.SLIDE_MASTER)
        rid = master.part.relate_to(part, RT.SLIDE_LAYOUT)
        el = etree.SubElement(lst, f"{{{NSP}}}sldLayoutId")
        el.set("id", str(next_id + i))
        el.set(f"{{{NSR}}}id", rid)

    # One sample slide per layout: opened in PowerPoint, each shows its layout's prompts.
    for layout in master.slide_layouts:
        prs.slides.add_slide(layout)

    cp = prs.core_properties
    cp.title = f"{T['name']} template"
    cp.author = T["brand"]["wordmark"]
    cp.comments = ("Design inspired by SlidesCarnival's 'McKinsey Consulting Report' template "
                   "(slidescarnival.com/template/mckinsey-consulting-report-slides/209874), CC BY 4.0. "
                   "Rebuilt; no SlidesCarnival files or photos. Not affiliated with McKinsey.")
    bad = check_contrast()
    prs.save(a.out)
    print(f"Wrote {a.out}: {len(LAYOUTS)} layouts")
    if a.potx:
        import io
        import zipfile
        out = Path(a.out).with_suffix(".potx")
        zin = zipfile.ZipFile(a.out)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "[Content_Types].xml":
                    data = data.replace(b"presentationml.presentation.main+xml", b"presentationml.template.main+xml")
                zout.writestr(item, data)
        print(f"Wrote {out}")
    if bad:
        sys.exit(f"Contrast below WCAG AA for: {', '.join(bad)}")


if __name__ == "__main__":
    main()
