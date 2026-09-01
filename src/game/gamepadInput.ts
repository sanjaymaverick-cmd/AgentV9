import type { GameEngine } from './gameEngine';

/**
 * Gamepad API support (spec §6, §38.6). Polled once per frame from the engine loop;
 * writes into the shared `engine.input` struct exactly like the keyboard and touch
 * paths do, and fires the one-shot action methods on button rising edges.
 *
 * Standard (Xbox-style) mapping:
 *   left stick X   -> analogSteer          A (0)  -> jump / bike hop
 *   RT (7)         -> analogThrottle (fwd)  B (1)  -> silent / crouch toggle
 *   LT (6)         -> analogThrottle (rev)  X (2)  -> fire gadget
 *   RB (5)         -> boost (hold)          Y (3)  -> interact / mount
 *   LB (4)         -> drift (hold)          Start (9) -> cycle camera
 *
 * While a pad is connected the touch HUD auto-hides (see App.tsx reading
 * `GameState.gamepadConnected`).
 */

const STICK_DEADZONE = 0.18;
const TRIGGER_THRESHOLD = 0.08;

// Standard Gamepad button indices used as one-shots.
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9 } as const;

export class GamepadInput {
  private connected = false;
  /** Rising-edge tracking for the one-shot buttons. */
  private prevPressed = new Set<number>();

  constructor(private e: GameEngine) {}

  attach() {
    window.addEventListener('gamepadconnected', this.onConnect);
    window.addEventListener('gamepaddisconnected', this.onDisconnect);
    // A pad may already be held down at load; getGamepads() will surface it on first poll.
  }

  private onConnect = () => {
    this.connected = true;
    this.e.state.gamepadConnected = true;
    this.e.setNotification('Controller connected — touch controls hidden');
    this.e.notifyState();
  };

  private onDisconnect = () => {
    if (this.readPad()) return; // another pad is still attached
    this.connected = false;
    this.e.state.gamepadConnected = false;
    // Release anything the pad was holding so the bike doesn't run away.
    this.e.input.boost = false;
    this.e.input.drift = false;
    this.e.input.jump = false;
    this.e.input.analogSteer = 0;
    this.e.input.analogThrottle = 0;
    this.prevPressed.clear();
    this.e.setNotification('Controller disconnected — touch controls back');
    this.e.notifyState();
  };

  private readPad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  poll() {
    const pad = this.readPad();
    if (!pad) return;

    // Keep the connected flag honest even if we missed the connect event.
    if (!this.connected) this.onConnect();

    const e = this.e;
    const input = e.input;
    const pressed = (i: number) => !!pad.buttons[i]?.pressed;
    const axisVal = (raw: number) => (Math.abs(raw) < STICK_DEADZONE ? 0 : raw);
    const triggerVal = (i: number) => {
      const v = pad.buttons[i]?.value ?? 0;
      return v < TRIGGER_THRESHOLD ? 0 : v;
    };

    // --- Analog channels ---
    input.analogSteer = axisVal(pad.axes[0] ?? 0);
    const throttle = triggerVal(BTN.RT);
    const brake = triggerVal(BTN.LT);
    input.analogThrottle = throttle > 0 ? throttle : brake > 0 ? -brake : 0;
    input.analogLookX = axisVal(pad.axes[2] ?? 0);
    input.analogLookY = -axisVal(pad.axes[3] ?? 0);

    // --- Held booleans ---
    input.boost = pressed(BTN.RB);
    input.drift = pressed(BTN.LB);
    input.jump = pressed(BTN.A);

    // --- Rising-edge one-shots ---
    this.edge(BTN.A, pressed(BTN.A), () => e.handleJumpOrBrake());
    this.edge(BTN.X, pressed(BTN.X), () => e.fireGadget());
    this.edge(BTN.Y, pressed(BTN.Y), () => e.handleInteractAction());
    this.edge(BTN.B, pressed(BTN.B), () => e.toggleSilentOrCrouch());
    this.edge(BTN.START, pressed(BTN.START), () => e.cycleCameraMode());
  }

  private edge(index: number, isPressed: boolean, fire: () => void) {
    const was = this.prevPressed.has(index);
    if (isPressed && !was) fire();
    if (isPressed) this.prevPressed.add(index);
    else this.prevPressed.delete(index);
  }
}
