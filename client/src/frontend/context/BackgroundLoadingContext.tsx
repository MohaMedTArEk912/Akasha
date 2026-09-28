import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from "react";

export type TaskStatus = "idle" | "loading" | "done" | "error";

export interface BackgroundTask {
  id: string;
  title: string;
  step: string;
  progress: number; // 0 - 100
  status: TaskStatus;
  resultSummary?: string;
  updatedAt: number;
}

export interface BackgroundLoadingContextType {
  task: BackgroundTask;
  tasks: BackgroundTask[];
  activeTasks: BackgroundTask[];
  isLoading: boolean;
  isDone: boolean;
  clockTick: number;
  is3DFocused: boolean;
  setIs3DFocused: React.Dispatch<React.SetStateAction<boolean>>;
  startTask: (opts: { id?: string; title: string; step?: string; progress?: number }) => string;
  updateTask: (opts: { id?: string; step?: string; progress?: number; title?: string }) => void;
  completeTask: (opts?: { id?: string; resultSummary?: string; step?: string }) => void;
  failTask: (opts?: { id?: string; error?: string; step?: string }) => void;
  dismissTask: (id?: string) => void;
}

const INITIAL_TASK: BackgroundTask = {
  id: "",
  title: "",
  step: "",
  progress: 0,
  status: "idle",
  updatedAt: Date.now(),
};

const BackgroundLoadingContext = createContext<BackgroundLoadingContextType | null>(null);

export const BackgroundLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [clockTick, setClockTick] = useState<number>(0);
  const [is3DFocused, setIs3DFocused] = useState<boolean>(false);
  const retireTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearRetireTimer = (id: string) => {
    const existing = retireTimersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      retireTimersRef.current.delete(id);
    }
  };

  const startTask = useCallback((opts: { id?: string; title: string; step?: string; progress?: number }): string => {
    const taskId = opts.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    clearRetireTimer(taskId);

    const newTask: BackgroundTask = {
      id: taskId,
      title: opts.title,
      step: opts.step || "Initializing background process...",
      progress: opts.progress ?? 15,
      status: "loading",
      resultSummary: undefined,
      updatedAt: Date.now(),
    };

    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = newTask;
        return next;
      }
      return [...prev, newTask];
    });

    setClockTick((c) => c + 1);
    return taskId;
  }, []);

  const updateTask = useCallback((opts: { id?: string; step?: string; progress?: number; title?: string }) => {
    setTasks((prev) => {
      if (prev.length === 0) return prev;

      // Find target task by id, or default to the most recent loading task
      const targetId = opts.id || [...prev].reverse().find((t) => t.status === "loading")?.id;
      if (!targetId) return prev;

      return prev.map((t) => {
        if (t.id !== targetId || t.status !== "loading") return t;
        return {
          ...t,
          title: opts.title ?? t.title,
          step: opts.step ?? t.step,
          progress: opts.progress !== undefined ? Math.min(Math.max(opts.progress, 0), 100) : t.progress,
          updatedAt: Date.now(),
        };
      });
    });

    setClockTick((c) => c + 1);
  }, []);

  const completeTask = useCallback((opts?: { id?: string; resultSummary?: string; step?: string }) => {
    setTasks((prev) => {
      if (prev.length === 0) return prev;

      const targetId = opts?.id || [...prev].reverse().find((t) => t.status === "loading")?.id;
      if (!targetId) return prev;

      clearRetireTimer(targetId);

      // Auto-retire the completed task after 5 seconds to smoothly return to ambient state
      const timer = setTimeout(() => {
        setTasks((current) => current.filter((t) => t.id !== targetId));
        retireTimersRef.current.delete(targetId);
        setClockTick((c) => c + 1);
      }, 5000);
      retireTimersRef.current.set(targetId, timer);

      return prev.map((t) => {
        if (t.id !== targetId) return t;
        return {
          ...t,
          step: opts?.step || "Completed successfully",
          progress: 100,
          status: "done",
          resultSummary: opts?.resultSummary || "Done ✓",
          updatedAt: Date.now(),
        };
      });
    });

    setClockTick((c) => c + 1);
  }, []);

  const failTask = useCallback((opts?: { id?: string; error?: string; step?: string }) => {
    setTasks((prev) => {
      if (prev.length === 0) return prev;

      const targetId = opts?.id || [...prev].reverse().find((t) => t.status === "loading")?.id;
      if (!targetId) return prev;

      clearRetireTimer(targetId);

      const timer = setTimeout(() => {
        setTasks((current) => current.filter((t) => t.id !== targetId));
        retireTimersRef.current.delete(targetId);
        setClockTick((c) => c + 1);
      }, 4500);
      retireTimersRef.current.set(targetId, timer);

      return prev.map((t) => {
        if (t.id !== targetId) return t;
        return {
          ...t,
          step: opts?.step || opts?.error || "Task encountered an issue",
          status: "error",
          resultSummary: opts?.error || "Error",
          updatedAt: Date.now(),
        };
      });
    });

    setClockTick((c) => c + 1);
  }, []);

  const dismissTask = useCallback((id?: string) => {
    if (id) {
      clearRetireTimer(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } else {
      retireTimersRef.current.forEach((t) => clearTimeout(t));
      retireTimersRef.current.clear();
      setTasks([]);
    }
    setClockTick((c) => c + 1);
  }, []);

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status === "loading" || t.status === "done");
  }, [tasks]);

  const primaryTask = useMemo(() => {
    if (activeTasks.length > 0) return activeTasks[activeTasks.length - 1];
    if (tasks.length > 0) return tasks[tasks.length - 1];
    return INITIAL_TASK;
  }, [activeTasks, tasks]);

  const isLoading = useMemo(() => activeTasks.some((t) => t.status === "loading"), [activeTasks]);
  const isDone = useMemo(() => !isLoading && activeTasks.some((t) => t.status === "done"), [isLoading, activeTasks]);

  return (
    <BackgroundLoadingContext.Provider
      value={{
        task: primaryTask,
        tasks,
        activeTasks,
        isLoading,
        isDone,
        clockTick,
        is3DFocused,
        setIs3DFocused,
        startTask,
        updateTask,
        completeTask,
        failTask,
        dismissTask,
      }}
    >
      {children}
    </BackgroundLoadingContext.Provider>
  );
};

export function useBackgroundLoading(): BackgroundLoadingContextType {
  const ctx = useContext(BackgroundLoadingContext);
  if (!ctx) {
    return {
      task: INITIAL_TASK,
      tasks: [],
      activeTasks: [],
      isLoading: false,
      isDone: false,
      clockTick: 0,
      is3DFocused: false,
      setIs3DFocused: () => {},
      startTask: () => "",
      updateTask: () => {},
      completeTask: () => {},
      failTask: () => {},
      dismissTask: () => {},
    };
  }
  return ctx;
}
