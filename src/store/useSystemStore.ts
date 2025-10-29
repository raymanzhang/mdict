import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface SystemState {
    baseUrl: string;
    setBaseUrl: (baseUrl: string) => void;
}

export const useSystemStore = create<SystemState>()(
    devtools(immer((set) => {
        return {
            baseUrl: '',
            setBaseUrl: (baseUrl: string) => {
                set({ baseUrl });
            },
        };
    })
));
