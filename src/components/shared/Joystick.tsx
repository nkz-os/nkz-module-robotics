import React, { useRef, useCallback } from 'react';

interface JoystickProps {
  onMove: (linearX: number, angularZ: number) => void;
  disabled?: boolean;
  size?: number;
}

const Joystick: React.FC<JoystickProps> = ({ onMove, disabled = false, size = 120 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!ref.current || !knobRef.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (clientX - cx) / (rect.width / 2);
    const dy = (cy - clientY) / (rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampX = dist > 1 ? dx / dist : dx;
    const clampY = dist > 1 ? dy / dist : dy;

    knobRef.current.style.transform = `translate(${clampX * 20}px, ${-clampY * 20}px)`;
    onMove(clampY, clampX);
  }, [disabled, onMove]);

  const handleEnd = useCallback(() => {
    activeRef.current = false;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)';
    onMove(0, 0);
  }, [onMove]);

  return (
    <div
      ref={ref}
      className="relative rounded-full bg-slate-800 border-2 border-slate-600 touch-none select-none"
      style={{ width: size, height: size }}
      onMouseDown={() => { activeRef.current = true; }}
      onMouseMove={(e) => { if (activeRef.current) handleMove(e.clientX, e.clientY); }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => {
        activeRef.current = true;
        const t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={handleEnd}
    >
      <div
        ref={knobRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg transition-transform duration-75"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-full bg-slate-700/50" />
        <div className="absolute h-px w-full bg-slate-700/50" />
      </div>
    </div>
  );
};

export default Joystick;
