import { readFileSync } from "node:fs";

export const GAIA_RECORD_COUNT = 646_400;
export const GAIA_HEADER_BYTES = 12;
export const GAIA_FIXED_RECORD_BYTES = 80;

export interface GaiaHeader {
  marker: number;
  version: number;
  count: number;
}

export interface GaiaRecord {
  index: number;
  offset: number;
  position: [number, number, number];
  velocity: [number, number, number];
  properMotionRa: number;
  properMotionDec: number;
  radialVelocity: number;
  apparentMagnitude: number;
  absoluteMagnitude: number;
  packedColor: number;
  catalogId: bigint;
  sourceId: bigint;
  name: string;
  hip: number;
}

export interface GaiaCatalog {
  header: GaiaHeader;
  records: GaiaRecord[];
  byteLength: number;
  endOffset: number;
}

function readUtf16Be(buffer: Buffer, offset: number, length: number): string {
  const characters = new Array<string>(length);
  for (let index = 0; index < length; index += 1) {
    characters[index] = String.fromCharCode(buffer.readUInt16BE(offset + index * 2));
  }
  return characters.join("");
}

export function hipFromName(name: string): number {
  const match = /(?:^|\|)HIP (\d+)(?:$|\|)/.exec(name);
  return match ? Number(match[1]) : 0;
}

export function decodeGaiaCatalog(path: string): GaiaCatalog {
  const buffer = readFileSync(path);
  const header = {
    marker: buffer.readInt32BE(0),
    version: buffer.readInt32BE(4),
    count: buffer.readInt32BE(8),
  };
  if (header.marker !== -1 || header.version !== 3) {
    throw new Error(`Unsupported Gaia particle header: ${JSON.stringify(header)}`);
  }

  const records: GaiaRecord[] = [];
  let offset = GAIA_HEADER_BYTES;
  for (let index = 0; index < header.count; index += 1) {
    const nameLength = buffer.readInt32BE(offset + 76);
    if (nameLength < 0 || nameLength > 4_096) {
      throw new Error(`Invalid name length ${nameLength} at record ${index}`);
    }
    const name = readUtf16Be(buffer, offset + GAIA_FIXED_RECORD_BYTES, nameLength);
    records.push({
      index,
      offset,
      position: [
        buffer.readDoubleBE(offset),
        buffer.readDoubleBE(offset + 8),
        buffer.readDoubleBE(offset + 16),
      ],
      velocity: [
        buffer.readFloatBE(offset + 24),
        buffer.readFloatBE(offset + 28),
        buffer.readFloatBE(offset + 32),
      ],
      properMotionRa: buffer.readFloatBE(offset + 36),
      properMotionDec: buffer.readFloatBE(offset + 40),
      radialVelocity: buffer.readFloatBE(offset + 44),
      apparentMagnitude: buffer.readFloatBE(offset + 48),
      absoluteMagnitude: buffer.readFloatBE(offset + 52),
      packedColor: buffer.readUInt32BE(offset + 56),
      catalogId: buffer.readBigUInt64BE(offset + 60),
      sourceId: buffer.readBigUInt64BE(offset + 68),
      name,
      hip: hipFromName(name),
    });
    offset += GAIA_FIXED_RECORD_BYTES + nameLength * 2;
  }
  return { header, records, byteLength: buffer.byteLength, endOffset: offset };
}
