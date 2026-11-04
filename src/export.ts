export type ExportRow = {
  name: string;
  wa: string;
  email: string;
  birthday: string;
  joined: string;
  method: string;
  stamps: string;
  rewards: string;
  lastVisit: string;
};

const HEADER = ["nama", "wa", "email", "ulang_tahun", "gabung", "cara_gabung", "stamp", "reward_ditukar", "terakhir_datang"];

function cell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function membersCsv(rows: ExportRow[]): string {
  const lines = [HEADER.join(",")];
  for (const row of rows) {
    lines.push([row.name, row.wa, row.email, row.birthday, row.joined, row.method, row.stamps, row.rewards, row.lastVisit].map(cell).join(","));
  }
  return lines.join("\n");
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] || c);
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}
function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStored(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20);
    u32(lv, 14, crc);
    u32(lv, 18, file.data.length);
    u32(lv, 22, file.data.length);
    u16(lv, 26, name.length);
    local.set(name, 30);
    locals.push(local, file.data);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20);
    u16(cv, 6, 20);
    u32(cv, 16, crc);
    u32(cv, 20, file.data.length);
    u32(cv, 24, file.data.length);
    u16(cv, 28, name.length);
    u32(cv, 42, offset);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralBlob = concat(centrals);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 8, files.length);
  u16(ev, 10, files.length);
  u32(ev, 12, centralBlob.length);
  u32(ev, 16, offset);
  return concat([...locals, centralBlob, end]);
}

/** XLSX kecil tanpa library. Excel dan Sheets bisa membukanya. */
export function membersXlsx(rows: ExportRow[]): Uint8Array {
  const encoder = new TextEncoder();
  const head = HEADER.map((item) => `<c t="inlineStr"><is><t>${xml(item)}</t></is></c>`).join("");
  const body = rows
    .map((row, index) => {
      const values = [row.name, row.wa, row.email, row.birthday, row.joined, row.method, row.stamps, row.rewards, row.lastVisit];
      const cells = values.map((value) => `<c t="inlineStr"><is><t>${xml(value)}</t></is></c>`).join("");
      return `<row r="${index + 2}">${cells}</row>`;
    })
    .join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${head}</row>${body}</sheetData></worksheet>`;
  const files = [
    {
      name: "[Content_Types].xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Member" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      ),
    },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) },
  ];
  return zipStored(files);
}
