import React, { useState } from 'react';
import { CityPOI, POICategory } from '../types/game';
import { 
  MapPin, 
  Compass, 
  Fuel, 
  Building2, 
  Flag, 
  ShieldCheck, 
  Sparkles, 
  ArrowUpRight, 
  X, 
  Navigation, 
  Radio,
  Layers,
  Cpu
} from 'lucide-react';

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
    { id: 'all', label: 'All POIs', icon: Layers },
    { id: 'story', label: 'Story Objectives', icon: Flag },
    { id: 'fuel', label: 'Gas Stations', icon: Fuel },
    { id: 'side', label: 'Side Quests', icon: Radio },
    { id: 'landmark', label: 'Landmarks', icon: Building2 },
    { id: 'terminal', label: 'Hacking Terminals', icon: Cpu },
  ];

  const filteredPois = pois.filter((poi) => {
    const matchesCat = selectedCategory === 'all' || poi.category === selectedCategory;
    const matchesQuery = poi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         poi.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         poi.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        id="v9-map-explorer-modal"
        className="relative w-full max-w-4xl max-h-[88vh] flex flex-col bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden text-slate-100 font-sans"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-inner">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-300">
                VELOCITY CITY GPS & DISTRICT DIRECTORY
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Real-time Navigation & Landmark Locator
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

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-3 bg-slate-950/50 border-b border-slate-800">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto text-xs font-mono">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search district, gas station, landmark..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* POI Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPois.map((poi) => {
            const dist = Math.round(
              Math.hypot(playerPos[0] - poi.position[0], playerPos[2] - poi.position[2])
            );
            const isTargeted = activeGPSDestinationId === poi.id;

            const isGas = poi.category === 'fuel';
            const isStory = poi.category === 'story';
            const isSide = poi.category === 'side';

            const badgeColor = isGas
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : isStory
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : isSide
              ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';

            return (
              <div
                key={poi.id}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition ${
                  isTargeted
                    ? 'bg-cyan-950/40 border-cyan-400/80 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                        {poi.district}
                      </span>
                      <h3 className="font-bold text-white text-sm mt-1.5">{poi.name}</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400 whitespace-nowrap">
                      {dist}m away
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {poi.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-500">
                    Pos: ({poi.position[0]}, {poi.position[2]})
                  </span>

                  {isTargeted ? (
                    <button
                      onClick={onClearGPS}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
                    >
                      Clear GPS Route
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onSetGPS(poi);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 transition active:scale-95 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Set 3D GPS Route</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs font-mono">
          <span className="text-slate-500">
            Showing {filteredPois.length} locations across Velocity City
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
