import { RadarEntity } from '../types/game';
import type { GameEngine } from './gameEngine';

/**
 * Builds the flat `GameState.radarEntities` list the HUD minimap reads each tick
 * (spec §23). Pure projection of world + player + mission state into 2D blips.
 *
 * Moved verbatim from GameEngine; only `this.` -> `this.e.`.
 */
export class RadarSync {
  constructor(private e: GameEngine) {}

  sync() {
    const e = this.e;
    const entities: RadarEntity[] = [];

    // 1. Player Agent Position
    entities.push({
      id: 'agent_player',
      type: 'player',
      x: e.playerPos.x,
      z: e.playerPos.z,
      rot: e.playerRot,
      label: 'Agent V9',
    });

    // 2. V9 Motorcycle Position
    entities.push({
      id: 'v9_motorcycle',
      type: 'bike',
      x: e.bikePos.x,
      z: e.bikePos.z,
      rot: e.bikeRot,
      label: 'V9 Turbo',
    });

    // 3. Mini Recon Drone + rogue tagger drones
    e.droneTagManager.collectRadar(entities);
    if (e.state.isMiniDroneActive) {
      entities.push({
        id: 'mini_drone',
        type: 'drone',
        x: e.dronePos.x,
        z: e.dronePos.z,
        rot: e.droneRot,
        label: 'Recon Drone',
      });
    }

    // 4. Threat Guard Bots
    if (e.world && e.world.bots) {
      e.world.bots.forEach((bot) => {
        entities.push({
          id: bot.data.id,
          type: 'bot',
          x: bot.obj.position.x,
          z: bot.obj.position.z,
          rot: bot.obj.rotation.y,
          label: bot.data.name,
          alert: bot.data.alertLevel,
        });
      });
    }

    // 5. Security Cameras
    if (e.world && e.world.cameras) {
      e.world.cameras.forEach((cam) => {
        if (!cam.disabled) {
          entities.push({
            id: cam.id,
            type: 'camera',
            x: cam.position[0],
            z: cam.position[2],
            rot: cam.obj.rotation.y,
            label: 'Surveillance Cam',
            alert: cam.alertLevel,
          });
        }
      });
    }

    // 6. Cyber Fuel & Plasma Stations
    if (e.world && e.world.fuelStations) {
      e.world.fuelStations.forEach((fs) => {
        entities.push({
          id: fs.id,
          type: 'fuel',
          x: fs.position[0],
          z: fs.position[2],
          label: fs.name,
        });
      });
    }

    // 7. Autonomous Traffic Vehicles
    if (e.world && e.world.trafficVehicles) {
      e.world.trafficVehicles.forEach((tv) => {
        entities.push({
          id: tv.id,
          type: 'traffic',
          x: tv.obj.position.x,
          z: tv.obj.position.z,
          rot: tv.obj.rotation.y,
          style: tv.style,
        });
      });
    }

    // 8. Interactive Terminals, lockers and EMP breakers
    if (e.world && e.world.terminals) {
      e.world.terminals.forEach((term) => {
        entities.push({
          id: term.id,
          type: 'terminal',
          x: term.position[0],
          z: term.position[2],
          status: term.hacked ? 'hacked' : 'active',
          label: term.name,
        });
      });
    }
    if (e.world && e.world.sideBreakers) {
      e.world.sideBreakers.forEach((b) => {
        entities.push({
          id: b.id,
          type: 'terminal',
          x: b.position[0],
          z: b.position[2],
          status: b.tripped ? 'hacked' : 'active',
          label: b.name,
        });
      });
    }

    // 9. Active Mission Objective
    const mission = e.state.activeMission;
    if (mission && !mission.completed) {
      const curStep = mission.steps[mission.currentStepIndex];
      if (curStep) {
        e.state.activeTargetPos = curStep.targetPosition;
        entities.push({
          id: 'mission_objective',
          type: 'objective',
          x: curStep.targetPosition[0],
          z: curStep.targetPosition[2],
          label: curStep.title,
        });
      }
    }

    // 10. NPC Locals & Quest Givers
    if (e.world && e.world.npcLocals) {
      e.world.npcLocals.forEach((npc) => {
        entities.push({
          id: npc.data.id,
          type: 'npc',
          x: npc.obj.position.x,
          z: npc.obj.position.z,
          rot: npc.obj.rotation.y,
          label: npc.data.name,
          style: npc.data.avatarColor,
        });
      });
    }

    // 11. City POIs
    if (e.world && e.world.cityPOIs) {
      e.world.cityPOIs.forEach((poi) => {
        entities.push({
          id: poi.id,
          type: 'poi',
          x: poi.position[0],
          z: poi.position[2],
          label: poi.name,
          category: poi.category,
        });
      });
    }

    // 12. Live CHAOS pursuit units (search drone, interceptors, tracker, elite, roadblocks)
    e.chaosAlertManager.collectRadar(entities);

    // 13. Story chase transport
    e.chaseController.collectRadar(entities);

    e.state.radarEntities = entities;
  }
}
