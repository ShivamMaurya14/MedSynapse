#!/usr/bin/env python3
"""Generate synthetic ophthalmology report fixtures for document-flow testing."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "datasets" / "sample_reports"

REPORTS = (
    {
        "stem": "10_eye_fundus_normal_screening",
        "title": "Ophthalmology Screening Report - Normal Reference Scenario",
        "summary": "Synthetic retinal-screening narrative with no flagged referral finding.",
        "sections": (
            ("PATIENT CONTEXT", ("Age: 41 years", "Screening type: Routine retinal photograph review")),
            ("OBSERVATION SUMMARY", ("Macula: documented as unremarkable in this synthetic scenario", "Optic disc: documented as within expected appearance in this synthetic scenario", "Retinal vessels: documented as no obvious screening flag in this synthetic scenario")),
            ("TEST USE", ("Expected workflow: retain as document/OCR fixture only.", "Eye model input remains a companion color fundus image, not this report text.")),
        ),
    },
    {
        "stem": "11_eye_fundus_retinopathy_referral",
        "title": "Ophthalmology Screening Report - Retinopathy Referral Scenario",
        "summary": "Synthetic referral scenario for testing UI wording and review routing.",
        "sections": (
            ("PATIENT CONTEXT", ("Age: 56 years", "Screening type: Retinal photograph review", "Reported history: diabetes noted in synthetic test scenario")),
            ("OBSERVATION SUMMARY", ("Retinal finding: synthetic scenario describes microvascular changes", "Disposition: ophthalmology review is required", "No automated diagnosis is implied by this document fixture")),
            ("TEST USE", ("Expected workflow: document extraction and manual review.", "Eye model input remains a companion color fundus image, not this report text.")),
        ),
    },
    {
        "stem": "12_eye_fundus_glaucoma_review",
        "title": "Ophthalmology Screening Report - Glaucoma Review Scenario",
        "summary": "Synthetic review scenario for optic-disc and referral-path testing.",
        "sections": (
            ("PATIENT CONTEXT", ("Age: 63 years", "Screening type: Optic nerve / retinal photograph review")),
            ("OBSERVATION SUMMARY", ("Optic disc: synthetic scenario describes a review-required cup-to-disc observation", "Intraocular pressure: not supplied in this report fixture", "Disposition: clinician review and confirmatory assessment are required")),
            ("TEST USE", ("Expected workflow: document extraction and manual review.", "Eye model input remains a companion color fundus image, not this report text.")),
        ),
    },
)


def report_text(spec: dict) -> str:
    lines = [
        "MEDSYNAPSE - SYNTHETIC TEST FIXTURE",
        spec["title"],
        spec["summary"],
        "Not patient data. Not a diagnosis. For local pipeline testing only.",
    ]
    for heading, entries in spec["sections"]:
        lines.extend(("", heading, *entries))
    return "\n".join(lines) + "\n"


def draw_report(path: Path, spec: dict) -> None:
    canvas = Canvas(str(path), pagesize=A4)
    page_width, page_height = A4
    margin = 46
    canvas.setTitle(spec["title"])
    canvas.setAuthor("MedSynapse synthetic test fixture generator")

    canvas.setFillColor(colors.HexColor("#153e5c"))
    canvas.rect(0, page_height - 90, page_width, 90, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(margin, page_height - 39, "MedSynapse | Eye Disease Test Report")
    canvas.setFont("Helvetica", 8)
    canvas.drawString(margin, page_height - 58, "SYNTHETIC SOFTWARE-TEST DATA - NOT FOR CLINICAL USE")

    y = page_height - 122
    canvas.setFillColor(colors.HexColor("#172b3a"))
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(margin, y, spec["title"])
    y -= 19
    canvas.setFillColor(colors.HexColor("#52616b"))
    canvas.setFont("Helvetica", 9)
    canvas.drawString(margin, y, spec["summary"])
    y -= 29

    canvas.setFillColor(colors.HexColor("#fff4e5"))
    canvas.roundRect(margin, y - 37, page_width - 2 * margin, 37, 5, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#914500"))
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(margin + 10, y - 13, "MODEL-INPUT BOUNDARY")
    canvas.setFont("Helvetica", 8.3)
    canvas.drawString(margin + 10, y - 25, "These report words are not eye-model features. The image model requires a 224 x 224 RGB fundus photograph.")
    y -= 62

    for heading, entries in spec["sections"]:
        canvas.setFillColor(colors.HexColor("#1c6284"))
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(margin, y, heading)
        y -= 14
        for entry in entries:
            canvas.setFillColor(colors.HexColor("#f3f8fb"))
            canvas.roundRect(margin, y - 18, page_width - 2 * margin, 20, 3, fill=1, stroke=0)
            canvas.setFillColor(colors.HexColor("#2d414f"))
            canvas.setFont("Helvetica", 8.6)
            canvas.drawString(margin + 9, y - 5, entry)
            y -= 28
        y -= 12

    canvas.setStrokeColor(colors.HexColor("#bdd3e0"))
    canvas.line(margin, 38, page_width - margin, 38)
    canvas.setFillColor(colors.HexColor("#52616b"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(margin, 25, "Synthetic test fixture. It is not a patient record, a model output, or a clinical diagnosis.")
    canvas.drawRightString(page_width - margin, 25, "Page 1 of 1")
    canvas.save()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in REPORTS:
        (OUTPUT_DIR / f"{spec['stem']}.txt").write_text(report_text(spec), encoding="utf-8")
        pdf_path = OUTPUT_DIR / f"{spec['stem']}.pdf"
        draw_report(pdf_path, spec)
        print(pdf_path)


if __name__ == "__main__":
    main()
