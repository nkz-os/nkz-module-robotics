import { useEffect, useRef, useState } from 'react';

interface GamepadState {
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
  connected: boolean;
}

export function useGamepad(): GamepadState {
  const [state, setState] = useState<GamepadState>({
    axes: [],
    buttons: [],
    connected: false,
  });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const poll = () => {
      const gp = navigator.getGamepads?.()?.[0];
      if (gp) {
        setState({
          axes: Array.from(gp.axes),
          buttons: gp.buttons
            ? Array.from(gp.buttons).map((b) => ({ pressed: b.pressed, value: b.value }))
            : [],
          connected: true,
        });
      } else {
        setState((s) => (s.connected ? { ...s, connected: false } : s));
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return state;
}
