import { create } from "zustand";
import { persist } from "zustand/middleware";
import { randomizeElements } from "~/helpers/randomizeElements";
import axiosWithSNI from "./axiosWithSNI";
import {toast} from "react-hot-toast";

type ValidIP = {
    ip: string;
    latency: number;
};

const TRY_CHARS = ["", "|", "/", "-", "\\"] as const;
const MAX_TRIES = 3;
export type TryChar = (typeof TRY_CHARS)[number];

export type Settings = {
    maxIPCount: number;
    maxLatency: number;
    ipRegex: string;
    sniValue: string;
    portValue: number;
};

type SettingKeys = keyof Settings;

type ScanState = "idle" | "stopping" | "scanning";

type ScannerStore = Settings & {
    testNo: number;
    validIPs: ValidIP[];
    currentIP: string;
    tryChar: TryChar;
    currentLatency: number;
    color: "red" | "green";
    scanState: ScanState;
    dispatch: (newState: Partial<ScannerStore>) => void;
    reset: () => void;
    increaseTestNo: () => void;
    addValidIP: (validIP: ValidIP) => void;
    setSettings: (newSettings: Partial<Settings>) => void;
    getScanState: () => ScanState;
    getValidIPCount: () => number;
};

type FunctionalKeys = {
    [K in keyof ScannerStore]: ScannerStore[K] extends (
            ...args: never[]
        ) => unknown
        ? K
        : never;
}[keyof ScannerStore];

function pick<T extends object, K extends keyof T>(base: T, ...keys: K[]) {
    const entries = keys.map((key) => [key, base[key]]);
    return Object.fromEntries(entries) as Pick<T, K>;
}

export const settingsInitialValues: Pick<ScannerStore, SettingKeys> = {
    maxIPCount: 5,
    maxLatency: 1500,
    ipRegex: "",
    sniValue: "",
    portValue: 80,
};

const initialState: Omit<ScannerStore, FunctionalKeys> = {
    ...settingsInitialValues,
    testNo: 0,
    validIPs: [],
    currentIP: "",
    tryChar: "",
    currentLatency: 0,
    color: "red",
    scanState: "idle",
};

export const useScannerStore = create<ScannerStore>()(
    persist(
        (set, get) => ({
            ...initialState,
            getScanState: () => get().scanState,
            getValidIPCount: () => get().validIPs.length,
            setSettings: (newSettings) => {
                set(newSettings);
            },
            dispatch: (newState) => {
                set(newState);
            },
            addValidIP(validIP) {
                set((state) => {
                    const newArr = [...state.validIPs, validIP];
                    const validIPs = newArr.sort((a, b) => a.latency - b.latency);
                    return {
                        validIPs,
                    };
                });
            },
            reset: () => {
                set({
                    testNo: 0,
                    validIPs: [],
                    currentIP: "",
                    tryChar: "",
                    currentLatency: 0,
                    color: "red",
                    scanState: "idle",
                });
            },
            increaseTestNo: () => {
                set((state) => ({
                    testNo: state.testNo + 1
                }));
            },
        }),
        {
            name: "scanner-store",
            partialize: (state) =>
                pick(
                    state,
                    ...(Object.keys(
                        settingsInitialValues,
                    ) as unknown as (keyof typeof settingsInitialValues)[]),
                ),
            version: 1,
        },
    ),
);

type IPScannerProps = {
    allIps: string[];
};

export const useIPScanner = ({ allIps }: IPScannerProps) => {
    const {
        dispatch,
        reset,
        increaseTestNo,
        addValidIP,
        getScanState,
        getValidIPCount,
        ...state
    } = useScannerStore();
    function setToIdle() {
        dispatch({ scanState: "idle", tryChar: "" });
    }
    async function startScan() {
        reset();
        try {
            const ips = state.ipRegex
                ? allIps.filter((el) => new RegExp(state.ipRegex).test(el))
                : allIps;

            dispatch({ scanState: "scanning" });
            await testIPs(randomizeElements(ips));
            setToIdle();
        } catch (e) {
            console.error(e);
        }
    }

    function stopScan() {
        if (getScanState() === "scanning") {
            dispatch({ scanState: "stopping" });
        } else {
            setToIdle();
        }
    }

    const ports = {
        http : [80,  8080, 2052, 2082, 2086, 2095],
        https: [443, 8443, 2053, 2083, 2087, 2096],
    };

    async function reStart() {
        toast.dismiss('limitation');
        try {
            const ips = state.ipRegex
                ? allIps.filter((el) => new RegExp(state.ipRegex).test(el))
                : allIps;

            dispatch({ scanState: "scanning" });
            await testIPs(randomizeElements(ips));
            setToIdle();
        } catch (e) {
            console.error(e);
        }
    }

    async function showToast() {
        toast(
            (currentToast) => (
                <span className="myToast">
                    In each search, only 150 IPs are evaluated. Do you want to search deeper?
                    <br />
                    <div className={"myToastConfirm"}>
                        <button
                            data-act="cancel"
                            onClick={() =>
                                toast.dismiss(currentToast?.id)
                            }
                        >
                            No
                        </button>
                        <button
                            data-act="restart"
                            onClick={() => {
                                reStart();
                            }}
                        >
                            Yes
                        </button>
                    </div>
                </span>
            ),
            {
                id: "limitation",
                duration: Infinity,
                position:"bottom-center",
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                },
            }
        );
    }

    async function testIPs(ipList: string[]) {
        let isSSL = false;
        if (state.sniValue !== '' && ports.https.includes(state.portValue)) {
            isSSL = true;
        }
        for (const ip of ipList) {
            increaseTestNo();

            let url = `http://${ip}:${state.portValue < 80 ? 80 : state.portValue}`;
            let path = `/cdn-cgi/trace`;
            if ( isSSL ) {
                url = `https://${ip}:${state.portValue}`;
                path = `/__down`;
            }

            let testCount = 0;

            const startTime = performance.now();
            const multiply = state.maxLatency <= 500 ? 1.5 : state.maxLatency <= 1000 ? 1.2 : 1;
            let timeout = 1.5 * multiply * state.maxLatency;
            for (let i = 0; i < MAX_TRIES; i++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                }, Math.trunc(timeout));
                const newState: Partial<ScannerStore> = {
                    currentIP: ip,
                    tryChar: TRY_CHARS[i] || "",
                };

                if (i === 0) {
                    timeout = multiply * state.maxLatency;
                    newState.color = "red";
                    newState.currentLatency = 0;
                } else {
                    timeout = 1.2 * multiply * state.maxLatency;
                    newState.color = "green";
                    newState.currentLatency = Math.floor(
                        (performance.now() - startTime) / (i + 1),
                    );
                }

                dispatch(newState);
                try {
                    const axiosInstance = axiosWithSNI(url, state.sniValue, controller.signal, timeout);
                    const response = await axiosInstance.get(path);
                    testCount++;
                } catch (error) {
                    if (error instanceof Error && !["AbortError", "TypeError"].includes(error.name)) {
                        testCount++;
                    }
                }

                /*try {
                    await fetch(url, {
                        signal: controller.signal,
                        //mode: 'no-cors'
                    });

                    testCount++;
                } catch (error) {
                    if (error instanceof Error && !["AbortError", "TypeError"].includes(error.name)) {
                        testCount++;
                    }
                }*/
                clearTimeout(timeoutId);
            }

            const latency = Math.floor((performance.now() - startTime) / MAX_TRIES);

            if (testCount === MAX_TRIES && latency <= state.maxLatency && latency > 50) {
                addValidIP({
                    ip,
                    latency,
                });
            }

            if (
                getScanState() !== "scanning" ||
                getValidIPCount() >= state.maxIPCount
            ) {
                break;
            }
        }
    }

    return {
        ...state,
        startScan,
        stopScan,
        showToast,
    };
};
