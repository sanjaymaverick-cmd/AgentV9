import React from 'react';
import { X, ShieldCheck, Clock, Volume2, Compass, HeartHandshake, Gauge } from 'lucide-react';
import { GameSettings } from '../types/game';
import { soundEngine } from '../game/audio';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/60 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Parental & Gameplay Settings</h2>
              <p className="text-xs text-slate-400">Child-first safety, session timers, and accessibility controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Child-Safe Promise Banner */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-3">
            <HeartHandshake className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wider">Child-First Product Guarantee</h4>
              <p className="text-xs text-emerald-100/80 mt-0.5 leading-relaxed">
                Agent V9 is designed specifically for children ages 8–12 with zero violence, no loot boxes, no advertisements, and 100% offline-ready play.
              </p>
            </div>
          </div>

          {/* Session Timer */}
          <div>
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2.5">
              <Clock className="w-4 h-4 text-cyan-400" /> Play Session Reminder
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { min: 0, label: 'Off' },
                { min: 15, label: '15 Mins' },
                { min: 30, label: '30 Mins' },
                { min: 45, label: '45 Mins' },
              ].map((item) => (
                <button
                  key={item.min}
                  onClick={() => onUpdateSettings({ ...settings, timeLimitMinutes: item.min })}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    settings.timeLimitMinutes === item.min
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Touch Controls Mode */}
          <div>
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2.5">
              <Compass className="w-4 h-4 text-cyan-400" /> Touch & Movement Controls
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onUpdateSettings({ ...settings, touchControlMode: 'joystick' })}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  settings.touchControlMode === 'joystick'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-md'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-black flex items-center justify-between">
                  <span>Virtual Analog Stick</span>
                  {settings.touchControlMode === 'joystick' && <span className="text-[10px] bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded font-black">ACTIVE</span>}
                </div>
                <span className="text-[11px] text-slate-400">Smooth 360° steering & proportional throttle</span>
              </button>

              <button
                onClick={() => onUpdateSettings({ ...settings, touchControlMode: 'dpad' })}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  settings.touchControlMode === 'dpad'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-md'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-black flex items-center justify-between">
                  <span>Classic Directional D-Pad</span>
                  {settings.touchControlMode === 'dpad' && <span className="text-[10px] bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded font-black">ACTIVE</span>}
                </div>
                <span className="text-[11px] text-slate-400">Crisp discrete arrow buttons for easy steering</span>
              </button>
            </div>
          </div>

          {/* Graphics Quality (spec §26) */}
          <div>
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2.5">
              <Gauge className="w-4 h-4 text-cyan-400" /> Graphics Quality
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {([
                { level: 'low', label: 'Low', hint: 'Best speed' },
                { level: 'medium', label: 'Medium', hint: 'Balanced' },
                { level: 'high', label: 'High', hint: 'Best looks' },
              ] as const).map((item) => (
                <button
                  key={item.level}
                  onClick={() => onUpdateSettings({ ...settings, qualityLevel: item.level })}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    settings.qualityLevel === item.level
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[10px] font-semibold ${settings.qualityLevel === item.level ? 'text-slate-900/70' : 'text-slate-500'}`}>
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">
              Auto-picked for this device on first launch — adjust if the ride feels choppy.
              Tablets default to Low so a 1600×2560 panel does not fill millions of pixels.
            </p>
            <button
              onClick={() => onUpdateSettings({ ...settings, showPerfHud: !settings.showPerfHud })}
              className={`mt-2 w-full py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                settings.showPerfHud
                  ? 'bg-fuchsia-500 text-slate-950 border-fuchsia-400'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {settings.showPerfHud ? 'FPS overlay ON' : 'Show FPS overlay (tablet check)'}
            </button>
          </div>

          {/* Steering Assistance Level */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" /> Steering & Balance Assist
              </label>
              <span className="text-xs font-bold text-amber-400">
                {settings.steeringAssist > 0.6 ? 'High Assist (Easier)' : settings.steeringAssist > 0.2 ? 'Balanced' : 'Arcade Pro'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.25"
              value={settings.steeringAssist}
              onChange={(e) => onUpdateSettings({ ...settings, steeringAssist: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-semibold">
              <span>Pro Arcade</span>
              <span>Younger Driver Assist</span>
            </div>
          </div>

          {/* Audio Controls */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-purple-400" /> Audio Synthesizer Controls
            </h4>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700 cursor-pointer">
                <span className="text-xs font-bold text-white">Dynamic Spy Synth Music Loop</span>
                <input
                  type="checkbox"
                  checked={soundEngine.musicEnabled}
                  onChange={(e) => {
                    soundEngine.setMusicEnabled(e.target.checked);
                    onUpdateSettings({ ...settings });
                  }}
                  className="w-4 h-4 accent-cyan-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700 cursor-pointer">
                <span className="text-xs font-bold text-white">Voice Guidance (Agent Kira & V9 AI)</span>
                <input
                  type="checkbox"
                  checked={soundEngine.voiceEnabled}
                  onChange={(e) => {
                    soundEngine.voiceEnabled = e.target.checked;
                    onUpdateSettings({ ...settings });
                  }}
                  className="w-4 h-4 accent-cyan-400 cursor-pointer"
                />
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider transition active:scale-95 cursor-pointer"
          >
            Save & Close
          </button>
        </div>

      </div>
    </div>
  );
};
