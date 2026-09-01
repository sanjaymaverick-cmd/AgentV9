import React, { useState } from 'react';
import { Check, Palette, Shirt, Zap, Shield, Wrench, Package, FlaskConical, Flag, Sparkles } from 'lucide-react';
import { VehicleCustomization, DisguiseType, PlayerStats } from '../types/game';
import { soundEngine } from '../game/audio';
import { HudModal } from './HudModal';

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

const DISGUISES: { id: DisguiseType; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'agent_suit', name: 'V9 Academy Stealth Suit', desc: 'Standard high-tech tactical jumpsuit with night visor.', icon: Shield },
  { id: 'delivery_worker', name: 'Velocity Courier Outfit', desc: 'Blends in near food stalls, transit hubs, and cargo docks.', icon: Package },
  { id: 'maintenance_tech', name: 'Technician Safety Uniform', desc: 'Allows authorized entry into vents, electrical hubs, and museum docks.', icon: Wrench },
  { id: 'lab_scientist', name: 'Research Lab Coat', desc: 'Access high-tech laboratory rooms and prototype test areas.', icon: FlaskConical },
  { id: 'race_crew', name: 'Grand Prix Race Crew', desc: 'Free access around speedways and cargo rail terminals.', icon: Flag },
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
    <HudModal
      title="V9 Academy Garage"
      subtitle="Paint, disguises, and kit"
      icon={Wrench}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-xs text-hud-muted">
            Rank <strong className="text-hud-fg">{stats.rank}</strong>
          </span>
          <button type="button" onClick={onClose} className="hud-btn px-4 text-hud-fg text-xs">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="hud-primary">
            Apply changes
          </button>
        </>
      }
    >
      <div className="flex gap-2 mb-5">
        {(
          [
            { id: 'paint', label: 'Paint', icon: Palette },
            { id: 'disguises', label: 'Disguises', icon: Shirt },
            { id: 'upgrades', label: 'Kit', icon: Zap },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`hud-chip flex-1 inline-flex items-center justify-center gap-2 ${
                activeTab === tab.id ? 'hud-chip-on' : ''
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'paint' && (
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider block mb-2.5">
              Body color
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {BODY_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onClick={() => setTempCustom({ ...tempCustom, bodyColor: col.value })}
                  className={`h-11 rounded-[10px] border ${
                    tempCustom.bodyColor === col.value ? 'border-hud-fg' : 'border-hud-line'
                  }`}
                  style={{ backgroundColor: col.value }}
                  title={col.name}
                >
                  {tempCustom.bodyColor === col.value && <Check className="w-4 h-4 mx-auto text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider block mb-2.5">
              Underglow
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {UNDERGLOW_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onClick={() => setTempCustom({ ...tempCustom, underglowColor: col.value })}
                  className={`h-11 rounded-[10px] border ${
                    tempCustom.underglowColor === col.value ? 'border-hud-fg' : 'border-hud-line'
                  }`}
                  style={{ backgroundColor: col.value }}
                  title={col.name}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider block mb-2.5">
              Decal
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'stripes', name: 'Velocity stripes' },
                { id: 'cyber', name: 'Grid' },
                { id: 'academy', name: 'Academy emblem' },
                { id: 'stealth', name: 'Blackout' },
                { id: 'flames', name: 'Boost flames' },
              ].map((decal) => (
                <button
                  key={decal.id}
                  type="button"
                  onClick={() => setTempCustom({ ...tempCustom, decalStyle: decal.id as VehicleCustomization['decalStyle'] })}
                  className={tempCustom.decalStyle === decal.id ? 'hud-chip hud-chip-on' : 'hud-chip'}
                >
                  {decal.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'disguises' && (
        <div className="space-y-2">
          <p className="text-xs text-hud-muted mb-3">
            The right outfit lets you walk past CHAOS bots and cameras.
          </p>
          {DISGUISES.map((d) => {
            const isUnlocked = stats.unlockedDisguises.includes(d.id);
            const isSelected = selectedDisguise === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  if (isUnlocked) setSelectedDisguise(d.id);
                }}
                disabled={!isUnlocked}
                className={`w-full hud-chip flex items-center justify-between ${isSelected ? 'hud-chip-on' : ''} ${
                  isUnlocked ? '' : 'opacity-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <d.icon className="w-5 h-5 shrink-0" />
                  <span>
                    <span className="block text-sm">{d.name}</span>
                    <span className="block text-[11px] font-normal opacity-80 mt-0.5">{d.desc}</span>
                  </span>
                </span>
                <span className="text-[11px] shrink-0 ml-2">
                  {isSelected ? 'Equipped' : isUnlocked ? 'Select' : 'Locked'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'upgrades' && (
        <div className="space-y-2">
          {[
            { name: 'Nitro Turbo Boost LV2', desc: 'Top boost 95 MPH, shorter recharge.', icon: Zap, unlocked: true },
            { name: 'Super-Jump Kinetic Springs', desc: 'Doubles jump height off flat roads.', icon: Sparkles, unlocked: true },
            { name: 'Silent Electric Dampers', desc: 'Cuts guard hearing in Silent Mode.', icon: Shield, unlocked: true },
            { name: 'EMP Radius Coil Overclock', desc: 'Wider EMP blast.', icon: Zap, unlocked: false },
            { name: 'High-Capacity Foam Tank', desc: 'Six foam shots in a row.', icon: Shield, unlocked: false },
          ].map((upg) => (
            <div key={upg.name} className="hud-chip flex items-center justify-between">
              <span className="flex items-center gap-3">
                <upg.icon className="w-5 h-5 text-hud-accent shrink-0" />
                <span>
                  <span className="block text-sm">{upg.name}</span>
                  <span className="block text-[11px] font-normal text-hud-muted mt-0.5">{upg.desc}</span>
                </span>
              </span>
              <span className="text-[11px] shrink-0 ml-2">{upg.unlocked ? 'Installed' : 'Rank 3'}</span>
            </div>
          ))}
        </div>
      )}
    </HudModal>
  );
};
