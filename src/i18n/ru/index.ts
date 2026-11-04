import { Translation } from "../Locale";
import { Feature } from "@src/Enum";

const ru: Translation = {
    feature: {
        [Feature.Suggest]: {
            insertAlias: {
                name: "Добавлять заголовок во вставляемые ссылки",
                desc: "Использовать отображаемый заголовок как alias при выборе подсказки. Выключите, чтобы сохранить обычный текст ссылок Obsidian. Функция Note Link может отдельно переписывать ссылки.",
            },
        },
    },
};

export default ru;
