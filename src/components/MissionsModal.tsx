import React from 'react';
import { Compass, CheckCircle2, Circle, Flame, EyeOff, Sparkles, Award, FileText } from 'lucide-react';
import { Mission, PlayerStats } from '../types/game';
import { HudModal } from './HudModal';

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
    <HudModal
      title="Mission Dossier"
      subtitle="Operations, secrets, and Speed / Stealth / Smarts"
      icon={Compass}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="hud-primary">
          Return to mission
        </button>
      }
    >
      <div className="space-y-6">
        <div className="hud-panel p-5">
          <div className="flex items-center justify-between mb-3 gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-hud-accent border border-hud-line rounded-full px-3 py-1">
              Primary operation
            </span>
            <span className="text-xs text-hud-muted">
              +{activeMission.rewardXP} XP · {activeMission.rewardCredits} cr
            </span>
          </div>
          <h3 className="text-lg font-semibold text-hud-fg mb-1.5">{activeMission.title}</h3>
          <p className="text-xs text-hud-muted leading-relaxed mb-4">{activeMission.description}</p>

          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-hud-muted uppercase tracking-wider">Milestones</h4>
            {activeMission.steps.map((step, idx) => {
              const isCurrent = idx === activeMission.currentStepIndex && !activeMission.completed;
              const isDone = step.completed || idx < activeMission.currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={`p-3.5 rounded-[10px] border border-hud-line ${
                    isCurrent ? 'bg-hud-accent/10' : isDone ? 'opacity-70' : 'opacity-40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-hud-ok shrink-0 mt-0.5" />
                    ) : (
                      <Circle className={`w-5 h-5 shrink-0 mt-0.5 ${isCurrent ? 'text-hud-accent' : 'text-hud-muted'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs font-semibold text-hud-fg">
                          Step {idx + 1}: {step.title}
                        </h5>
                        {isDone && <span className="text-[10px] text-hud-ok font-semibold">Done</span>}
                        {isCurrent && <span className="text-[10px] text-hud-accent font-semibold">Now</span>}
                      </div>
                      <p className="text-xs text-hud-muted mt-1">{step.instruction}</p>
                      {isCurrent && (
                        <div className="mt-3 pt-2.5 border-t border-hud-line grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="hud-panel p-2">
                            <strong className="flex items-center gap-1 text-hud-fg mb-0.5">
                              <Flame className="w-3 h-3 text-hud-accent" /> Speed
                            </strong>
                            <span className="text-hud-muted">{step.approachHint.speed}</span>
                          </div>
                          <div className="hud-panel p-2">
                            <strong className="flex items-center gap-1 text-hud-fg mb-0.5">
                              <EyeOff className="w-3 h-3 text-hud-accent" /> Stealth
                            </strong>
                            <span className="text-hud-muted">{step.approachHint.stealth}</span>
                          </div>
                          <div className="hud-panel p-2">
                            <strong className="flex items-center gap-1 text-hud-fg mb-0.5">
                              <Sparkles className="w-3 h-3 text-hud-accent" /> Smarts
                            </strong>
                            <span className="text-hud-muted">{step.approachHint.smarts}</span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="hud-panel p-4">
            <h4 className="text-[10px] font-semibold text-hud-accent uppercase tracking-wider flex items-center gap-2 mb-2">
              <Award className="w-4 h-4" /> Achievements
            </h4>
            <ul className="text-xs text-hud-muted space-y-1.5">
              <li>Secrets recovered: <strong className="text-hud-fg">{stats.secretsFound} / 6</strong></li>
              <li>Stunt high score: <strong className="text-hud-fg">{stats.stuntHighScore} pts</strong></li>
              <li>Rank: <strong className="text-hud-fg">{stats.rank}</strong></li>
              <li>Gadgets ready: <strong className="text-hud-fg">5 / 5</strong></li>
            </ul>
          </div>
          <div className="hud-panel p-4">
            <h4 className="text-[10px] font-semibold text-hud-accent uppercase tracking-wider flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" /> About CHAOS
            </h4>
            <p className="text-xs text-hud-muted leading-relaxed">
              CHAOS is a mischievous group of tech tricksters who hack city delivery drones and stage experimental science heists. As an Agent of V9 Academy, your job is to outsmart them non-lethally.
            </p>
          </div>
        </div>
      </div>
    </HudModal>
  );
};
