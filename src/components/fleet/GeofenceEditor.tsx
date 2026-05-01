import React, { useState } from 'react';
import { useTranslation } from '@nekazari/sdk';
import type { Geofence } from '../../types/robotics';

interface GeofenceEditorProps {
  geofences: Geofence[];
  onSave: (fence: Omit<Geofence, 'id'>) => void;
  onDelete: (id: string) => void;
}

const GeofenceEditor: React.FC<GeofenceEditorProps> = ({ geofences, onSave: _onSave, onDelete: _onDelete }) => {
  const { t } = useTranslation('robotics');
  const [drawing, setDrawing] = useState(false);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('fleet.geofences')}</h3>
      <button
        onClick={() => setDrawing(!drawing)}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
      >
        {t('fleet.drawGeofence')}
      </button>
      {geofences.length === 0 && (
        <p className="text-xs text-slate-500 mt-3">No geofences defined yet.</p>
      )}
    </div>
  );
};

export default GeofenceEditor;
