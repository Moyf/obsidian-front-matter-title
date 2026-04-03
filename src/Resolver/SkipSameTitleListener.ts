import SI from "@config/inversify.types";
import { ObsidianFileFactory } from "@config/inversify.factory.types";
import ListenerInterface from "@src/Interfaces/ListenerInterface";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import ListenerRef from "@src/Components/EventDispatcher/Interfaces/ListenerRef";
import { ResolverEvents } from "@src/Resolver/ResolverType";
import { AppEvents } from "@src/Types";
import { SettingsEvent } from "@src/Settings/SettingsType";
import EventInterface from "@src/Components/EventDispatcher/Interfaces/EventInterface";
import { inject, injectable } from "inversify";
import { TFile } from "obsidian";

@injectable()
export default class SkipSameTitleListener implements ListenerInterface {
    private ref: ListenerRef<"resolver:resolved"> = null;
    private changedRef: ListenerRef<"settings:changed"> = null;
    private enabled = true;

    constructor(
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<AppEvents & ResolverEvents & SettingsEvent>,
        @inject(SI["factory:obsidian:file"])
        private fileFactory: ObsidianFileFactory<TFile | null>
    ) {}

    bind(): void {
        this.ref = this.dispatcher.addListener({ name: "resolver:resolved", cb: e => this.handleResolved(e) });
        this.dispatcher.addListener({
            name: "settings.loaded",
            cb: e => {
                this.enabled = e.get().settings.rules.skipSameTitle;
            },
            once: true,
        });
        this.changedRef = this.dispatcher.addListener({
            name: "settings:changed",
            cb: e => {
                if (e.get().changed?.rules?.skipSameTitle) {
                    this.enabled = e.get().actual.rules.skipSameTitle;
                }
            },
        });
    }

    unbind(): void {
        this.dispatcher.removeListener(this.ref);
        this.ref = null;
        this.dispatcher.removeListener(this.changedRef);
        this.changedRef = null;
    }

    private handleResolved(event: EventInterface<ResolverEvents["resolver:resolved"]>): void {
        if (!this.enabled) {
            return;
        }
        const data = event.get();
        if (!data.value || !data.path) {
            return;
        }

        const file = this.fileFactory(data.path);
        if (!(file instanceof TFile)) {
            return;
        }

        if (file.basename.toLowerCase() === data.value.toLowerCase()) {
            data.modify(null);
        }
    }
}
