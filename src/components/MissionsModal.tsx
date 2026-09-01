import React from 'react';
import { X, Compass, CheckCircle2, Circle, Flame, EyeOff, Sparkles, Award, FileText } from 'lucide-react';
import { Mission, PlayerStats } from '../types/game';

interface MissionsModalProps {
  activeMission: Mission;
  stats: PlayerStats;
  onClose: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  activeMission,
  stats,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/60 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Mission Dossier</h2>
              <p className="text-xs text-slate-400">Track current operations, secrets found, and multiple solution approaches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hud-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Active Story Mission Card */}
          <div className="bg-slate-950/60 border border-cyan-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full uppercase">
                Primary Operation
              </span>
              <span className="text-xs text-slate-400 font-bold">Reward: +{activeMission.rewardXP} XP & {activeMission.rewardCredits} cr</span>
            </div>

            <h3 className="text-xl font-black text-white mb-1.5">{activeMission.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">{activeMission.description}</p>

            {/* Steps Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Mission Milestones</h4>
              {activeMission.steps.map((step, idx) => {
                const isCurrent = idx === activeMission.currentStepIndex && !activeMission.completed;
                const isDone = step.completed || idx < activeMission.currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isCurrent
                        ? 'bg-cyan-500/15 border-cyan-400 shadow-md'
                        : isDone
                        ? 'bg-slate-900/40 border-slate-800 opacity-70'
                        : 'bg-slate-900/20 border-slate-800/60 opacity-40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : isCurrent ? (
                        <Circle className="w-5 h-5 text-cyan-400 animate-pulse shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-extrabold text-white">
                            Step {idx + 1}: {step.title}
                          </h5>
                          {isDone && <span className="text-[10px] text-emerald-400 font-black">COMPLETED</span>}
                          {isCurrent && <span className="text-[10px] text-cyan-400 font-black animate-pulse">IN PROGRESS</span>}
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{step.instruction}</p>

                        {/* Approach Guide */}
                        {isCurrent && (
                          <div className="mt-3 pt-2.5 border-t border-cyan-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                            <div className="bg-orange-950/40 border border-orange-500/30 p-2 rounded-lg text-orange-300">
                              <strong className="flex items-center gap-1 text-orange-400 mb-0.5">
                                <Flame className="w-3 h-3" /> Speed:
                              </strong>
                              {step.approachHint.speed}
                            </div>
                            <div className="bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-lg text-emerald-300">
                              <strong className="flex items-center gap-1 text-emerald-400 mb-0.5">
                                <EyeOff className="w-3 h-3" /> Stealth:
                              </strong>
                              {step.approachHint.stealth}
                            </div>
                            <div className="bg-cyan-950/40 border border-cyan-500/30 p-2 rounded-lg text-cyan-300">
                              <strong className="flex items-center gap-1 text-cyan-400 mb-0.5">
                                <Sparkles className="w-3 h-3" /> Smarts:
                              </strong>
                              {step.approachHint.smarts}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats & Lore Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Award className="w-4 h-4" /> Agent Achievements
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 font-medium">
                <li>• Secret Spy Drives Recovered: <strong>{stats.secretsFound} / 6</strong></li>
                <li>• Stunt High Score: <strong>{stats.stuntHighScore} pts</strong></li>
                <li>• Current Rank: <strong className="text-cyan-300">{stats.rank}</strong></li>
                <li>• Non-Lethal Gadgets Ready: <strong>5 / 5</strong></li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" /> About Organization CHAOS
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                CHAOS is a mischievous group of tech tricksters who hack city delivery drones and stage experimental science heists. As an Agent of V9 Academy, your job is to outsmart them non-lethally!
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider transition active:scale-95 cursor-pointer"
          >
            Return to Mission
          </button>
        </div>

      </div>
    </div>
  );
};
