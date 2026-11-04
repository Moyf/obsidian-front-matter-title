import AbstractBuilder from "./AbstractBuilder";
import { Feature } from "@src/Enum";
import { Modal, Setting } from "obsidian";
import { t } from "@src/i18n/Locale";

export default class SuggestBuilder extends AbstractBuilder<Feature.Suggest> {
    doBuild(): void {
        this.buildEnable();
    }

    protected onModalShow(modal: Modal): void {
        new Setting(modal.contentEl)
            .setName(t("feature.suggest.insertAlias.name"))
            .setDesc(t("feature.suggest.insertAlias.desc"))
            .addToggle(toggle =>
                toggle.setValue(this.config.insertAlias ?? true).onChange(value => {
                    this.config.insertAlias = value;
                    this.dispatchChanges();
                })
            );
        this.buildTemplates(modal.contentEl);
    }
}
