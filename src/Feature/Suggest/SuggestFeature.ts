import { Feature } from "@src/Enum";
import FunctionReplacer from "@src/Utils/FunctionReplacer";
import { Chooser, SuggestModalChooserFileItem } from "obsidian";
import AbstractFeature from "../AbstractFeature";
import { inject, injectable, named, type interfaces } from "inversify";
import SI from "@config/inversify.types";
import FeatureService from "@src/Feature/FeatureService";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import { FeatureConfig } from "@src/Feature/Types";
import { SettingsType } from "@src/Settings/SettingsType";
import Storage from "@src/Storage/Storage";
type Newable<T = unknown> = interfaces.Newable<T>;

@injectable()
export default class SuggestFeature extends AbstractFeature<Feature> {
    private replacer: FunctionReplacer<Chooser, "setSuggestions", SuggestFeature> = null;
    private renderReplacer: FunctionReplacer<Chooser, "renderSuggestions", SuggestFeature> = null;
    private addReplacer: FunctionReplacer<Chooser, "addSuggestion", SuggestFeature> = null;
    private state = false;
    private resolver: ResolverInterface;

    constructor(
        @inject(SI["newable:obsidian:chooser"])
        chooser: Newable<Chooser>,
        @inject(SI["feature:service"])
        service: FeatureService,
        @inject(SI["feature:config"])
        @named(Feature.Suggest)
        private config: FeatureConfig<Feature.Suggest>,
        @inject(SI["settings:storage"])
        private storage: Storage<SettingsType>
    ) {
        super();
        this.resolver = service.createResolver(this.getId());
        this.createChooserReplacer(chooser);
    }

    static getId(): Feature {
        return Feature.Suggest;
    }

    isEnabled(): boolean {
        return this.state;
    }

    public enable(): void {
        if (this.isEnabled()) {
            return;
        }
        this.replacer?.enable();
        this.renderReplacer?.enable();
        this.addReplacer?.enable();
        this.state = true;
    }

    public disable(): void {
        this.replacer?.disable();
        this.renderReplacer?.disable();
        this.addReplacer?.disable();
        this.state = false;
    }

    getId(): Feature {
        return SuggestFeature.getId();
    }

    private createChooserReplacer(chooser: Newable<Chooser>): void {
        if (typeof chooser?.prototype?.setSuggestions !== "function") {
            console.error("[front-matter-title] Chooser.setSuggestions not found, Suggest feature degraded.");
            return;
        }
        this.replacer = FunctionReplacer.tryCreate(
            chooser.prototype,
            "setSuggestions",
            this,
            function (self: SuggestFeature, args: unknown[], vanilla: (e: any) => any) {
                if (self.config.insertAlias !== false && Array.isArray(args?.[0])) {
                    args[0] = self.modifySuggestions(args[0]);
                }
                return vanilla.call(this, ...args);
            }
        );
        if (this.config.insertAlias === false) {
            this.renderReplacer = FunctionReplacer.tryCreate(
                chooser.prototype,
                "renderSuggestions",
                this,
                function (self, args, vanilla) {
                    return self.withDisplayTitles(this, () => vanilla.apply(this, args));
                }
            );
            this.addReplacer = FunctionReplacer.tryCreate(
                chooser.prototype,
                "addSuggestion",
                this,
                function (self, args, vanilla) {
                    return self.withDisplayTitles(this, () => vanilla.apply(this, args));
                }
            );
        }
    }

    private withDisplayTitles(chooser: Chooser, render: () => unknown): unknown {
        const owner = chooser.chooser;
        if (typeof owner?.renderSuggestion !== "function") {
            return render();
        }
        const original = owner.renderSuggestion;
        const self = this;
        // Only the renderer receives a copy with the title. Chooser.values keeps
        // the native result, which Obsidian uses for both mouse and keyboard selection.
        owner.renderSuggestion = function (item, el) {
            return original.call(this, self.displaySuggestion(item), el);
        };
        try {
            return render();
        } finally {
            owner.renderSuggestion = original;
        }
    }

    private displaySuggestion(item: SuggestModalChooserFileItem): SuggestModalChooserFileItem {
        if (!item?.file || item.type !== "file") {
            return item;
        }
        const alias = this.resolver.resolve(item.file.path);
        if (
            alias &&
            this.storage.get("rules").get("skipSameTitle").value() &&
            alias.toLowerCase() === item.file.basename.toLowerCase()
        ) {
            return item;
        }
        return alias ? { ...item, type: "alias", alias } : item;
    }

    private modifySuggestions(items: SuggestModalChooserFileItem[]): SuggestModalChooserFileItem[] {
        const aliases: Set<string> = new Set();
        return items.map(item => {
            if (!item?.file) {
                return item;
            }
            aliases.add(item.alias + item.file.path);
            if (!item || !item.type || item.type !== "file") {
                return item;
            }
            const displayed = this.displaySuggestion(item);
            if (displayed === item) {
                return item;
            }
            const alias = displayed.alias;
            const value = alias + item.file.path;
            if (alias && !aliases.has(value)) {
                aliases.add(value);
                return displayed;
            }
            return item;
        });
    }
}
