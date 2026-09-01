import React, { useState } from 'react';
import { CityPOI } from '../types/game';
import {
  Compass,
  Fuel,
  Building2,
  Flag,
  X,
  Navigation,
  Radio,
  Layers,
  Cpu,
} from 'lucide-react';
import { HudModal } from './HudModal';

interface MapExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pois: CityPOI[];
  playerPos: [number, number, number];
  activeGPSDestinationId?: string;
  onSetGPS: (poi: CityPOI) => void;
  onClearGPS: () => void;
}

export const MapExplorerModal: React.FC<MapExplorerModalProps> = ({
  isOpen,
  onClose,
  pois,
  playerPos,
  activeGPSDestinationId,
  onSetGPS,
  onClearGPS,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All', icon: Layers },
    { id: 'story', label: 'Story', icon: Flag },
    { id: 'fuel', label: 'Fuel', icon: Fuel },
    { id: 'side', label: 'Side', icon: Radio },
    { id: 'landmark', label: 'Landmarks', icon: Building2 },
    { id: 'terminal', label: 'Terminals', icon: Cpu },
  ];

  const filteredPois = pois.filter((poi) => {
    const matchesCat = selectedCategory === 'all' || poi.category === selectedCategory;
    const matchesQuery =
      poi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      poi.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      poi.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <HudModal
      id="v9-map-explorer-modal"
      title="City map"
      subtitle="Set a GPS pin across Velocity City"
      icon={Compass}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="mr-auto text-xs text-hud-muted">{filteredPois.length} places</span>
          <button type="button" onClick={onClose} className="hud-btn px-4 text-hud-fg text-xs">
            Close map
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const on = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`hud-chip inline-flex items-center gap-1.5 whitespace-nowrap ${on ? 'hud-chip-on' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Search district, fuel, landmark..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="hud-input"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredPois.map((poi) => {
          const dist = Math.round(Math.hypot(playerPos[0] - poi.position[0], playerPos[2] - poi.position[2]));
          const isTargeted = activeGPSDestinationId === poi.id;
          return (
            <div key={poi.id} className={`hud-panel p-4 ${isTargeted ? 'border-hud-accent' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-hud-muted">
                    {poi.district}
                  </span>
                  <h3 className="text-sm font-semibold text-hud-fg mt-1">{poi.name}</h3>
                </div>
                <span className="text-xs font-mono text-hud-muted whitespace-nowrap">{dist}m</span>
              </div>
              <p className="text-xs text-hud-muted mt-2 leading-relaxed">{poi.description}</p>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-hud-line">
                <span className="text-[10px] font-mono text-hud-muted">
                  {poi.position[0]}, {poi.position[2]}
                </span>
                {isTargeted ? (
                  <button type="button" onClick={onClearGPS} className="hud-btn h-11 px-3 text-hud-danger text-xs">
                    <X className="w-3.5 h-3.5 mr-1" /> Clear GPS
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSetGPS(poi);
                      onClose();
                    }}
                    className="hud-primary inline-flex items-center gap-1.5 text-xs"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Set 3D GPS Route
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </HudModal>
  );
};
