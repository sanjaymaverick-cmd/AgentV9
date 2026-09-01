import React, { useState } from 'react';
import { 
  BookOpen, 
  Compass, 
  Zap, 
  EyeOff, 
  Cpu, 
  ShieldAlert, 
  Gamepad2, 
  Sparkles, 
  Award, 
  MapPin, 
  Radio, 
  CheckCircle2, 
  X, 
  Flame, 
  Fuel, 
  Layers, 
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPOI?: (pos: [number, number, number], name: string) => void;
}

export const WalkthroughModal: React.FC<WalkthroughModalProps> = ({
  isOpen,
  onClose,
  onSelectPOI,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'approaches' | 'walkthrough' | 'city' | 'controls' | 'upgrades'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        id="v9-walkthrough-modal"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden text-slate-100 font-sans"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-300">
                VELOCITY CITY FIELD MANUAL & WALKTHROUGH
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Project V9 // Official Operational Guide & Tactics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hud-modal-close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 overflow-x-auto text-xs font-mono">
          {[
            { id: 'overview', label: 'Premise & Lore', icon: Radio },
            { id: 'approaches', label: '3-Way Playstyles', icon: Layers },
            { id: 'walkthrough', label: 'Story Walkthrough', icon: CheckCircle2 },
            { id: 'city', label: 'City Districts & GPS', icon: Compass },
            { id: 'controls', label: 'Controls & Moves', icon: Gamepad2 },
            { id: 'upgrades', label: 'Vehicle & Gadgets', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 font-bold font-mono text-base">
                  <Sparkles className="w-4 h-4" />
                  <span>THE PREMISE</span>
                </div>
                <p>
                  You are <strong>Agent V9</strong>, the elite operative of the <strong>V9 Academy</strong>. Tonight, the rogue <strong>CHAOS Syndicate</strong> breached the High-Tech Museum and stole the <em>Zero-Gravity Energy Core</em>. They are loading it onto a massive <strong>Giant Cargo Drone</strong> at the East Cargo Bay for aerial extraction.
                </p>
                <p>
                  Equipped with the high-performance <strong>V9 Cyber Motorcycle</strong>, tactical disguises, hacking gear, and reconnaissance drones, your mission is to explore Velocity City, track the prototype, disarm the syndicate defenses, and secure the Energy Core before the countdown expires!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold font-mono">
                    <Award className="w-4 h-4" />
                    <span>Agent Ranks</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Earn XP by completing story missions, discovering hidden spy drives, pulling off high-speed stunts, and disarming threat bots. Advance from <strong>Rookie</strong> all the way to <strong>V9 Master Agent</strong>!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold font-mono">
                    <Fuel className="w-4 h-4" />
                    <span>Plasma Energy</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    The V9 bike runs on clean plasma energy. Use <strong>Plasma Fuel Stations</strong> around the city or hit <strong>Stunt Hoops</strong> to recharge both fuel and nitro boosts instantly.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-pink-300 font-bold font-mono">
                    <Compass className="w-4 h-4" />
                    <span>Active GPS</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Set real-time GPS routes to any landmark, gas station, or quest giver. The HUD generates an animated 3D ribbon path with road-snapped turns!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THREE-WAY PLAYSTYLES */}
          {activeTab === 'approaches' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-xs text-slate-400 font-mono">
                EVERY MISSION & CHALLENGE OFFERS 3 DISTINCT PATHWAYS:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. SPEED */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/10 to-slate-950 border border-amber-500/30 flex flex-col space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-base">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <span>THE SPEED PATH</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    High octane racing, precision drifting, and acrobatic rooftop ramps.
                  </p>
                  <ul className="text-xs space-y-2 text-slate-400 list-disc list-inside flex-1">
                    <li>Launch over perimeter fences using yellow rooftop ramps.</li>
                    <li>Drift around tight cyber city corners with <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">Shift</kbd>.</li>
                    <li>Hit aerial Stunt Rings across the monorail for mega XP and speed refills.</li>
                    <li>Trigger Super Jump (<kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">Space</kbd>) over traffic barriers.</li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-300 text-[11px] font-mono border border-amber-500/20">
                    Best for: Thrill-seekers & high-speed vehicle mastery
                  </div>
                </div>

                {/* 2. STEALTH */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-purple-500/10 to-slate-950 border border-purple-500/30 flex flex-col space-y-3">
                  <div className="flex items-center gap-2 text-purple-300 font-black text-base">
                    <EyeOff className="w-5 h-5 text-purple-400" />
                    <span>THE STEALTH PATH</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Infiltration, disguises, silent electric drives, and shadow stalking.
                  </p>
                  <ul className="text-xs space-y-2 text-slate-400 list-disc list-inside flex-1">
                    <li>Toggle <strong>Silent Electric Mode</strong> (<kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-purple-300 font-mono">C</kbd>) on your bike to reduce noise.</li>
                    <li>Equip disguises at Lockers (Maintenance Tech, Lab Scientist, Delivery).</li>
                    <li>Disguises prevent guard bot detection inside restricted facilities.</li>
                    <li>Crouch on foot to sneak past security lasers and surveillance cameras.</li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-300 text-[11px] font-mono border border-purple-500/20">
                    Best for: Tactical planners & silent ghost operatives
                  </div>
                </div>

                {/* 3. SMARTS */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-cyan-500/10 to-slate-950 border border-cyan-500/30 flex flex-col space-y-3">
                  <div className="flex items-center gap-2 text-cyan-300 font-black text-base">
                    <Cpu className="w-5 h-5 text-cyan-400" />
                    <span>THE SMARTS PATH</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Drone surveillance, EMP disruptors, foam launchers, and terminal hacking.
                  </p>
                  <ul className="text-xs space-y-2 text-slate-400 list-disc list-inside flex-1">
                    <li>Deploy the <strong>Mini Recon Drone</strong> (<kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-300 font-mono">3</kbd>) to scout high rooftops.</li>
                    <li>Fire <strong>EMP Blasts</strong> (<kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-300 font-mono">G</kbd>) to short-circuit guard bots and cameras.</li>
                    <li>Shoot <strong>Sticky Foam</strong> to trap pursuing syndicate units safely.</li>
                    <li>Hack Security Terminals (<kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-300 font-mono">E</kbd>) to open locked blast gates.</li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-300 text-[11px] font-mono border border-cyan-500/20">
                    Best for: Tech hackers & electronic warfare experts
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP STORY WALKTHROUGH */}
          {activeTab === 'walkthrough' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-xs text-slate-400 font-mono">
                THE MAIN STORY CAMPAIGN: "THE MIDNIGHT PROTOTYPE"
              </div>

              <div className="space-y-4">
                {[
                  {
                    step: 'STEP 1',
                    title: 'Infiltrate Technology Museum',
                    target: 'North Museum District (X: -30, Z: -85)',
                    desc: 'Ride north from V9 Academy to the Museum. The main plaza is monitored by syndicate bots.',
                    hints: {
                      speed: 'Accelerate down Central Boulevard, drift the roundabout, and boost into the courtyard.',
                      stealth: 'Equip the Lab Scientist disguise from the alley locker to walk right past guard bots.',
                      smarts: 'Launch the Mini Drone, tag the cameras, and fire an EMP burst to deactivate the laser gate.',
                    },
                  },
                  {
                    step: 'STEP 2',
                    title: 'Locate Syndicate Extraction Vehicle',
                    target: 'Underground Museum Garage (X: -55, Z: -110)',
                    desc: 'Search the museum perimeter to locate the stolen Zero-Gravity Energy Core.',
                    hints: {
                      speed: 'Jump the elevated concrete ramp over the museum side barrier directly into the lower dock.',
                      stealth: 'Climb the side emergency staircase and drop through the unlocked ventilation duct.',
                      smarts: 'Hack the exterior power junction terminal to disable all surveillance monitors simultaneously.',
                    },
                  },
                  {
                    step: 'STEP 3',
                    title: 'Pursue Transport across High-Line Monorail',
                    target: 'Skyway Monorail Track (X: 0, Z: -40)',
                    desc: 'The syndicate is escaping along the elevated Monorail line! Climb the access ramp and intercept them.',
                    hints: {
                      speed: 'Hit nitro boost along the monorail tracks and jump between rail segments at 60+ MPH.',
                      stealth: 'Drive in Silent Electric Mode to stay beneath radar while matching the syndicate speed.',
                      smarts: 'Deploy the EMP Gadget while drafting behind the syndicate van to disable its steering.',
                    },
                  },
                  {
                    step: 'STEP 4',
                    title: 'Hack Cargo Dock Crane Controls',
                    target: 'East Cargo Bay Harbor (X: 65, Z: 20)',
                    desc: 'The energy core is being transferred to the Giant Cargo Drone. Override the dock crane to block the launch pad.',
                    hints: {
                      speed: 'Perform a high-speed drift through the container maze and launch onto the crane gantry.',
                      stealth: 'Slip into the Maintenance Tech locker disguise to access the crane cabin undetected.',
                      smarts: 'Use the remote drone hacking antenna to bypass the crane terminal firewall in seconds.',
                    },
                  },
                  {
                    step: 'STEP 5 (CLIMAX)',
                    title: 'Neutralize Giant Cargo Drone & Secure Core',
                    target: 'East Launch Pad (X: 40, Z: 70)',
                    desc: 'The Giant Cargo Drone is powering up its three plasma relays! Disable all 3 relays to force a safe landing.',
                    hints: {
                      speed: 'Boost off the cargo container ramps and ram the airborne relay nodes mid-flight.',
                      stealth: 'Sneak between cargo crates and activate the ground override switches in silence.',
                      smarts: 'Fire EMP shots directly into the 3 glowing drone plasma relays to shut down its engines!',
                    },
                  },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold font-mono">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs">
                          {item.step}
                        </span>
                        <span className="text-white text-sm">{item.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        {item.target}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{item.desc}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <strong className="text-amber-300">⚡ Speed: </strong>
                        <span className="text-slate-300">{item.hints.speed}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
                        <strong className="text-purple-300">👁️ Stealth: </strong>
                        <span className="text-slate-300">{item.hints.stealth}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                        <strong className="text-cyan-300">💻 Smarts: </strong>
                        <span className="text-slate-300">{item.hints.smarts}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CITY DISTRICTS & GPS */}
          {activeTab === 'city' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-xs text-slate-400 font-mono">
                VELOCITY CITY EXPLORATION & LANDMARK GUIDE
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: 'V9 Academy Quarter',
                    coords: [-60, 0, -48],
                    category: 'Headquarters',
                    desc: 'Your home base. Features the V9 Customization Garage, training courses, and Agent Kira communications.',
                  },
                  {
                    name: 'Central Downtown Plaza',
                    coords: [0, 0, 0],
                    category: 'Hub',
                    desc: 'The beating heart of Velocity City. Features the Sky-Piercer Needle, Maya the Street Racer, and heavy traffic.',
                  },
                  {
                    name: 'Technology Museum District',
                    coords: [-30, 0, -85],
                    category: 'Story District',
                    desc: 'High-tech exhibit hall where the Zero-Gravity Core was stolen. Heavily guarded by syndicate patrol units.',
                  },
                  {
                    name: 'East Cargo Bay Harbor',
                    coords: [65, 0, 20],
                    category: 'Industrial',
                    desc: 'Massive shipping cranes, cargo containers, elevated gantries, and the Giant Cargo Drone extraction site.',
                  },
                  {
                    name: 'Cyber Gas Station (North)',
                    coords: [0, 0, -85],
                    category: 'Plasma Fuel',
                    desc: 'North Avenue plasma refueling station with high-voltage charging pads and convenience kiosk.',
                  },
                  {
                    name: 'Cyber Gas Station (South)',
                    coords: [0, 0, 85],
                    category: 'Plasma Fuel',
                    desc: 'South Harbor plasma recharge depot with nitro replenishment canisters.',
                  },
                ].map((district, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm">{district.name}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {district.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{district.desc}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono text-slate-500">
                        X: {district.coords[0]}, Z: {district.coords[2]}
                      </span>
                      {onSelectPOI && (
                        <button
                          onClick={() => {
                            onSelectPOI(district.coords as [number, number, number], district.name);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-xs font-mono font-bold text-cyan-300 hover:text-cyan-200 transition cursor-pointer"
                        >
                          <span>Set GPS</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONTROLS & MOVES */}
          {activeTab === 'controls' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-cyan-300 font-mono text-xs flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    KEYBOARD & MOUSE CONTROLS
                  </h4>
                  <div className="space-y-2 text-xs">
                    {[
                      { key: 'W / A / S / D or Arrows', action: 'Drive / Steer / Accelerate / Brake' },
                      { key: 'Space', action: 'Super Jump (Bike) / Jump (On-Foot)' },
                      { key: 'Left Shift', action: 'Nitro Boost / Drift (Cornering)' },
                      { key: 'E', action: 'Interact / Mount / Talk to NPC / Hack' },
                      { key: 'C', action: 'Silent Mode (Bike) / Crouch Sneak (Foot)' },
                      { key: 'G', action: 'Fire Equipped Gadget (EMP / Foam)' },
                      { key: '1 / 2 / 3 / 4 / 5', action: 'Select Gadget (EMP, Foam, Drone, Decoy, Remote)' },
                      { key: 'V', action: 'Cycle Camera View (Chase, Action, FPV)' },
                      { key: 'Mouse Drag / Touch', action: 'Orbit 360° Camera View' },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-800/60">
                        <span className="font-mono text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          {row.key}
                        </span>
                        <span className="text-slate-300">{row.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-amber-300 font-mono text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    PRO STUNT & DRIVING MECHANICS
                  </h4>
                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <strong className="text-amber-300 font-mono block mb-1">⚡ Kinetic Nitro Drift</strong>
                      Drifting around corners with <kbd className="px-1 bg-slate-800 rounded text-cyan-300 font-mono">Shift</kbd> + steering generates kinetic nitro energy. The longer your drift arc, the higher your score multiplier!
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <strong className="text-emerald-300 font-mono block mb-1">🚀 Super Ramp Boost</strong>
                      Hit yellow rooftop ramps at 40+ MPH with Nitro active to launch across building gaps and clear laser perimeters.
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <strong className="text-purple-300 font-mono block mb-1">🛡️ Shadow Disguise Bypass</strong>
                      When wearing a matching disguise (e.g. Lab Scientist in Museum), guard bot detection cones turn yellow and will ignore you!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: VEHICLE & GADGETS */}
          {activeTab === 'upgrades' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                <h4 className="font-bold text-cyan-300 font-mono text-xs">
                  V9 AGENT ARSENAL & GADGET SUITE
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-cyan-300 font-mono">
                      <Zap className="w-4 h-4" />
                      <span>EMP Pulse Disruptor (1)</span>
                    </div>
                    <p className="text-slate-300">
                      Emits an electromagnetic surge that temporarily disables guard bots, surveillance cameras, and laser fields within a 14-meter radius.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-emerald-300 font-mono">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Sticky Foam Cannon (2)</span>
                    </div>
                    <p className="text-slate-300">
                      Fires a rapid-expanding polymer foam projectile that immobilizes pursuers and patrol bots safely without causing permanent damage.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/20 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-300 font-mono">
                      <Radio className="w-4 h-4" />
                      <span>Mini Recon Drone (3)</span>
                    </div>
                    <p className="text-slate-300">
                      Deploys an autonomous aerial drone with bird's-eye camera view. Can fly to high rooftops and remote-hack security junctions.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-pink-950/30 border border-pink-500/20 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-pink-300 font-mono">
                      <Sparkles className="w-4 h-4" />
                      <span>Holographic Decoy (4)</span>
                    </div>
                    <p className="text-slate-300">
                      Projects a duplicate holographic illusion of Agent V9 that attracts guard bot attention and vision cones away from your infiltration path.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 text-xs font-mono">
          <span className="text-slate-500">
            Agent V9 Operations System v2.4 // Velocity City
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black tracking-wide shadow-lg shadow-cyan-500/25 transition active:scale-95 cursor-pointer"
          >
            RETURN TO MISSION
          </button>
        </div>
      </div>
    </div>
  );
};
