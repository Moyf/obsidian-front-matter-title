import { mock } from "jest-mock-extended";
import { CanvasNode, CanvasViewExt } from "obsidian";
import { CanvasManager } from "@src/Feature/Canvas/CanvasManager";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import FakeTitleElementService from "@src/Utils/FakeTitleElementService";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { AppEvents } from "@src/Types";
import { ResolverInterface } from "@src/Resolver/Interfaces";

describe("CanvasManager async updates", () => {
    let manager: CanvasManager;
    let facade: ReturnType<typeof mock<ObsidianFacade>>;
    let service: ReturnType<typeof mock<FakeTitleElementService>>;
    let resolver: ReturnType<typeof mock<ResolverInterface>>;
    let view: CanvasViewExt;
    let node: CanvasNode;

    beforeEach(() => {
        jest.useFakeTimers();
        facade = mock<ObsidianFacade>();
        service = mock<FakeTitleElementService>();
        resolver = mock<ResolverInterface>();
        view = mock<CanvasViewExt>();
        view.file = { path: "board.canvas" } as any;
        view.canvas = { nodes: new Map(), requestFrame: jest.fn() };
        node = mock<CanvasNode>();
        node.filePath = "note.md";
        node.initialized = false;
        node.canvas = { view };
        node.contentEl = mock<HTMLDivElement>();
        node.placeholderEl = mock<HTMLDivElement>();
        view.canvas.nodes.set("node", node);
        facade.getViewsOfType.mockReturnValue([view]);
        resolver.resolve.mockReturnValue("Note title");
        manager = new CanvasManager(
            mock<EventDispatcherInterface<AppEvents>>(),
            facade,
            mock<LoggerInterface>(),
            service
        );
        manager.setResolver(resolver);
        manager.enable();
    });

    afterEach(() => {
        manager.disable();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("waits for the node title to be applied before resolving an update", async () => {
        let completed = false;
        const update = manager.update("note.md").then(result => {
            completed = true;
            return result;
        });
        await jest.advanceTimersByTimeAsync(0);
        expect(completed).toBe(false);
        expect(service.getOrCreate).not.toHaveBeenCalled();

        node.initialized = true;
        await jest.advanceTimersByTimeAsync(200);
        expect(await update).toBe(true);
        expect(service.getOrCreate).toHaveBeenCalledTimes(2);
        expect(node.placeholderEl.setText).toHaveBeenCalledWith("Note title");
    });

    it("abandons a waiting update when the canvas is closed", async () => {
        const update = manager.update("note.md");
        await jest.advanceTimersByTimeAsync(0);
        facade.getViewsOfType.mockReturnValue([]);
        await jest.advanceTimersByTimeAsync(200);
        await update;
        expect(service.getOrCreate).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    it("abandons a waiting update when its node is removed", async () => {
        const update = manager.update("note.md");
        await jest.advanceTimersByTimeAsync(0);
        view.canvas.nodes.clear();
        await jest.advanceTimersByTimeAsync(200);
        await update;
        expect(service.getOrCreate).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    it("does not apply an old title after disabling and re-enabling", async () => {
        const update = manager.update("note.md");
        await jest.advanceTimersByTimeAsync(0);
        manager.disable();
        manager.enable();
        node.initialized = true;
        await jest.advanceTimersByTimeAsync(200);
        await update;
        expect(service.getOrCreate).not.toHaveBeenCalled();
    });

    it("consumes frame requests for a closed canvas instead of retaining them", async () => {
        node.initialized = true;
        await manager.refresh();
        const otherView = mock<CanvasViewExt>();
        otherView.file = { path: "other.canvas" } as any;
        otherView.canvas = { nodes: new Map(), requestFrame: jest.fn() };
        facade.getViewsOfType.mockReturnValue([otherView]);
        await manager.refresh();
        facade.getViewsOfType.mockReturnValue([]);
        otherView.canvas.requestFrame();
        await jest.advanceTimersByTimeAsync(0);
        facade.getViewsOfType.mockClear();

        view.canvas.requestFrame();
        await jest.advanceTimersByTimeAsync(0);
        expect(facade.getViewsOfType).toHaveBeenCalledTimes(1);
    });

    it("reports frame update failures without an unhandled rejection", async () => {
        node.initialized = true;
        await manager.refresh();
        const error = new Error("metadata unavailable");
        resolver.resolve.mockImplementation(() => {
            throw error;
        });
        const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            view.canvas.requestFrame();
            await jest.advanceTimersByTimeAsync(0);
            expect(spy).toHaveBeenCalledWith(error);
        } finally {
            spy.mockRestore();
        }
    });
});
