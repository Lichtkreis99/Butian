import { inflateSync } from "node:zlib";

export interface StellariumDsoRecord {
  type: string;
  magnitude: number;
  ra: number;
  dec: number;
  majorAxis: number;
  minorAxis: number;
  angle: number;
  morphology: string;
  ids: string[];
}

interface Column {
  name: string;
  offset: number;
  width: number;
}

function field(raw: Buffer, rows: number, row: number, column: Column): Buffer {
  return Buffer.from(Array.from({ length: column.width }, (_, byte) =>
    raw[(column.offset + byte) * rows + row]!));
}

export function decodeStellariumDsoEph(bytes: Buffer): StellariumDsoRecord[] {
  if (bytes.subarray(0, 4).toString("ascii") !== "EPHE") {
    throw new Error("Invalid Stellarium EPH signature");
  }
  const tag = bytes.indexOf(Buffer.from("DSO "));
  if (tag < 0) throw new Error("Stellarium EPH has no DSO block");
  const payload = tag + 8;
  const recordSize = bytes.readUInt32LE(payload + 16);
  const columnCount = bytes.readUInt32LE(payload + 20);
  const rowCount = bytes.readUInt32LE(payload + 24);
  const columns: Column[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    const offset = payload + 28 + index * 20;
    columns.push({
      name: bytes.subarray(offset, offset + 4).toString("ascii").replace(/\0/g, ""),
      offset: bytes.readUInt32LE(offset + 12),
      width: bytes.readUInt32LE(offset + 16),
    });
  }
  const compressed = payload + 28 + columnCount * 20 + 8;
  const raw = inflateSync(bytes.subarray(compressed));
  if (raw.length !== recordSize * rowCount) {
    throw new Error(`DSO payload is ${raw.length} bytes, expected ${recordSize * rowCount}`);
  }
  const byName = new Map(columns.map((column) => [column.name, column]));
  const readFloat = (row: number, name: string) => {
    const value = field(raw, rowCount, row, byName.get(name)!);
    return value.readFloatLE();
  };
  const readText = (row: number, name: string) =>
    field(raw, rowCount, row, byName.get(name)!).toString("utf8").replace(/\0.*$/s, "");
  return Array.from({ length: rowCount }, (_, row) => ({
    type: readText(row, "type"),
    magnitude: readFloat(row, "vmag"),
    ra: readFloat(row, "ra"),
    dec: readFloat(row, "de"),
    majorAxis: readFloat(row, "smax"),
    minorAxis: readFloat(row, "smin"),
    angle: readFloat(row, "angl"),
    morphology: readText(row, "morp").trim(),
    ids: readText(row, "ids").split("|").map((id) => id.trim()).filter(Boolean),
  }));
}
