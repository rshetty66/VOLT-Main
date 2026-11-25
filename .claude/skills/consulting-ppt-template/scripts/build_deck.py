#!/usr/bin/env python3
"""Build a deck on the consulting template with template-deck-builder's build_deck.py.

This is a thin extension, not a second builder. It defaults --template to
assets/consulting-template.pptx and adds four things the base builder lacks:

- "cells": [{heading, bullets | body | chart | table}, ...] fills cell k of a grid
  layout (heading idx 10+2k, body idx 11+2k, chart idx 30+k where the layout has one).
- chart type "waterfall": {"type": "waterfall", "categories": [...], "values": [...],
  "totals": [indexes of total bars], "number_format": "0.0"}. Built as a native stacked
  column chart with an invisible base series, so the data stays editable.
- status tags in any text: {built}, {mapped}, {new}, {green}, {amber}, {red} become a
  square in the theme colour that theme.json maps them to.
- table "status_fill": true fills cells whose whole text is a status tag with that colour.

Usage: python3 build_deck.py storyboard.json -o deck.pptx [--template other.pptx]
"""
import json
import re
import sys
from pathlib import Path

from pptx.enum.chart import XL_LABEL_POSITION, XL_TICK_LABEL_POSITION
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.enum.text import PP_ALIGN
from pptx.util import Pt

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
sys.path.insert(0, str(SKILL.parent / "template-deck-builder" / "scripts"))
import build_deck as tdb  # noqa: E402

THEME = json.loads((SKILL / "assets" / "theme.json").read_text())
STATUS = {k: getattr(MSO_THEME_COLOR, v.upper().replace("ACCENT", "ACCENT_")) for k, v in THEME["status"].items()}
TAG_RE = re.compile(r"\{(" + "|".join(STATUS) + r")\}\s?")
SQUARE = "■ "

_orig_runs, _orig_chart, _orig_table, _orig_fill = (tdb._runs_from_markup, tdb.insert_chart, tdb.insert_table,
                                                    tdb.fill_slide)


def runs_with_status(p, text, base_rpr=None):
    pos = 0
    for m in TAG_RE.finditer(text):
        if m.start() > pos:
            _orig_runs(p, text[pos:m.start()], base_rpr)
        r = p.add_run()
        r.text = SQUARE
        r.font.color.theme_color = STATUS[m.group(1)]
        pos = m.end()
    if pos < len(text):
        _orig_runs(p, text[pos:], base_rpr)


def insert_chart(slide, ph, spec, n, log):
    if spec.get("type") != "waterfall":
        gf = _orig_chart(slide, ph, spec, n, log)
        negative = any(v < 0 for s in spec.get("series", []) for v in s["values"] if v is not None)
        if gf is not None and negative and spec.get("type") not in ("pie", "doughnut"):
            gf.chart.category_axis.tick_label_position = XL_TICK_LABEL_POSITION.LOW  # labels below negative bars
        return gf
    totals = set(spec.get("totals", []))
    base, up, down, tot, run = [], [], [], [], 0.0
    for i, v in enumerate(spec["values"]):
        if i in totals:
            base.append(0); up.append(0); down.append(0); tot.append(v); run = v
        elif v >= 0:
            base.append(run); up.append(v); down.append(0); tot.append(0); run += v
        else:
            run += v
            base.append(run); up.append(0); down.append(-v); tot.append(0)
    fmt = spec.get("number_format", "General")
    stacked = {k: v for k, v in spec.items() if k not in ("values", "totals", "highlight")}
    stacked.update(type="stacked_column", data_labels=False, series=[
        {"name": "Base", "values": base}, {"name": spec.get("up_label", "Increase"), "values": up},
        {"name": spec.get("down_label", "Decrease"), "values": down}, {"name": "Total", "values": tot}])
    gf = _orig_chart(slide, ph, stacked, n, log)
    if gf is None:
        return None
    chart = gf.chart
    chart.has_legend = False
    chart.value_axis.visible = False
    chart.plots[0].gap_width = spec.get("gap_width", 40)
    colours = [None, MSO_THEME_COLOR.ACCENT_1, MSO_THEME_COLOR.ACCENT_6, MSO_THEME_COLOR.ACCENT_2]
    label_fmt = [None, f"+{fmt};;;", f"-{fmt};;;", f"{fmt};;;"]
    for i, s in enumerate(chart.plots[0].series):
        if i == 0:
            s.format.fill.background()
            s.format.line.fill.background()
            continue
        s.format.fill.solid()
        s.format.fill.fore_color.theme_color = colours[i]
        dl = s.data_labels
        dl.show_value = True
        dl.number_format = label_fmt[i]
        dl.number_format_is_linked = False
        dl.position = XL_LABEL_POSITION.INSIDE_END if i == 3 else XL_LABEL_POSITION.CENTER
        dl.font.size = Pt(spec.get("font_size", 12))
        dl.font.bold = True
        dl.font.color.theme_color = MSO_THEME_COLOR.BACKGROUND_1
    return gf


def insert_table(slide, ph, spec, n, log):
    if not spec.get("status_fill"):
        return _orig_table(slide, ph, spec, n, log)
    tags, rows = {}, []
    for r, row in enumerate(spec["rows"]):
        out = []
        for c, val in enumerate(row):
            m = TAG_RE.fullmatch(str(val).strip() + " ") or TAG_RE.fullmatch(str(val).strip())
            if m:
                tags[(r, c)] = m.group(1)
                val = spec.get("status_text", {}).get(m.group(1), m.group(1).capitalize())
            out.append(val)
        rows.append(out)
    gf = _orig_table(slide, ph, {**spec, "rows": rows}, n, log)
    if gf is None:
        return None
    for (r, c), tag in tags.items():
        cell = gf.table.cell(r + 1, c)
        cell.fill.solid()
        cell.fill.fore_color.theme_color = STATUS[tag]
        for p in cell.text_frame.paragraphs:
            p.alignment = PP_ALIGN.CENTER
            for run in p.runs:
                run.font.bold = True
                run.font.color.theme_color = MSO_THEME_COLOR.BACKGROUND_1
    return gf


def fill_slide(prs, slide, spec, n, log, edit=False):
    if "cells" in spec:
        spec = dict(spec)
        phs = dict(spec.get("placeholders") or {})
        idxs = {p.placeholder_format.idx for p in slide.placeholders}
        for k, cell in enumerate(spec.pop("cells")):
            if not cell:
                continue
            if "heading" in cell:
                phs[str(10 + 2 * k)] = cell["heading"]
            for key in ("chart", "table"):
                if key in cell:
                    phs[str(30 + k if 30 + k in idxs else 11 + 2 * k)] = {key: cell[key]}
            if "bullets" in cell or "body" in cell:
                phs[str(11 + 2 * k)] = cell.get("bullets", cell.get("body"))
        spec["placeholders"] = phs
    return _orig_fill(prs, slide, spec, n, log, edit)


tdb._runs_from_markup = runs_with_status
tdb.insert_chart = insert_chart
tdb.insert_table = insert_table
tdb.fill_slide = fill_slide

if __name__ == "__main__":
    if "--template" not in sys.argv and "--edit" not in sys.argv:
        sys.argv += ["--template", str(SKILL / "assets" / "consulting-template.pptx")]
    tdb.main()
