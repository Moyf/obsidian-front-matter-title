import { mock } from "jest-mock-extended";
import TabManager from "@src/Feature/Tab/TabManager";
import FeatureComposer from "@src/Feature/FeatureComposer";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import { AppEvents } from "@src/Types";
import { Feature } from "@src/Enum";

it("rolls back Tab when synchronous initialization fails before subscribing", () => {
    const facade = mock<ObsidianFacade>();
    facade.getActiveLeaf.mockImplementation(() => {
        throw new Error("workspace changed");
    });
    facade.getLeavesOfType.mockReturnValue([]);
    const dispatcher = mock<EventDispatcherInterface<AppEvents>>();
    const tab = new TabManager(facade, dispatcher, () => null);
    const composer = new FeatureComposer(() => tab, dispatcher, mock<LoggerInterface>());
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
        expect(() => composer.toggle(Feature.Tab, true)).not.toThrow();
        expect(tab.isEnabled()).toBe(false);
        expect(composer.get(Feature.Tab)).toBeNull();
        expect(dispatcher.removeListener).not.toHaveBeenCalled();
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
    } finally {
        spy.mockRestore();
    }
});
