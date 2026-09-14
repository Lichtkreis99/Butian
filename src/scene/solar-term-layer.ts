import * as THREE from "three";

import { AU_PER_PARSEC, eclipticToWorld, type Cartesian } from "../lib/coordinates";
import {
  apparentSolarHours,
  currentJieSector,
  SOLAR_TERMS,
  sunLongitude,
} from "../lib/solar-terms";

const EARTH_ORBIT_RADIUS = 1 / AU_PER_PARSEC;

function termTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 48;
  const context = canvas.getContext("2d")!;
  context.font = '22px "Songti SC", serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#c9a35e";
  context.fillText(text, 48, 24);
  return new THREE.CanvasTexture(canvas);
}

function arcPoints(start: number, degrees: number, radius: number): THREE.Vector3[] {
  return Array.from({ length: 33 }, (_, index) => {
    const sunAngle = (start + degrees * index / 32) * Math.PI / 180;
    const earthAngle = sunAngle + Math.PI;
    const world = eclipticToWorld({
      x: Math.cos(earthAngle) * radius,
      y: Math.sin(earthAngle) * radius,
      z: 0,
    });
    return new THREE.Vector3(world.x, world.y, world.z);
  });
}

export class SolarTermLayer {
  readonly group = new THREE.Group();

  private readonly orbitGroup = new THREE.Group();
  private readonly dialGroup = new THREE.Group();
  private readonly labels: THREE.Sprite[] = [];
  private readonly monthArc: THREE.Line;
  private readonly hand: THREE.Line;

  constructor() {
    this.group.name = "Bazi solar-term astronomy layer";
    const base = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(arcPoints(0, 360, EARTH_ORBIT_RADIUS)),
      new THREE.LineBasicMaterial({ color: 0x8a7045, transparent: true, opacity: 0.45 }),
    );
    this.orbitGroup.add(base);
    for (let index = 0; index < 24; index += 1) {
      const longitude = index * 15;
      const earthAngle = (longitude + 180) * Math.PI / 180;
      const inner = eclipticToWorld({
        x: Math.cos(earthAngle) * EARTH_ORBIT_RADIUS * 0.94,
        y: Math.sin(earthAngle) * EARTH_ORBIT_RADIUS * 0.94,
        z: 0,
      });
      const outer = eclipticToWorld({
        x: Math.cos(earthAngle) * EARTH_ORBIT_RADIUS * 1.06,
        y: Math.sin(earthAngle) * EARTH_ORBIT_RADIUS * 1.06,
        z: 0,
      });
      const boundary = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(inner.x, inner.y, inner.z),
          new THREE.Vector3(outer.x, outer.y, outer.z),
        ]),
        new THREE.LineBasicMaterial({
          color: longitude === 315 ? 0xcf5547 : 0x8a7045,
          transparent: true,
          opacity: longitude === 315 ? 0.95 : 0.4,
        }),
      );
      this.orbitGroup.add(boundary);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: termTexture(SOLAR_TERMS[index]!),
        depthTest: false,
        transparent: true,
      }));
      const position = eclipticToWorld({
        x: Math.cos(earthAngle) * EARTH_ORBIT_RADIUS * 1.12,
        y: Math.sin(earthAngle) * EARTH_ORBIT_RADIUS * 1.12,
        z: 0,
      });
      label.position.set(position.x, position.y, position.z);
      label.renderOrder = 15;
      this.labels.push(label);
      this.orbitGroup.add(label);
    }
    this.monthArc = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xe0b35d, linewidth: 2, depthWrite: false }),
    );
    this.orbitGroup.add(this.monthArc);
    this.createDial();
    this.hand = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xcf5547, depthTest: false }),
    );
    this.dialGroup.add(this.hand);
    this.group.add(this.orbitGroup, this.dialGroup);
    this.group.visible = false;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  update(
    date: Date,
    origin: Cartesian,
    earth: Cartesian,
    longitude: number,
    cameraDistance: number,
  ): void {
    const originWorld = eclipticToWorld(origin);
    this.orbitGroup.position.set(-originWorld.x, -originWorld.y, -originWorld.z);
    const earthWorld = eclipticToWorld({
      x: earth.x - origin.x,
      y: earth.y - origin.y,
      z: earth.z - origin.z,
    });
    this.dialGroup.position.set(earthWorld.x, earthWorld.y, earthWorld.z);
    const scale = Math.max(cameraDistance * 0.026, EARTH_ORBIT_RADIUS * 0.08);
    this.labels.forEach((label) => label.scale.set(scale * 1.8, scale * 0.9, 1));
    const sector = currentJieSector(sunLongitude(date));
    this.monthArc.geometry.dispose();
    this.monthArc.geometry = new THREE.BufferGeometry().setFromPoints(
      arcPoints(sector.start, 30, EARTH_ORBIT_RADIUS * 1.015),
    );
    const dialRadius = Math.max(cameraDistance * 0.045, 3e-9);
    this.dialGroup.scale.setScalar(dialRadius);
    const hours = apparentSolarHours(date, longitude);
    const angle = (hours / 24 * 360 - 90) * Math.PI / 180;
    this.hand.geometry.dispose();
    this.hand.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(Math.cos(angle) * 0.82, 0, -Math.sin(angle) * 0.82),
    ]);
  }

  private createDial(): void {
    const circle = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(arcPoints(0, 360, 1)),
      new THREE.LineBasicMaterial({ color: 0xb69355, depthTest: false }),
    );
    this.dialGroup.add(circle);
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      this.dialGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(angle) * 0.82, 0, -Math.sin(angle) * 0.82),
          new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)),
        ]),
        new THREE.LineBasicMaterial({ color: 0xb69355, depthTest: false }),
      ));
    }
  }
}
