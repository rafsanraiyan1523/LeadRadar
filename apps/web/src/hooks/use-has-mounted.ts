import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True once past hydration, false during SSR and the initial client render.
 * For values that are only knowable client-side (localStorage, matchMedia,
 * window) and would otherwise mismatch between server and client render —
 * `useSyncExternalStore`'s server/client snapshot split is what avoids the
 * mismatch here, not a `useState` + `useEffect(() => setMounted(true))`
 * pattern, which the react-hooks/set-state-in-effect rule flags (a
 * synchronous setState inside an effect body causes an extra render pass).
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
