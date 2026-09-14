export interface HorizontalGridPoint {
  azimuth: number;
  altitude: number;
}

export interface EquatorialGridPoint {
  rightAscension: number;
  declination: number;
}

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

export function horizontalGridCoordinates(): HorizontalGridPoint[][] {
  const parallels = range(-75, 75, 15).map((altitude) =>
    range(0, 360, 2.5).map((azimuth) => ({ azimuth, altitude })));
  const meridians = range(0, 330, 30).map((azimuth) =>
    range(-90, 90, 5).map((altitude) => ({ azimuth, altitude })));
  return [...parallels, ...meridians];
}

export function equatorialGridCoordinates(): EquatorialGridPoint[][] {
  const parallels = range(-60, 60, 30).map((declination) =>
    range(0, 360, 2.5).map((rightAscension) => ({ rightAscension, declination })));
  const meridians = range(0, 330, 30).map((rightAscension) =>
    range(-90, 90, 5).map((declination) => ({ rightAscension, declination })));
  return [...parallels, ...meridians];
}
