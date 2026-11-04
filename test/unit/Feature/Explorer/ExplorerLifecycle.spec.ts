import { mock, MockProxy } from "jest-mock-extended";
import { TFile, TFileExplorerItem, TFileExplorerView, WorkspaceLeafExt } from "obsidian";
import ExplorerManager from "@src/Feature/Explorer/ExplorerManager";
import ExplorerSort from "@src/Feature/Explorer/ExplorerSort";
import { ExplorerFileItemMutator } from "@src/Feature/Explorer/ExplorerFileItemMutator";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import { AppEvents } from "@src/Types";

describe("Explorer layout and tree rebuilds (#294)", () => {
    let manager: ExplorerManager;
    let facade: MockProxy<ObsidianFacade>;
    let dispatcher: MockProxy<EventDispatcherInterface<AppEvents>>;
    let sort: MockProxy<ExplorerSort>;
    let resolver: MockProxy<ResolverInterface>;
    let view: TFileExplorerView;
    let factory: jest.Mock;
    let callbacks: Record<string, () => void>;
    let mutations: MutationCallback;
    let observer: { observe: jest.Mock; disconnect: jest.Mock };

    const item = () => {
        const result = mock<TFileExplorerItem>();
        result.file = new TFile();
        return result;
    };
    const leaf = (current: TFileExplorerView) => {
        const result = mock<WorkspaceLeafExt>();
        result.view = current;
        result.isVisible.mockReturnValue(true);
        return result;
    };
    const newView = () => {
        const result = mock<TFileExplorerView>();
        result.fileItems = { "note.md": item() };
        return result;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        facade = mock<ObsidianFacade>();
        dispatcher = mock<EventDispatcherInterface<AppEvents>>();
        sort = mock<ExplorerSort>();
        callbacks = {};
        dispatcher.addListener.mockImplementation(({ name, cb }) => {
            callbacks[name] = () => cb(null);
            return { getName: () => name };
        });
        observer = { observe: jest.fn(), disconnect: jest.fn() };
        view = newView();
        view.containerEl = {
            ownerDocument: {
                defaultView: {
                    MutationObserver: class {
                        constructor(cb: MutationCallback) {
                            mutations = cb;
                        }
                        observe = observer.observe;
                        disconnect = observer.disconnect;
                    },
                },
            },
        } as unknown as HTMLElement;
        facade.isInternalPluginEnabled.mockReturnValue(true);
        facade.getLeavesOfType.mockReturnValue([leaf(view)]);
        factory = jest.fn(() => mock<ExplorerFileItemMutator>());
        manager = new ExplorerManager(facade, factory, () => sort, dispatcher, mock<LoggerInterface>());
        resolver = mock<ResolverInterface>();
        manager.setResolver(resolver);
        manager.enable();
    });

    afterEach(() => {
        manager.disable();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("patches new file items after a tree redraw without a metadata event", async () => {
        await manager.refresh();
        factory.mockClear();
        const replacement = item();
        view.fileItems = { "note.md": replacement };
        mutations([{ addedNodes: [{ nodeType: 1, matches: () => true }] }] as any, null);
        await jest.runAllTimersAsync();

        expect(factory).toHaveBeenCalledWith(replacement, resolver);
        expect(replacement.updateTitle).toHaveBeenCalledTimes(1);
    });

    it("ignores its own title text mutations", async () => {
        mutations([{ addedNodes: [{ nodeType: 3 }] }] as any, null);
        await jest.runAllTimersAsync();
        expect(factory).not.toHaveBeenCalled();
    });

    it("does not rerender an unchanged explorer on unrelated layout events", async () => {
        callbacks["layout:change"]();
        callbacks["active:leaf:change"]();
        await jest.runAllTimersAsync();

        expect(factory).not.toHaveBeenCalled();
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it("switches to a replacement view and restores the previous view", async () => {
        await manager.refresh();
        const previousMutator = factory.mock.results[0].value;
        const replacement = newView();
        facade.getLeavesOfType.mockReturnValue([leaf(replacement)]);
        callbacks["layout:change"]();
        await jest.runAllTimersAsync();

        expect(previousMutator.destroy).toHaveBeenCalledTimes(1);
        expect(observer.disconnect).toHaveBeenCalled();
        expect(sort.stop).toHaveBeenCalled();
        expect(sort.start).toHaveBeenLastCalledWith(replacement);
        expect(factory).toHaveBeenCalledWith(replacement.fileItems["note.md"], resolver);
    });

    it("waits while the view is absent and reapplies titles when it returns", async () => {
        facade.getLeavesOfType.mockReturnValue([]);
        callbacks["layout:change"]();
        await jest.runAllTimersAsync();
        expect(manager.isEnabled()).toBe(true);

        const replacement = newView();
        facade.getLeavesOfType.mockReturnValue([leaf(replacement)]);
        callbacks["active:leaf:change"]();
        await jest.runAllTimersAsync();
        expect(factory).toHaveBeenCalledWith(replacement.fileItems["note.md"], resolver);
    });

    it("cancels queued refreshes and disconnects subscriptions when disabled", async () => {
        callbacks["layout:change"]();
        manager.disable();
        callbacks["layout:change"]();
        await jest.runAllTimersAsync();

        expect(factory).not.toHaveBeenCalled();
        expect(observer.disconnect).toHaveBeenCalled();
        expect(dispatcher.removeListener).toHaveBeenCalledTimes(2);
    });
});
