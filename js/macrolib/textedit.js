"use strict";
define([
    'jquery', 
    'macros',
    'datatypes/changercommand',
    'components/textedit',
    ],
    ($, Macros, ChangerCommand, TextEditView) => {
        const {optional} = Macros.TypeSignature;
        Macros.addChanger(['text-edit'],
            (_, expr) => {
                return ChangerCommand.create('text-edit', [expr]);
            },
            (desc, color) => {
                console.log(color);
                const textEdit = new TextEditView({
                    placeholder: desc.source || "",
                    color: color || "white",
                });
                desc.source = "";
                $(desc.target).append(textEdit.buildView());            
            },
            [optional(String)]
        )
    }
);