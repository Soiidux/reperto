import QRCode from "qrcode";

/**
 * Renders text as a PNG data-URL QR code (pure JS, no canvas dependency).
 * Used to embed a machine-verifiable reference on printed documents.
 */
export const qrDataUrl = (text: string, size = 220): Promise<string> =>
  QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });