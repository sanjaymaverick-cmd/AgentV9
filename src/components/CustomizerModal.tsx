import React, { useState } from 'react';
import { X, Sparkles, Check, Palette, Shirt, Zap, Shield, Wrench } from 'lucide-react';
import { VehicleCustomization, DisguiseType, PlayerStats } from '../types/game';
import { soundEngine } from '../game/audio';

interface CustomizerModalProps {
  customization: VehicleCustomization;
  stats: PlayerStats;
  currentDisguise: DisguiseType;
  onSave: (custom: VehicleCustomization, disguise: DisguiseType) => void;
  onClose: () => void;
}

const BODY_COLORS = [
  { name: 'Neon Cyan', value: '#06b6d4' },
  { name: 'Cyber Pink', value: '#f43f5e' },
  { name: 'Stealth Carbon', value: '#18181b' },
  { name: 'Laser Yellow', value: '#eab308' },
  { name: 'Emerald Volt', value: '#10b981' },
  { name: 'Ultra Violet', value: '#8b5cf6' },
  { name: 'Turbo Gold', value: '#f59e0b' },
  { name: 'Pure Chrome', value: '#e2e8f0' },
];

const UNDERGLOW_COLORS = [
  { name: 'Cyan Glow', value: '#38bdf8' },
  { name: 'Neon Magenta', value: '#ec4899' },
  { name: 'Toxic Lime', value: '#22c55e' },
  { name: 'Solar Amber', value: '#f59e0b' },
  { name: 'Deep Purple', value: '#a855f7' },
  { name: 'Ghost White', value: '#ffffff' },
];

const DISGUISES: { id: DisguiseType; name: string; desc: string; icon: string }[] = [
  { id: 'agent_suit', name: 'V9 Academy Stealth Suit', desc: 'Standard high-tech tactical jumpsuit with night visor.', icon: '🕵️' },
  { id: 'delivery_worker', name: 'Velocity Courier Outfit', desc: 'Blends in near food stalls, transit hubs, and cargo docks.', icon: '📦' },
  { id: 'maintenance_tech', name: 'Technician Safety Uniform', desc: 'Allows authorized entry into vents, electrical hubs, and museum docks.', icon: '👷' },
  { id: 'lab_scientist', name: 'Research Lab Coat', desc: 'Access high-tech laboratory rooms and prototype test areas.', icon: '🥼' },
  { id: 'race_crew', name: 'Grand Prix Race Crew', desc: 'Free access around speedways and cargo rail terminals.', icon: '🏎️' },
];

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  customization,
  stats,
  currentDisguise,
  onSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'paint' | 'disguises' | 'upgrades'>('paint');
  const [tempCustom, setTempCustom] = useState<VehicleCustomization>({ ...customization });
  const [selectedDisguise, setSelectedDisguise] = useState<DisguiseType>(currentDisguise);

  const handleSave = () => {
    soundEngine.playCollectible();
    onSave(tempCustom, selectedDisguise);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/60 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">V9 Academy Garage</h2>
              <p className="text-xs text-slate-400">Customize your V9 companion motorcycle & agent disguises</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            onClick={() => setActiveTab('paint')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'paint'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" /> V9 Customizer
          </button>
          <button
            onClick={() => setActiveTab('disguises')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'disguises'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shirt className="w-4 h-4" /> Agent Disguises
          </button>
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'upgrades'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" /> Tech Upgrades
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: PAINT & CUSTOMIZATION */}
          {activeTab === 'paint' && (
            <div className="space-y-6">
              {/* Body Paint Color */}
              <div>
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-2.5">
                  V9 Chassis Primary Body Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {BODY_COLORS.map((col) => (
                    <button
                      key={col.value}
                      onClick={() => setTempCustom({ ...tempCustom, bodyColor: col.value })}
                      className={`h-12 rounded-xl border-2 flex items-center justify-center transition active:scale-95 cursor-pointer relative ${
                        tempCustom.bodyColor === col.value ? 'border-white scale-105 shadow-lg' : 'border-slate-700 hover:border-slate-500'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.name}
                    >
                      {tempCustom.bodyColor === col.value && (
                        <Check className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Underglow Color */}
              <div>
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-2.5">
                  Cyber Neon Underglow
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {UNDERGLOW_COLORS.map((col) => (
                    <button
                      key={col.value}
                      onClick={() => setTempCustom({ ...tempCustom, underglowColor: col.value })}
                      className={`h-11 rounded-xl border-2 flex items-center justify-center transition active:scale-95 cursor-pointer ${
                        tempCustom.underglowColor === col.value ? 'border-white shadow-lg' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.name}
                    >
                      {tempCustom.underglowColor === col.value && (
                        <Check className="w-4 h-4 text-black drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Decal Style */}
              <div>
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-2.5">
                  V9 Decal & Aero Kit Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'stripes', name: 'Dual Velocity Stripes' },
                    { id: 'cyber', name: 'Cyber Grid Neon' },
                    { id: 'academy', name: 'V9 Academy Emblem' },
                    { id: 'stealth', name: 'Stealth Blackout' },
                    { id: 'flames', name: 'Plasma Boost Flames' },
                  ].map((decal) => (
                    <button
                      key={decal.id}
                      onClick={() => setTempCustom({ ...tempCustom, decalStyle: decal.id as any })}
                      className={`p-3 rounded-xl border text-xs font-extrabold text-left transition cursor-pointer ${
                        tempCustom.decalStyle === decal.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {decal.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DISGUISES CLOSET */}
          {activeTab === 'disguises' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-4">
                Equipping the correct disguise allows you to walk right past CHAOS security bots and cameras without triggering alarms!
              </p>
              {DISGUISES.map((d) => {
                const isUnlocked = stats.unlockedDisguises.includes(d.id);
                const isSelected = selectedDisguise === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      if (isUnlocked) setSelectedDisguise(d.id);
                    }}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md'
                        : isUnlocked
                        ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                        : 'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-3xl">{d.icon}</span>
                      <div>
                        <h4 className="text-sm font-black text-white">{d.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{d.desc}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="bg-cyan-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full">
                        EQUIPPED
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-xs font-bold text-cyan-400 hover:underline">Select</span>
                    ) : (
                      <span className="text-xs font-bold text-slate-500">🔒 Unlock in City</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: TECH UPGRADES */}
          {activeTab === 'upgrades' && (
            <div className="space-y-3">
              {[
                { name: 'Nitro Turbo Boost LV2', desc: 'Increases top boost speed to 95 MPH and reduces recharge delay.', icon: Zap, unlocked: true },
                { name: 'Super-Jump Kinetic Springs', desc: 'Doubles jump height off flat roads to reach rooftops with V9.', icon: Sparkles, unlocked: true },
                { name: 'Silent Electric Dampers', desc: 'Reduces guard detection radius by 60% in Silent Mode.', icon: Shield, unlocked: true },
                { name: 'EMP Radius Coil Overclock', desc: 'Expands EMP blast radius to disable multiple security bots at once.', icon: Zap, unlocked: false },
                { name: 'High-Capacity Foam Tank', desc: 'Allows 6 consecutive foam shots to seal doors and trap bots.', icon: Shield, unlocked: false },
              ].map((upg, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <upg.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{upg.name}</h4>
                      <p className="text-xs text-slate-400">{upg.desc}</p>
                    </div>
                  </div>
                  {upg.unlocked ? (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black px-3 py-1 rounded-full">
                      INSTALLED
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">Earn at Rank 3</span>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">Agent Rank: <strong className="text-cyan-300">{stats.rank}</strong></span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-lg shadow-cyan-500/30 cursor-pointer"
            >
              Apply Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
