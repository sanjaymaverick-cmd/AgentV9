import React from 'react';
import { NPCLocal } from '../types/game';
import { User, MessageSquare, Flag, ArrowRight, X, Sparkles } from 'lucide-react';

interface NPCDialogueModalProps {
  dialogueState: { npc: NPCLocal; lineIndex: number } | null;
  onAdvance: () => void;
  onClose: () => void;
  onAcceptSideQuest?: (questId: string) => void;
}

export const NPCDialogueModal: React.FC<NPCDialogueModalProps> = ({
  dialogueState,
  onAdvance,
  onClose,
  onAcceptSideQuest,
}) => {
  if (!dialogueState) return null;

  const { npc, lineIndex } = dialogueState;
  const currentLine = npc.dialogue[lineIndex] || '';
  const isLastLine = lineIndex >= npc.dialogue.length - 1;
  const hasSideQuest = Boolean(npc.sideQuestId);

  return (
    <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div 
        id="v9-npc-dialogue-box"
        className="relative bg-hud-bg/95 border border-hud-line rounded-2xl p-5 text-hud-fg font-sans"
      >
        <button
          onClick={onClose}
          className="hud-modal-close absolute top-3 right-3"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          {/* NPC Avatar Portrait */}
          <div className="relative shrink-0">
            <div 
              className="w-14 h-14 rounded-xl border-2 border-white flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: npc.avatarColor || '#ec4899' }}
            >
              <User className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950" />
          </div>

          {/* Dialogue Text Content */}
          <div className="flex-1 space-y-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{npc.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {npc.title}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  [{npc.district}]
                </span>
              </div>
            </div>

            {/* Voiced Line */}
            <p className="text-sm text-slate-200 leading-relaxed font-sans bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              "{currentLine}"
            </p>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Message {lineIndex + 1} of {npc.dialogue.length}</span>
              </div>

              <div className="flex items-center gap-2">
                {hasSideQuest && isLastLine && onAcceptSideQuest && npc.sideQuestId && (
                  <button
                    onClick={() => onAcceptSideQuest(npc.sideQuestId!)}
                    className="flex items-center gap-1.5 px-4 min-h-11 rounded-xl bg-hud-ok/20 border border-hud-ok/40 text-hud-ok font-semibold text-xs"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Accept Side Mission</span>
                  </button>
                )}

                <button
                  onClick={onAdvance}
                  className="flex items-center gap-1.5 px-4 min-h-11 rounded-xl bg-hud-accent text-hud-accent-fg font-semibold text-xs"
                >
                  <span>{isLastLine ? 'End Conversation [E]' : 'Next [E]'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
