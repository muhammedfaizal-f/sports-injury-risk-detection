from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import matplotlib
matplotlib.use("Agg")  # headless rendering, no display needed on the server
import matplotlib.pyplot as plt


def _joint_angle_bar_chart(joint_angles: list[dict]) -> BytesIO:
    fig, ax = plt.subplots(figsize=(6, 3))
    joints = [j["joint"] for j in joint_angles]
    values = [j["value"] for j in joint_angles]
    maxes = [j["max"] for j in joint_angles]

    x = range(len(joints))
    ax.bar([i - 0.2 for i in x], values, width=0.4, label="Measured", color="#3b82f6")
    ax.bar([i + 0.2 for i in x], maxes, width=0.4, label="Reference Max", color="#cbd5e1")
    ax.set_xticks(list(x))
    ax.set_xticklabels(joints, rotation=30, ha="right", fontsize=8)
    ax.set_ylabel("Degrees")
    ax.set_title("Joint Angles vs Reference Range", fontsize=11)
    ax.legend(fontsize=8)
    fig.tight_layout()

    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf


def _risk_factor_pie_chart(risk_factors: list[dict]) -> BytesIO:
    fig, ax = plt.subplots(figsize=(4.5, 4.5))
    labels = [f["label"] for f in risk_factors]
    contributions = [max(f["contribution"], 0.01) for f in risk_factors]  # avoid zero-slice edge case
    colors = ["#3b82f6", "#14b8a6", "#f59e0b", "#f97316", "#ef4444"]

    ax.pie(
        contributions,
        labels=labels,
        autopct="%1.0f%%",
        colors=colors[: len(labels)],
        textprops={"fontsize": 8},
    )
    ax.set_title("Risk Score Contribution by Factor", fontsize=10)
    fig.tight_layout()

    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf


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

    def ensure_space(needed_cm):
        nonlocal y
        if y < needed_cm * cm:
            c.showPage()
            y = height - 2 * cm

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

    # ---------- Joint angle bar chart ----------
    if report.get("joint_angles"):
        ensure_space(9)
        chart_buf = _joint_angle_bar_chart(report["joint_angles"])
        img = ImageReader(chart_buf)
        chart_width, chart_height = 16 * cm, 8 * cm
        c.drawImage(img, 2 * cm, y - chart_height, width=chart_width, height=chart_height)
        y -= chart_height + 0.8 * cm

    # ---------- Risk factor pie chart ----------
    if report.get("risk_factors"):
        ensure_space(11)
        pie_buf = _risk_factor_pie_chart(report["risk_factors"])
        img = ImageReader(pie_buf)
        pie_size = 10 * cm
        c.drawImage(img, 2 * cm, y - pie_size, width=pie_size, height=pie_size)
        y -= pie_size + 0.8 * cm

    # ---------- Detail tables ----------
    ensure_space(6)
    write_line("Joint Angles (Detail)", size=13, bold=True)
    for j in report.get("joint_angles", []):
        ensure_space(2)
        write_line(f"  {j['joint']}: {j['value']}° (max {j['max']}°)", size=10)
    write_line(" ")

    ensure_space(3)
    write_line("Recommendations", size=13, bold=True)
    for r in report.get("recommendations", []):
        ensure_space(2)
        write_line(f"  • {r}", size=10, gap=0.5 * cm)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()