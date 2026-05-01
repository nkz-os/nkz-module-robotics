import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@nekazari/sdk';
import type { OperationMode } from '../../types/robotics';

interface VideoViewportProps {
  videoFrame: { cameraId: number; data: ArrayBuffer } | null;
  mode: OperationMode;
}

const VideoViewport: React.FC<VideoViewportProps> = ({ videoFrame, mode }) => {
  const { t } = useTranslation('robotics');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeCamera, setActiveCamera] = useState(0);

  useEffect(() => {
    if (!videoFrame || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const blob = new Blob([videoFrame.data], { type: 'image/jpeg' });
    const img = new Image();
    img.onload = () => {
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = URL.createObjectURL(blob);
  }, [videoFrame]);

  return (
    <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
      {videoFrame ? (
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      ) : (
        <div className="text-slate-600 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-2 border-slate-700 border-t-rose-500 animate-spin mb-4" />
          <p className="text-lg font-light tracking-widest uppercase">No video stream</p>
        </div>
      )}

      {mode === 'MANUAL' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/20 rounded-full flex items-center justify-center pointer-events-none">
          <div className="w-1 h-1 bg-white/50 rounded-full" />
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1, 2].map(cam => (
          <button
            key={cam}
            onClick={() => setActiveCamera(cam)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeCamera === cam ? 'bg-rose-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {cam === 0 ? t('cockpit.cameraFront') : cam === 1 ? t('cockpit.cameraRear') : t('cockpit.cameraImplement')}
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoViewport;
