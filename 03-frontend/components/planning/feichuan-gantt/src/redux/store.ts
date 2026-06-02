// @ts-nocheck
// Vendored lightweight event store for gantt-planing-react.
// Original project used Redux only to broadcast Enter-key task insertion.

import type { Task } from '../types/public-types';

interface NetworkGanttState {
  networkGantt: {
    taskModel: Partial<Task>;
  };
}

interface NetworkGanttAction {
  type: string;
  taskModel?: Partial<Task>;
}

let state: NetworkGanttState = {
  networkGantt: {
    taskModel: {},
  },
};

const listeners = new Set<() => void>();

const store = {
  dispatch(action: NetworkGanttAction) {
    if (action.type === 'enter') {
      state = {
        networkGantt: {
          taskModel: action.taskModel ?? {},
        },
      };
      listeners.forEach((listener) => listener());
    }
  },
  getState() {
    return state;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export default store;
