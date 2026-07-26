from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas


def build_video_report_pdf(report: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 2 * cm

    def write_line(text, size=11, gap=0.6 * cm, bold=False):
        nonlocal y
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(2 * cm, y, text)
        y -= gap

    write_line("Sports Injury Risk Detection — Analysis Report", size=16, bold=True, gap=1 * cm)
    write_line(f"Athlete: {report.get('athlete_name', 'N/A')}")
    write_line(f"Video ID: {report.get('video_id')}   Activity: {report.get('activity_type', 'N/A')}")
    write_line(" ")

    write_line("Movement Quality", size=13, bold=True)
    write_line(f"Quality Score: {report.get('quality_score', 'N/A')} / 100")
    write_line(f"Risk Category: {report.get('risk_category', 'N/A')}")
    write_line(" ")

    if report.get("risk_score") is not None:
        write_line("Injury Risk Prediction", size=13, bold=True)
        write_line(f"Risk Score: {report['risk_score']} / 100")
        write_line(f"Predicted Injury Type: {report.get('injury_type', 'N/A')}")
        write_line(" ")

    write_line("Joint Angles", size=13, bold=True)
    for j in report.get("joint_angles", []):
        write_line(f"  {j['joint']}: {j['value']}° (max {j['max']}°)", size=10)
    write_line(" ")

    write_line("Recommendations", size=13, bold=True)
    for r in report.get("recommendations", []):
        if y < 2 * cm:
            c.showPage()
            y = height - 2 * cm
        write_line(f"  • {r}", size=10, gap=0.5 * cm)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()