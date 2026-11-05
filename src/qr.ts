import { renderSVG } from "uqr";

export function qrSvg(text: string): string {
  const svg = renderSVG(text, {
    ecc: "M",
    border: 2,
    pixelSize: 7,
    blackColor: "#243028",
    whiteColor: "#fffcf8",
  });
  if (!svg.startsWith("<svg")) return "";
  return svg.replace("<svg ", '<svg class="qr" role="img" aria-label="Kode QR" ');
}
