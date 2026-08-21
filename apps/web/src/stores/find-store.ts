import { create } from "zustand";

interface FindStoreState {
  selectedResultId: string | null;
  hoveredResultId: string | null;
  selectedResultIds: Set<string>;
  setSelectedResult: (id: string | null) => void;
  setHoveredResult: (id: string | null) => void;
  toggleResultChecked: (id: string) => void;
  setAllChecked: (ids: string[], checked: boolean) => void;
  clearChecked: () => void;
}

export const useFindStore = create<FindStoreState>((set) => ({
  selectedResultId: null,
  hoveredResultId: null,
  selectedResultIds: new Set(),
  setSelectedResult: (id) => set({ selectedResultId: id }),
  setHoveredResult: (id) => set({ hoveredResultId: id }),
  toggleResultChecked: (id) =>
    set((state) => {
      const next = new Set(state.selectedResultIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedResultIds: next };
    }),
  setAllChecked: (ids, checked) =>
    set((state) => {
      const next = new Set(state.selectedResultIds);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return { selectedResultIds: next };
    }),
  clearChecked: () => set({ selectedResultIds: new Set() }),
}));
