import { injectable } from "inversify";
import { Setting } from "obsidian";
import AbstractBuilder from "@src/Settings/SettingBuilders/AbstractBuilder";
import { SettingsType } from "@src/Settings/SettingsType";
import { t } from "@src/i18n/Locale";

@injectable()
export default class RulesSkipSameTitleBuilder extends AbstractBuilder<SettingsType["rules"], "skipSameTitle"> {
    support(k: keyof SettingsType["rules"]): boolean {
        return k === "skipSameTitle";
    }

    doBuild(): void {
        new Setting(this.container)
            .setName(t("rule.skip_same_title.name"))
            .setDesc(t("rule.skip_same_title.desc"))
            .addToggle(toggle => {
                toggle.setValue(this.item.value()).onChange(value => this.item.set(value));
            });
    }
}
