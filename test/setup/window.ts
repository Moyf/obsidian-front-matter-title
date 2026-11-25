// The unit suite runs on the node environment, which has no `window`, but the
// plugin calls the timer functions through it (Obsidian wants timers to belong
// to the window that started them, for popout windows). Point `window` at the
// same object the tests spy on and fake, so jest.useFakeTimers() and
// jest.spyOn(global, "setTimeout") keep working against the calls the code makes.
//
// This lives with the tests rather than in the root jest setup: it is test
// bootstrap for a node-only process, not plugin runtime code.
(globalThis as unknown as { window: typeof globalThis }).window ??= globalThis;
