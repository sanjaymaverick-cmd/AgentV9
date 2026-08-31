import * as THREE from 'three';
import { CityPOI, GPSRoute } from '../types/game';
import type { GameEngine } from './gameEngine';
import { soundEngine } from './audio';

/**
 * GPS routing & the 3D chevron ribbon (spec §23).
 *
 * Builds a Manhattan-style path along the city's road grid, estimates distance/ETA,
 * renders the floating chevrons, and produces the turn-by-turn HUD string. Route
 * *progress* (arrival detection, live distance) is still ticked from WorldInteractions.
 *
 * Moved verbatim from GameEngine; only `this.` -> `this.e.`.
 */
export class GPSNavigator {
  constructor(private e: GameEngine) {}

  setDestination(target: CityPOI | [number, number, number], customName?: string) {
    const e = this.e;
    const destPos: [number, number, number] = Array.isArray(target) ? target : target.position;
    const destName = typeof target === 'object' && 'name' in target ? target.name : (customName || 'GPS Destination');
    const destId = typeof target === 'object' && 'id' in target ? target.id : 'custom_dest';

    const pPos = e.state.isRiding ? e.bikePos : e.playerPos;
    const waypoints = this.calculateRoadPath([pPos.x, pPos.y, pPos.z], destPos);
    const totalDist = Math.round(this.calculatePathDistance(waypoints));
    const etaSec = Math.max(4, Math.round(totalDist / (e.state.isRiding ? 22 : 6)));

    const route: GPSRoute = {
      destinationId: destId,
      destinationName: destName,
      targetPos: destPos,
      waypoints: waypoints,
      totalDistance: totalDist,
      etaSeconds: etaSec,
      nextTurnInstruction: this.nextTurnInstruction(pPos, waypoints),
    };

    e.state.activeGPSRoute = route;
    this.renderRibbon(waypoints);
    e.setNotification(`GPS Routing Active: ${destName} (${totalDist}m)`);
    soundEngine.playWaypoint();
    e.notifyState();
  }

  clearRoute() {
    const e = this.e;
    e.state.activeGPSRoute = null;
    if (e.gpsRibbonGroup) {
      while (e.gpsRibbonGroup.children.length > 0) {
        e.gpsRibbonGroup.remove(e.gpsRibbonGroup.children[0]);
      }
    }
    e.setNotification('GPS Route Cleared');
    e.notifyState();
  }

  private calculateRoadPath(from: [number, number, number], to: [number, number, number]): [number, number, number][] {
    const roadsX = [-85, 0, 85];
    const roadsZ = [-85, 0, 85];

    // Find closest road X and Z for start
    const startRoadX = roadsX.reduce((prev, curr) => Math.abs(curr - from[0]) < Math.abs(prev - from[0]) ? curr : prev);
    const startRoadZ = roadsZ.reduce((prev, curr) => Math.abs(curr - from[2]) < Math.abs(prev - from[2]) ? curr : prev);

    // Find closest road X and Z for destination
    const destRoadX = roadsX.reduce((prev, curr) => Math.abs(curr - to[0]) < Math.abs(prev - to[0]) ? curr : prev);
    const destRoadZ = roadsZ.reduce((prev, curr) => Math.abs(curr - to[2]) < Math.abs(prev - to[2]) ? curr : prev);

    const waypoints: [number, number, number][] = [];
    waypoints.push([from[0], 0.08, from[2]]);

    // Step 1: Connect to nearest road segment
    if (Math.abs(from[0] - startRoadX) < Math.abs(from[2] - startRoadZ)) {
      waypoints.push([startRoadX, 0.08, from[2]]);
      waypoints.push([startRoadX, 0.08, destRoadZ]);
    } else {
      waypoints.push([from[0], 0.08, startRoadZ]);
      waypoints.push([destRoadX, 0.08, startRoadZ]);
    }

    // Step 2: Route through intersection to destination road
    if (destRoadX !== startRoadX || destRoadZ !== startRoadZ) {
      waypoints.push([destRoadX, 0.08, destRoadZ]);
    }

    // Step 3: Connect to final point
    waypoints.push([destRoadX, 0.08, to[2]]);
    waypoints.push([to[0], 0.08, to[2]]);

    // Deduplicate close consecutive points
    const cleanWaypoints: [number, number, number][] = [waypoints[0]];
    for (let i = 1; i < waypoints.length; i++) {
      const p1 = new THREE.Vector3(...cleanWaypoints[cleanWaypoints.length - 1]);
      const p2 = new THREE.Vector3(...waypoints[i]);
      if (p1.distanceTo(p2) > 2.5) {
        cleanWaypoints.push(waypoints[i]);
      }
    }
    return cleanWaypoints;
  }

  private calculatePathDistance(waypoints: [number, number, number][]): number {
    let d = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = new THREE.Vector3(...waypoints[i]);
      const p2 = new THREE.Vector3(...waypoints[i + 1]);
      d += p1.distanceTo(p2);
    }
    return d;
  }

  nextTurnInstruction(playerPos: THREE.Vector3, waypoints: [number, number, number][]): string {
    if (waypoints.length < 2) return 'Arrive at destination';
    const nextPt = new THREE.Vector3(...waypoints[1]);
    const distToNext = Math.round(playerPos.distanceTo(nextPt));
    if (distToNext < 15 && waypoints.length > 2) {
      const p2 = new THREE.Vector3(...waypoints[2]);
      const v1 = nextPt.clone().sub(playerPos).normalize();
      const v2 = p2.clone().sub(nextPt).normalize();
      const cross = v1.x * v2.z - v1.z * v2.x;
      if (cross > 0.25) return `Turn right in ${distToNext}m`;
      if (cross < -0.25) return `Turn left in ${distToNext}m`;
      return `Continue straight for ${distToNext}m`;
    }
    return `Head towards ${this.e.state.activeGPSRoute?.destinationName || 'destination'} (${distToNext}m)`;
  }

  private renderRibbon(waypoints: [number, number, number][]) {
    const e = this.e;
    if (!e.gpsRibbonGroup) {
      e.gpsRibbonGroup = new THREE.Group();
      e.scene.add(e.gpsRibbonGroup);
    }
    while (e.gpsRibbonGroup.children.length > 0) {
      e.gpsRibbonGroup.remove(e.gpsRibbonGroup.children[0]);
    }

    const arrowMat = new THREE.MeshBasicMaterial({
      color: '#00f2fe',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(-0.8, -0.6);
    chevronShape.lineTo(0, 0.6);
    chevronShape.lineTo(0.8, -0.6);
    chevronShape.lineTo(0.5, -0.9);
    chevronShape.lineTo(0, 0.1);
    chevronShape.lineTo(-0.5, -0.9);
    chevronShape.closePath();
    const chevronGeo = new THREE.ShapeGeometry(chevronShape);
    chevronGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = new THREE.Vector3(...waypoints[i]);
      const p2 = new THREE.Vector3(...waypoints[i + 1]);
      const segmentDist = p1.distanceTo(p2);
      const dir = p2.clone().sub(p1).normalize();
      const angleY = Math.atan2(dir.x, dir.z);

      const count = Math.max(1, Math.floor(segmentDist / 4.5));
      for (let j = 0; j <= count; j++) {
        const t = j / count;
        const pos = p1.clone().lerp(p2, t);
        const mesh = new THREE.Mesh(chevronGeo, arrowMat);
        mesh.position.set(pos.x, 0.08, pos.z);
        mesh.rotation.y = angleY;
        e.gpsRibbonGroup.add(mesh);
      }
    }
  }
}
