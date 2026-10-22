import React from 'react';

interface MiniMapProps {
  lat: number | null;
  lon: number | null;
}

const MiniMap: React.FC<MiniMapProps> = ({ lat, lon }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2 flex items-center justify-center h-full">
    {lat != null && lon != null ? (
      <div className="text-xs font-mono text-slate-400 text-center">
        <div className="text-emerald-400 text-lg mb-1">{'📍'}</div>
        {lat.toFixed(5)}, {lon.toFixed(5)}
      </div>
    ) : (
      <div className="text-xs font-mono text-slate-600 text-center">
        <div className="text-slate-500 text-lg mb-1">{'🗺️'}</div>
        No GPS fix
      </div>
    )}
  </div>
);

export default MiniMap;
