import PDFDocument from "pdfkit";
import config from "../config";

/** Green letterhead band + clinic identity used on generated documents. */
export const drawLetterhead = (doc: PDFKit.PDFDocument) => {
  const PAGE_W = doc.page.width;

  doc.save();
  doc.rect(0, 0, PAGE_W, 130).fill("#166534");
  doc.rect(0, 130, PAGE_W, 3).fill("#166534");
  doc.fillColor("#ffffff");
  doc.fontSize(20).font("Helvetica-Bold").text("REPERTO  HOMOEOPATHIC  CLINIC", 48, 34, {
    align: "center",
  });
  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Holistic care, individualised treatment", 48, 64, {
      align: "center",
      characterSpacing: 0.6,
    });
  doc
    .font("Helvetica-Bold")
    .fillColor("#d1fae5")
    .fontSize(9)
    .text("A Classic Homoeopathy Practice", 48, 86, { align: "center" });
  doc
    .font("Helvetica")
    .fillColor("#ffffff")
    .fontSize(9)
    .text(`Phone: ${config.clinic.phone}  |  Email: ${config.clinic.email}`, 48, 104, {
      align: "center",
    });
  doc.restore();
  doc.y = 150;
};

/** Grey footer band with a machine-generated disclaimer line. */
export const drawFooter = (doc: PDFKit.PDFDocument, label: string) => {
  const PAGE_W = doc.page.width;
  doc.save();
  doc.rect(0, doc.page.height - 34, PAGE_W, 34).fill("#f4f4f5");
  const footerText = `Reperto Homeopathic Clinic · ${label}`;
  doc.font("Helvetica").fillColor("#888888").fontSize(9);
  doc.text(footerText, (PAGE_W - doc.widthOfString(footerText)) / 2, doc.page.height - 24, {
    lineBreak: false,
  });
  doc.restore();
};