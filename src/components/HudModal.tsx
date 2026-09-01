import React from 'react';
import { X } from 'lucide-react';

interface HudModalProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export const HudModal: React.FC<HudModalProps> = ({
  id,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  footer,
  wide,
}) => {
  return (
    <div className="hud-modal-backdrop">
      <div
        id={id}
        className={`hud-modal ${wide ? 'hud-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hud-modal-title"
      >
        <header className="hud-modal-head">
          <div className="hud-modal-icon">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="hud-modal-title" className="text-base font-semibold tracking-wide text-hud-fg">
              {title}
            </h2>
            {subtitle ? <p className="text-xs text-hud-muted mt-0.5">{subtitle}</p> : null}
          </div>
          <button type="button" className="hud-modal-close" onClick={onClose} title="Close">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="hud-modal-body">{children}</div>
        {footer ? <footer className="hud-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
};
