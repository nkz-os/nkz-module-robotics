import React, { useState, useCallback } from 'react';
import { Search, Plus, Layers, Grid3X3, List, Pause, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { useFleet } from '../../hooks/useFleet';
import RobotCard from './RobotCard';
import FleetMap from './FleetMap';
import FleetTable from './FleetTable';
import GeofenceEditor from './GeofenceEditor';
import RouteHistory from './RouteHistory';
import AddRobotWizard from './AddRobotWizard';
import type { Geofence } from '../../types/robotics';

interface FleetDashboardProps {
  onOpenCockpit: (id: string) => void;
}

type FilterKey = 'all' | 'warnings' | 'stopped' | 'no_comms';

const FleetDashboard: React.FC<FleetDashboardProps> = ({ onOpenCockpit }) => {
  const { t } = useTranslation('robotics');
  const { robots } = useFleet();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [drawingGeofence, setDrawingGeofence] = useState(false);
  const [activeGeofenceId, setActiveGeofenceId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Filters
  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'warnings', label: '⚠ Warnings' },
    { key: 'stopped', label: 'Stopped' },
    { key: 'no_comms', label: 'No comms > 30s' },
  ];

  const now = Date.now();
  const noCommsThreshold = 30_000; // 30 seconds

  const filtered = robots.filter(r => {
    const matchesSearch = (r.name || r.id).toLowerCase().includes(search.toLowerCase());
    const mode = r.operationMode || 'MONITOR';
    const lastSeen = r.dateModified ? new Date(r.dateModified).getTime() : 0;
    const commsLost = now - lastSeen > noCommsThreshold;

    if (!matchesSearch) return false;
    switch (activeFilter) {
      case 'warnings': return mode === 'MANUAL' || (r.battery ?? 0) < 20;
      case 'stopped': return mode === 'MONITOR' || mode === 'ESTOP';
      case 'no_comms': return commsLost;
      default: return true;
    }
  });

  // Sort: alerts first → stopped → running → idle
  const sorted = [...filtered].sort((a, b) => {
    const order: Record<string, number> = { ESTOP: 0, MANUAL: 0, MONITOR: 1, AUTO: 2 };
    const aOrder = order[a.operationMode || 'MONITOR'] ?? 3;
    const bOrder = order[b.operationMode || 'MONITOR'] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Within same group, lower battery first
    return (a.battery ?? 0) - (b.battery ?? 0);
  });

  const handleRouteLoaded = useCallback((geometry: any) => {
    setRouteGeometry(geometry);
  }, []);

  const handleStartDrawing = () => setDrawingGeofence(true);
  const handleCancelDrawing = () => setDrawingGeofence(false);

  const handleSaveGeofence = (name: string, type: 'inclusion' | 'exclusion') => {
    const newFence: Geofence = {
      id: `gf-${Date.now()}`,
      name,
      type,
      geometry: { type: 'Polygon', coordinates: [] },
      active: true,
    };
    setGeofences([...geofences, newFence]);
    setDrawingGeofence(false);
  };

  const handleDeleteGeofence = (id: string) => {
    setGeofences(geofences.filter(g => g.id !== id));
    if (activeGeofenceId === id) setActiveGeofenceId(null);
  };

  const handlePauseAll = () => {
    // TODO: POST /fleet/actions/pause-all
    console.log('[FleetDashboard] Pause All requested');
  };

  const handleEStopAll = () => {
    // TODO: POST /fleet/actions/estop-all with double confirm
    console.log('[FleetDashboard] E-Stop All requested');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="text-rose-500" />
          {t('fleet.title')}
        </h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('fleet.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-56"
            />
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded ${viewMode === 'cards' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List size={14} />
            </button>
          </div>

          {/* Register button */}
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            {t('fleet.registerRobot')}
          </button>

          {/* Global actions */}
          <button
            onClick={handlePauseAll}
            className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-medium rounded-lg flex items-center gap-1.5 border border-amber-500/20 transition-colors"
          >
            <Pause size={14} />
            Pause All
          </button>
          <button
            onClick={handleEStopAll}
            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium rounded-lg flex items-center gap-1.5 border border-red-500/20 transition-colors"
          >
            <AlertTriangle size={14} />
            E-Stop All
          </button>
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeFilter === f.key
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-slate-600 self-center ml-2">{sorted.length} robots</span>
      </div>

      {/* Robot list: cards or table */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Layers size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">{t('fleet.noRobots')}</p>
          <p className="text-sm mt-2">{t('fleet.noRobotsHint')}</p>
        </div>
      ) : viewMode === 'table' ? (
        <FleetTable robots={sorted} onOpenCockpit={onOpenCockpit} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(robot => (
            <RobotCard key={robot.id} robot={robot} onOpenCockpit={onOpenCockpit} />
          ))}
        </div>
      )}

      {/* Map + Sidebar */}
      <div className="flex gap-4">
        <div className="flex-1">
          <FleetMap
            robots={sorted}
            onSelectRobot={setSelectedRobotId}
            routeGeometry={routeGeometry}
          />
        </div>
        <div className="w-64 space-y-4">
          <GeofenceEditor
            geofences={geofences}
            activeGeofenceId={activeGeofenceId}
            onStartDrawing={handleStartDrawing}
            onSaveCurrent={handleSaveGeofence}
            onCancelDrawing={handleCancelDrawing}
            onDelete={handleDeleteGeofence}
            onSelectGeofence={setActiveGeofenceId}
            drawing={drawingGeofence}
          />
          <RouteHistory
            robotId={selectedRobotId}
            onRouteLoaded={handleRouteLoaded}
          />
        </div>
      </div>

      <AddRobotWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onNavigateToCockpit={onOpenCockpit}
      />
    </div>
  );
};

export default FleetDashboard;
