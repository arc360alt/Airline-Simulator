type Handler<T> = (payload: T) => void;

export interface BusEvents {
  /** game data changed due to an action, panels should redraw */
  change: void;
  /** sim advanced, cheap UI (HUD/globe) should update */
  tick: number;
  toast: { msg: string; kind: 'good' | 'bad' | 'info' | 'money' | 'research' };
  crash: { planeId: string; lat: number; lon: number };
  settings: void;
  speed: number;
  focusAirport: string;
  openPanel: string;
  /** (re)start the guided tutorial */
  tutorial: void;
}

class Bus {
  private map = new Map<keyof BusEvents, Set<Handler<any>>>();

  on<K extends keyof BusEvents>(key: K, fn: Handler<BusEvents[K]>): () => void {
    if (!this.map.has(key)) this.map.set(key, new Set());
    this.map.get(key)!.add(fn);
    return () => this.map.get(key)?.delete(fn);
  }

  emit<K extends keyof BusEvents>(key: K, ...payload: BusEvents[K] extends void ? [] : [BusEvents[K]]): void {
    this.map.get(key)?.forEach((fn) => fn(payload[0]));
  }
}

export const bus = new Bus();
