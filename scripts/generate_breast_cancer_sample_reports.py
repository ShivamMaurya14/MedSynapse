#!/usr/bin/env python3
"""Generate synthetic WDBC FNA pathology-report fixtures for MedSynapse testing."""

from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER  # noqa: E402


OUTPUT_DIR = ROOT / "datasets" / "sample_reports"
BASE_A = (
    14.20, 20.10, 92.50, 620.0, 0.0950, 0.1200, 0.0800, 0.0450, 0.1800, 0.0620,
    0.710, 1.005, 4.625, 31.00, 0.00475, 0.00600, 0.00400, 0.00225, 0.00900, 0.00310,
    17.04, 24.12, 111.0, 744.0, 0.1140, 0.1440, 0.0960, 0.0540, 0.2160, 0.0744,
)
BASE_B = (
    11.42, 20.38, 77.58, 386.1, 0.1425, 0.2839, 0.2414, 0.1052, 0.2597, 0.09744,
    0.4956, 1.1560, 3.445, 27.23, 0.00911, 0.07458, 0.05661, 0.01867, 0.05963, 0.009208,
    14.91, 26.50, 98.87, 567.7, 0.2098, 0.8663, 0.6869, 0.2575, 0.6638, 0.1730,
)

REPORTS = (
    {
        "stem": "07_breast_fna_complete_case_a",
        "title": "Breast FNA Morphometry Report - Complete Case A",
        "subtitle": "All 30 WDBC nuclear morphometric measurements explicitly supplied",
        "values": dict(zip(BREAST_FEATURE_ORDER, BASE_A)),
        "expected": "Complete feature contract: ready for breast-model feature validation.",
    },
    {
        "stem": "08_breast_fna_complete_case_b",
        "title": "Breast FNA Morphometry Report - Complete Case B",
        "subtitle": "All 30 WDBC nuclear morphometric measurements explicitly supplied",
        "values": dict(zip(BREAST_FEATURE_ORDER, BASE_B)),
        "expected": "Complete feature contract: ready for breast-model feature validation.",
    },
    {
        "stem": "09_breast_fna_incomplete_review_case",
        "title": "Breast FNA Morphometry Report - Review Required",
        "subtitle": "Deliberately incomplete fixture to verify missing-feature handling",
        "values": dict(zip(BREAST_FEATURE_ORDER[:10], BASE_A[:10])),
        "expected": "Incomplete feature contract: must require clinician completion; do not infer missing values.",
    },
)


def format_value(value: float) -> str:
    return f"{value:.8g}"


def report_text(spec: dict) -> str:
    lines = [
        "MEDSYNAPSE - SYNTHETIC TEST FIXTURE",
        spec["title"],
        spec["subtitle"],
        "Not patient data. Not a diagnosis. For local pipeline testing only.",
        "",
        "WDBC FNA MORPHOMETRIC MEASUREMENTS",
    ]
    lines.extend(f"{name}: {format_value(value)}" for name, value in spec["values"].items())
    lines.extend(["", "TEST EXPECTATION", spec["expected"]])
    return "\n".join(lines) + "\n"


def draw_report(path: Path, spec: dict) -> None:
    canvas = Canvas(str(path), pagesize=A4)
    page_width, page_height = A4
    margin = 42
    canvas.setTitle(spec["title"])
    canvas.setAuthor("MedSynapse synthetic test fixture generator")

    canvas.setFillColor(colors.HexColor("#0f3d4c"))
    canvas.rect(0, page_height - 86, page_width, 86, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(margin, page_height - 38, "MedSynapse | Breast FNA Test Report")
    canvas.setFont("Helvetica", 8)
    canvas.drawString(margin, page_height - 56, "SYNTHETIC SOFTWARE-TEST DATA - NOT FOR CLINICAL USE")

    y = page_height - 112
    canvas.setFillColor(colors.HexColor("#172b3a"))
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(margin, y, spec["title"])
    y -= 16
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(colors.HexColor("#52616b"))
    canvas.drawString(margin, y, spec["subtitle"])
    y -= 22

    canvas.setFillColor(colors.HexColor("#e8f4f8"))
    canvas.roundRect(margin, y - 29, page_width - 2 * margin, 29, 4, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0f536d"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(margin + 9, y - 12, "FIXTURE PURPOSE")
    canvas.setFont("Helvetica", 8)
    canvas.drawString(margin + 9, y - 23, spec["expected"])
    y -= 52

    canvas.setFillColor(colors.HexColor("#172b3a"))
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(margin, y, "WDBC FNA MORPHOMETRIC MEASUREMENTS")
    y -= 13

    entries = list(spec["values"].items())
    columns = 2
    rows_per_column = (len(entries) + columns - 1) // columns
    column_width = (page_width - 2 * margin - 14) / columns
    row_height = 14
    for column in range(columns):
        x = margin + column * (column_width + 14)
        for index, (name, value) in enumerate(entries[column * rows_per_column:(column + 1) * rows_per_column]):
            row_y = y - index * row_height
            if index % 2 == 0:
                canvas.setFillColor(colors.HexColor("#f4f8fa"))
                canvas.rect(x, row_y - 10, column_width, 13, fill=1, stroke=0)
            canvas.setFillColor(colors.HexColor("#243746"))
            canvas.setFont("Courier", 7.8)
            canvas.drawString(x + 5, row_y - 1, name)
            value_text = format_value(value)
            canvas.drawRightString(x + column_width - 5, row_y - 1, value_text)

    footer = "Synthetic test fixture. Values are unlabeled and do not represent a patient, condition, or clinical outcome."
    canvas.setStrokeColor(colors.HexColor("#bfd1da"))
    canvas.line(margin, 38, page_width - margin, 38)
    canvas.setFillColor(colors.HexColor("#52616b"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(margin, 25, footer)
    canvas.drawRightString(page_width - margin, 25, "Page 1 of 1")
    canvas.save()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in REPORTS:
        text_path = OUTPUT_DIR / f"{spec['stem']}.txt"
        pdf_path = OUTPUT_DIR / f"{spec['stem']}.pdf"
        text_path.write_text(report_text(spec), encoding="utf-8")
        draw_report(pdf_path, spec)
        print(pdf_path)


if __name__ == "__main__":
    main()
