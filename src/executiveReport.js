import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportExecutivePDF(captureEl, { orgName, stats, topRisks }) {
  const canvas = await html2canvas(captureEl, { backgroundColor: "#FFFFFF", scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 32;

  // Header
  pdf.setFontSize(9);
  pdf.setTextColor(90, 100, 110);
  pdf.text(orgName.toUpperCase(), margin, margin);
  pdf.setFontSize(20);
  pdf.setTextColor(22, 35, 58);
  pdf.text("Enterprise Risk Exposure — Executive Summary", margin, margin + 22);
  pdf.setFontSize(9);
  pdf.setTextColor(90, 100, 110);
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, margin + 38);

  // Key stats row
  let y = margin + 64;
  pdf.setFontSize(10);
  pdf.setTextColor(22, 35, 58);
  const statLine = `Open risks: ${stats.open}   |   Avg. exposure score: ${stats.avg}   |   Critical: ${stats.critical}`;
  pdf.text(statLine, margin, y);

  // Chart image (heatmap + trend, captured live from the DOM)
  y += 16;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
  y += imgHeight + 24;

  // Top risks table
  if (y > 680) { pdf.addPage(); y = margin; }
  pdf.setFontSize(12);
  pdf.setTextColor(22, 35, 58);
  pdf.text("Top exposures", margin, y);
  y += 16;

  pdf.setFontSize(9);
  const colX = [margin, margin + 220, margin + 300, margin + 380, margin + 460];
  pdf.setTextColor(90, 100, 110);
  ["Title", "Category", "Score", "Owner", "Status"].forEach((h, i) => pdf.text(h, colX[i], y));
  y += 4;
  pdf.setDrawColor(200, 205, 210);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 14;

  pdf.setTextColor(22, 35, 58);
  topRisks.forEach(r => {
    if (y > 780) { pdf.addPage(); y = margin; }
    pdf.text(String(r.title).slice(0, 38), colX[0], y);
    pdf.text(r.category, colX[1], y);
    pdf.text(String(r.likelihood * r.impact), colX[2], y);
    pdf.text(String(r.owner || "").slice(0, 16), colX[3], y);
    pdf.text(r.status, colX[4], y);
    y += 16;
  });

  pdf.save(`executive-risk-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
