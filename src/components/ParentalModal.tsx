import React from 'react';
import { ShieldCheck, Clock, Volume2, Compass, HeartHandshake, Gauge } from 'lucide-react';
import { GameSettings } from '../types/game';
import { soundEngine } from '../game/audio';
import { HudModal } from './HudModal';

interface ParentalModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const ParentalModal: React.FC<ParentalModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <HudModal
      title="Parental & gameplay"
      subtitle="Session timer, quality, and accessibility"
      icon={ShieldCheck}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="hud-primary">
          Save & close
        </button>
      }
    >
      <div className="space-y-6">
        <div className="hud-panel p-4 flex items-start gap-3">
          <HeartHandshake className="w-5 h-5 text-hud-ok shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold text-hud-fg">Made for ages 8–12</h4>
            <p className="text-xs text-hud-muted mt-0.5 leading-relaxed">
              Zero violence, no loot boxes, no ads, and fully offline.
            </p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider flex items-center gap-2 mb-2.5">
            <Clock className="w-4 h-4 text-hud-accent" /> Play session reminder
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { min: 0, label: 'Off' },
              { min: 15, label: '15 min' },
              { min: 30, label: '30 min' },
              { min: 45, label: '45 min' },
            ].map((item) => (
              <button
                key={item.min}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, timeLimitMinutes: item.min })}
                className={settings.timeLimitMinutes === item.min ? 'hud-chip-on hud-chip' : 'hud-chip'}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider flex items-center gap-2 mb-2.5">
            <Compass className="w-4 h-4 text-hud-accent" /> Touch movement
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, touchControlMode: 'joystick' })}
              className={settings.touchControlMode === 'joystick' ? 'hud-chip hud-chip-on' : 'hud-chip'}
            >
              Analog stick
              <span className="block text-[11px] font-normal opacity-80 mt-0.5">360° steer and throttle</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, touchControlMode: 'dpad' })}
              className={settings.touchControlMode === 'dpad' ? 'hud-chip hud-chip-on' : 'hud-chip'}
            >
              D-pad
              <span className="block text-[11px] font-normal opacity-80 mt-0.5">Discrete arrows</span>
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider flex items-center gap-2 mb-2.5">
            <Gauge className="w-4 h-4 text-hud-accent" /> Graphics
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { level: 'low', label: 'Low', hint: 'Best speed' },
              { level: 'medium', label: 'Medium', hint: 'Balanced' },
              { level: 'high', label: 'High', hint: 'Best looks' },
            ] as const).map((item) => (
              <button
                key={item.level}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, qualityLevel: item.level })}
                className={`hud-chip flex flex-col items-center justify-center ${
                  settings.qualityLevel === item.level ? 'hud-chip-on' : ''
                }`}
              >
                {item.label}
                <span className="text-[10px] font-normal opacity-80">{item.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-hud-muted mt-2">
            Auto-picked on first launch. Tablets default to Low so a large panel stays smooth.
          </p>
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, showPerfHud: !settings.showPerfHud })}
            className={`mt-2 w-full hud-chip ${settings.showPerfHud ? 'hud-chip-on' : ''}`}
          >
            {settings.showPerfHud ? 'FPS overlay on' : 'Show FPS overlay'}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-hud-accent" /> Steering assist
            </label>
            <span className="text-xs text-hud-fg">
              {settings.steeringAssist > 0.6 ? 'High' : settings.steeringAssist > 0.2 ? 'Balanced' : 'Arcade'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.25"
            value={settings.steeringAssist}
            onChange={(e) => onUpdateSettings({ ...settings, steeringAssist: parseFloat(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-hud-track accent-[var(--color-hud-accent)]"
          />
          <div className="flex justify-between text-[10px] text-hud-muted mt-1">
            <span>Pro</span>
            <span>Younger driver</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-hud-accent" /> Audio
          </h4>
          <label className="hud-chip flex items-center justify-between cursor-pointer">
            <span>Music</span>
            <input
              type="checkbox"
              checked={soundEngine.musicEnabled}
              onChange={(e) => {
                soundEngine.setMusicEnabled(e.target.checked);
                onUpdateSettings({ ...settings });
              }}
              className="w-4 h-4 accent-[var(--color-hud-accent)]"
            />
          </label>
          <label className="hud-chip flex items-center justify-between cursor-pointer">
            <span>Voice guidance</span>
            <input
              type="checkbox"
              checked={soundEngine.voiceEnabled}
              onChange={(e) => {
                soundEngine.voiceEnabled = e.target.checked;
                onUpdateSettings({ ...settings });
              }}
              className="w-4 h-4 accent-[var(--color-hud-accent)]"
            />
          </label>
        </div>
      </div>
    </HudModal>
  );
};
