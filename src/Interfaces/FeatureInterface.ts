export default interface FeatureInterface<T> {
    // Implementations must stay synchronous: FeatureComposer catches synchronous
    // failures only. TypeScript's void return type alone does not enforce this.
    enable(): void;

    disable(): void;

    getId(): T;

    isEnabled(): boolean;
}
