import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Gamepad2, AlertTriangle, Battery, Signal, Wifi, Activity } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';

// Types
type DriveMode = 'ACKERMANN_FRONT' | 'ACKERMANN_DUAL' | 'CRAB' | 'DIFFERENTIAL';
type OperationMode = 'MONITOR' | 'MANUAL' | 'AUTO';

const OP_MODES: OperationMode[] = ['MONITOR', 'MANUAL', 'AUTO'];

const RoboticsCockpit: React.FC = () => {
    const { t } = useTranslation('robotics');
    const [opMode, setOpMode] = useState<OperationMode>('MONITOR');
    const [driveMode, setDriveMode] = useState<DriveMode>('ACKERMANN_FRONT');
    const [, setLastHeartbeat] = useState<number>(Date.now());
    const [latency] = useState<number>(45); // Mock latency for phase 1 UI

    // Safety Watchdog / Heartbeat Loop
    useEffect(() => {
        if (opMode !== 'MANUAL') return;

        const interval = setInterval(() => {
            // TODO: Send Zenoh Heartbeat here
            // zenoh.put(topic, timestamp)
            setLastHeartbeat(Date.now());
        }, 500); // 2Hz Heartbeat

        return () => clearInterval(interval);
    }, [opMode]);

    // Keyboard Iinput Handling (WASD)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (opMode !== 'MANUAL') return;
        // Map keys to Zenoh twist messages
        // e.g. W -> linear.x += 0.1
        console.log(`Key pressed: ${e.key} for drive mode ${driveMode}`);
    }, [opMode, driveMode]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const driveModes = useMemo(
        () =>
            [
                { id: 'ACKERMANN_FRONT' as const, label: t('cockpit.driveFront'), sub: t('cockpit.driveFrontSub'), icon: '🚗' },
                { id: 'ACKERMANN_DUAL' as const, label: t('cockpit.driveDual'), sub: t('cockpit.driveDualSub'), icon: '🚙' },
                { id: 'CRAB' as const, label: t('cockpit.driveCrab'), sub: t('cockpit.driveCrabSub'), icon: '🦀' },
                { id: 'DIFFERENTIAL' as const, label: t('cockpit.drivePivot'), sub: t('cockpit.drivePivotSub'), icon: '🚜' },
            ],
        [t]
    );

    return (
        <div className="h-screen w-full bg-slate-950 text-white flex flex-col font-sans overflow-hidden select-none">

            {/* 1. Safety Header (Glassmorphism) */}
            <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <span className={`block h-3 w-3 rounded-full ${latency > 300 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                            <span className={`absolute top-0 left-0 h-3 w-3 rounded-full ${latency > 300 ? 'bg-rose-500' : 'bg-emerald-500'} opacity-50`} />
                        </div>
                        <div>
                            <span className="block font-mono text-sm font-bold text-slate-200 tracking-wider">{t('cockpit.robotId')}</span>
                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest">{t('cockpit.zenohSubtitle')}</span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-slate-800" />

                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                        {OP_MODES.map((m) => (
                            <button
                                key={m}
                                onClick={() => setOpMode(m)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${opMode === m
                                    ? m === 'MANUAL'
                                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                                        : 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.5)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                    }`}
                            >
                                {m === 'MONITOR' ? t('cockpit.modeMONITOR') : m === 'MANUAL' ? t('cockpit.modeMANUAL') : t('cockpit.modeAUTO')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                        <Activity size={14} className="text-blue-400" />
                        <span>{t('cockpit.latencyMs', { ms: latency })}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                        <Battery size={14} className="text-emerald-400" />
                        <span>{t('cockpit.batteryPercent', { pct: 84 })}</span>
                    </div>
                    <button
                        className="group relative bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-2 rounded shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all active:scale-95"
                        onClick={() => console.log("E-STOP TRIGGERED")}
                    >
                        <span className="flex items-center space-x-2">
                            <AlertTriangle size={16} />
                            <span>{t('cockpit.eStop')}</span>
                        </span>
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {t('cockpit.eStopHint')}
                        </span>
                    </button>
                </div>
            </header>

            {/* 2. Main Viewport (Video) */}
            <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {/* Synthetic Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                {/* Placeholder Content */}
                <div className="text-slate-600 flex flex-col items-center animate-pulse">
                    <Wifi size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-light tracking-widest uppercase">{t('cockpit.streamTitle')}</p>
                    <p className="text-xs mt-2 font-mono text-slate-700">{t('cockpit.streamTopic')}</p>
                </div>

                {/* HUD Elements */}
                {opMode === 'MANUAL' && (
                    <>
                        {/* Crosshair */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/20 rounded-full flex items-center justify-center pointer-events-none">
                            <div className="w-1 h-1 bg-white/50 rounded-full" />
                        </div>

                        {/* Telemetry data overlay */}
                        <div className="absolute top-6 left-6 p-4 bg-slate-900/40 backdrop-blur-sm border-l-2 border-blue-500 rounded-r-lg">
                            <div className="font-mono text-xs space-y-1 text-blue-100">
                                <div className="flex justify-between w-32"><span>{t('cockpit.hudLinX')}</span> <span className="text-white">{`0.00 ${t('cockpit.hudLinUnit')}`}</span></div>
                                <div className="flex justify-between w-32"><span>{t('cockpit.hudAngZ')}</span> <span className="text-white">{`0.00 ${t('cockpit.hudAngUnit')}`}</span></div>
                                <div className="flex justify-between w-32"><span>{t('cockpit.hudHead')}</span> <span className="text-white">{t('cockpit.hudDeg', { deg: 124 })}</span></div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* 3. Control Footer */}
            <footer className="h-52 bg-slate-900 border-t border-slate-800 grid grid-cols-12 divide-x divide-slate-800">

                {/* Drive Panel (Left) */}
                <div className="col-span-3 p-5 flex flex-col">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                        <Gamepad2 size={12} className="mr-2" /> {t('cockpit.tractionTitle')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                        {driveModes.map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setDriveMode(mode.id)}
                                disabled={opMode !== 'MANUAL'}
                                className={`relative flex flex-col items-start justify-center p-3 rounded-lg border transition-all duration-200 ${driveMode === mode.id
                                    ? 'bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.1)]'
                                    : 'bg-slate-800/30 border-slate-700/50 text-slate-500 hover:bg-slate-800 hover:border-slate-600'
                                    } ${opMode !== 'MANUAL' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <span className="text-xl">{mode.icon}</span>
                                    {driveMode === mode.id && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-md shadow-blue-500" />}
                                </div>
                                <span className="text-xs font-bold text-white uppercase">{mode.label}</span>
                                <span className="text-[10px] opacity-70">{mode.sub}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Info/Map Panel (Mid) */}
                <div className="col-span-6 p-1 relative group">
                    <div className="absolute inset-0 bg-[url('https://maps.wikimedia.org/img/osm-intl.png')] bg-cover bg-center opacity-20 contrast-125 grayscale mix-blend-overlay pointer-events-none" />
                    <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg group-hover:border-slate-700 transition-colors">
                        <div className="text-center">
                            <Signal size={32} className="mx-auto text-slate-600 mb-2" />
                            <span className="text-xs font-mono text-slate-500">{t('cockpit.mapRegion')}</span>
                        </div>
                    </div>
                </div>

                {/* Implement Panel (Right) */}
                <div className="col-span-3 p-5 flex flex-col">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('cockpit.implementTitle')}</h3>

                    <div className="flex-1 space-y-4">
                        {/* Simulated Widget */}
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-300">{t('cockpit.sprayerTitle')}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{t('cockpit.statusActive')}</span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>{t('cockpit.pressure')}</span>
                                    <span>{t('cockpit.pressureBar', { v: 2.4 })}</span>
                                </div>
                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[75%]" />
                                </div>

                                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                    <span>{t('cockpit.flowRate')}</span>
                                    <span>{t('cockpit.flowLMin', { v: 12 })}</span>
                                </div>
                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-[45%]" />
                                </div>
                            </div>
                        </div>

                        <button
                            disabled={opMode !== 'MANUAL'}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 uppercase tracking-wider rounded transition-colors disabled:opacity-50"
                        >
                            {t('cockpit.configParams')}
                        </button>
                    </div>
                </div>

            </footer>
        </div>
    );
};

export default RoboticsCockpit;
