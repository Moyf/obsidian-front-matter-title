import { TFile, TFileExplorerItem, TFileExplorerView, WorkspaceLeafExt } from "obsidian";
import { Feature, Leaves, Plugins } from "@src/Enum";
import { inject, injectable, named } from "inversify";
import SI from "@config/inversify.types";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import AbstractManager from "@src/Feature/AbstractManager";
import { ExplorerFileItemMutator } from "./ExplorerFileItemMutator";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import ExplorerSort from "@src/Feature/Explorer/ExplorerSort";
import { State } from "@src/Feature/Explorer/Types";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { AppEvents } from "@src/Types";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import ListenerRef from "@src/Components/EventDispatcher/Interfaces/ListenerRef";
import Event from "@src/Components/EventDispatcher/Event";

@injectable()
export default class ExplorerManager extends AbstractManager {
    private explorerView: TFileExplorerView = null;
    private modified = new WeakMap<TFileExplorerItem, ExplorerFileItemMutator>();
    private state: State = State.Disabled;
    private sort: ExplorerSort = null;
    private refs: ListenerRef<keyof AppEvents>[] = [];
    private observer: MutationObserver = null;
    private refreshTimer: number = null;
    private treeChanged = false;

    constructor(
        @inject(SI["facade:obsidian"])
        private facade: ObsidianFacade,
        @inject(SI["feature:explorer:file_mutator:factory"])
        private factory: (item: TFileExplorerItem, resolver: ResolverInterface) => ExplorerFileItemMutator,
        @inject(SI["factory:feature:explorer:sort"])
        sortFactory: () => ExplorerSort | null,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<AppEvents>,
        @inject(SI["logger"])
        @named(Feature.Explorer)
        private logger: LoggerInterface
    ) {
        super();
        this.sort = sortFactory();
    }

    static getId(): Feature {
        return Feature.Explorer;
    }

    private setState(state: State) {
        this.state = state;
    }
    getId(): Feature {
        return Feature.Explorer;
    }

    isEnabled(): boolean {
        return this.state !== State.Disabled;
    }

    protected doDisable() {
        this.setState(State.Disabled);
        this.refs.forEach(ref => this.dispatcher.removeListener(ref));
        this.refs = [];
        this.treeChanged = false;
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.observer?.disconnect();
        this.observer = null;
        if (this.explorerView) {
            this.restoreTitles();
            this.explorerView = null;
        }
        this.sort?.stop();
    }

    protected doEnable() {
        if (!this.facade.isInternalPluginEnabled(Plugins.FileExplorer)) {
            this.logger.info(`internal plugin ${Plugins.FileExplorer} is not enabled`);
            return;
        }
        this.setState(State.WaitForActiveLeaf);
        this.refs = [
            this.dispatcher.addListener({ name: "layout:change", cb: () => this.queueRefresh() }),
            this.dispatcher.addListener({ name: "active:leaf:change", cb: () => this.queueRefresh() }),
        ];
        this.getExplorerView();
    }

    protected async doRefresh(): Promise<{ [p: string]: boolean }> {
        return this.updateInternal(Object.values(this.getExplorerFileItems()));
    }

    protected async doUpdate(path: string): Promise<boolean> {
        const item = this.getExplorerFileItems()[path];
        await this.updateInternal(item ? [item] : []);
        return !!item;
    }

    private getExplorerView(): TFileExplorerView | null {
        const leaves = this.facade.getLeavesOfType<WorkspaceLeafExt>(Leaves.FE);
        const view = (leaves.find(leaf => leaf?.isVisible())?.view as TFileExplorerView) ?? null;
        if (view === this.explorerView) {
            return view;
        }
        this.observer?.disconnect();
        this.observer = null;
        if (this.explorerView) {
            this.restoreTitles();
            this.sort?.stop();
        }
        this.explorerView = view;
        this.setState(view ? State.Enabled : State.WaitForActiveLeaf);
        if (view) {
            this.sort?.start(view);
            this.observeTree(view);
        }
        return view;
    }

    private queueRefresh(treeChanged = false): void {
        if (!this.isEnabled()) {
            return;
        }
        this.treeChanged ||= treeChanged;
        if (this.refreshTimer !== null) {
            return;
        }
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            const refreshTree = this.treeChanged;
            this.treeChanged = false;
            Promise.resolve()
                .then(async () => {
                    if (!this.isEnabled()) {
                        return;
                    }
                    const previous = this.explorerView;
                    this.getExplorerView();
                    // Normal layout changes should not rerender the whole file list.
                    if (refreshTree || previous !== this.explorerView) {
                        await this.refresh();
                        if (this.isEnabled()) {
                            this.dispatcher.dispatch("manager:refresh", new Event({ id: Feature.Explorer }));
                        }
                    }
                })
                .catch(e => this.logger.log(e));
        }, 0);
    }

    private observeTree(view: TFileExplorerView): void {
        const container = view.containerEl;
        const Observer = container?.ownerDocument?.defaultView?.MutationObserver;
        if (!Observer) {
            return;
        }
        this.observer = new Observer(records => {
            // Native tree reloads replace file items without metadata changes.
            // Ignore title text mutations from our own rendering to avoid a loop.
            if (
                records.some(record =>
                    Array.from(record.addedNodes).some(
                        node =>
                            node.nodeType === 1 &&
                            ((node as Element).matches(".nav-file, .nav-folder") ||
                                (node as Element).querySelector(".nav-file, .nav-folder"))
                    )
                )
            ) {
                this.queueRefresh(true);
            }
        });
        this.observer.observe(container, { childList: true, subtree: true });
    }

    private getExplorerFileItems(): { [K: string]: TFileExplorerItem } {
        return this.getExplorerView()?.fileItems ?? {};
    }

    private async updateInternal(items: TFileExplorerItem[]): Promise<{ [k: string]: boolean }> {
        for (const i of items) {
            if (!(i.file instanceof TFile)) {
                continue;
            }
            if (!this.modified.has(i)) {
                this.modified.set(i, this.factory(i, this.resolver));
            }
            i.updateTitle();
        }
        return {};
    }

    private restoreTitles(): void {
        Object.values(this.explorerView.fileItems).map(this.restore.bind(this));
    }

    private restore(item: TFileExplorerItem): boolean {
        if (this.modified.has(item)) {
            this.modified.get(item).destroy();
            item.updateTitle();
            this.modified.delete(item);
            return true;
        }
        return false;
    }
}
