import type { GameEngine } from './gameEngine';
import type { WorldObjects } from './world';
import { soundEngine } from './audio';
import { SIDE_MISSIONS } from './missionEngine';

/**
 * NPC conversations and side-quest hand-off (spec §20). Picks the nearest talker,
 * walks dialogue lines, and clones a side mission into the active slot.
 *
 * Moved verbatim from GameEngine; only `this.` -> `this.e.`. GameEngine keeps thin
 * public delegators for App / TouchControls.
 */
export class NPCDialogue {
  constructor(private e: GameEngine) {}

  talkToNPC(npcId?: string) {
    const e = this.e;
    let targetNPC: WorldObjects['npcLocals'][0] | undefined;
    const playerTarget = e.state.isRiding ? e.bikePos : e.playerPos;

    if (npcId) {
      targetNPC = e.world.npcLocals.find((n) => n.data.id === npcId);
    } else {
      let minDist = 4.5;
      for (const npc of e.world.npcLocals) {
        const dist = playerTarget.distanceTo(npc.obj.position);
        if (dist < minDist) {
          minDist = dist;
          targetNPC = npc;
        }
      }
    }

    if (!targetNPC) return;

    e.state.activeNPCDialogue = {
      npc: targetNPC.data,
      lineIndex: 0,
    };

    soundEngine.speak(targetNPC.data.dialogue[0] || 'Hello agent!', 'kira');
    e.notifyState();
  }

  advanceNPCDialogue() {
    const e = this.e;
    if (!e.state.activeNPCDialogue) return;
    const { npc, lineIndex } = e.state.activeNPCDialogue;
    if (lineIndex + 1 < npc.dialogue.length) {
      e.state.activeNPCDialogue.lineIndex = lineIndex + 1;
      soundEngine.speak(npc.dialogue[lineIndex + 1], 'kira');
    } else {
      this.closeNPCDialogue();
    }
    e.notifyState();
  }

  closeNPCDialogue() {
    const e = this.e;
    e.state.activeNPCDialogue = null;
    e.notifyState();
  }

  startSideQuest(questId: string) {
    const e = this.e;
    this.closeNPCDialogue();
    const sideQuest = SIDE_MISSIONS.find((m) => m.id === questId);
    if (sideQuest) {
      e.state.activeMission = JSON.parse(JSON.stringify(sideQuest));
      e.state.activeMission.active = true;
      e.setNotification(`Side Mission Started: ${sideQuest.title}`);
      soundEngine.playMissionComplete();
      e.setGPSDestination(sideQuest.steps[0].targetPosition, sideQuest.title);
      e.requestAutosave();
    }
    e.notifyState();
  }
}
