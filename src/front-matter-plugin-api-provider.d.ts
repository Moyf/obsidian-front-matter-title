declare module "front-matter-plugin-api-provider" {
    export type ResolverFactory = (...args: unknown[]) => unknown;

    export interface EventDispatcherInterface<E> {
        addListener<T extends keyof E>(listener: {
            name: T;
            cb: (event: any) => void;
            once?: boolean;
            sort?: number | null;
        }): unknown;
        dispatch<T extends keyof E>(name: T, event: any): void;
        removeListener(ref: unknown): void;
    }

    export type Events = {
        "manager:update": { id: string; result?: boolean };
    };

    export interface ApiInterface {
        getResolverFactory(): ResolverFactory;
        getEventDispatcher(): EventDispatcherInterface<Events>;
        getEnabledFeatures(): string[];
    }

    export interface DeferInterface {
        setFlag(flag: number): void;
        awaitPlugin(): Promise<void>;
        awaitFeatures(): Promise<void>;
        isPluginReady(): boolean;
        isFeaturesReady(): boolean;
        getApi(): ApiInterface | null;
    }

    export interface PluginInterface {
        getDefer(): DeferInterface;
    }
}
