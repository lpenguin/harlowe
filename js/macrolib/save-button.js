"use strict";
define([
    'jquery',
    'macros',
    'datatypes/changercommand',
    'components/save-button',
],
    ($, Macros, ChangerCommand, SaveButton) => {
        Macros.addChanger(['save-button'],
            (_, ) => {
                return ChangerCommand.create('save-button', []);
            },
            (desc, ) => {
                const saveButton = new SaveButton({
                    // baseUrl: "http://199.247.1.199"
                    baseUrl: "http://wb1.v-a-c.ru:4080",
                    // baseUrl: "http://localhost"
                });
                desc.source = "";
                const $el = saveButton.buildView();
                $(desc.target).append($el);
            },
            []
        );
    }
);