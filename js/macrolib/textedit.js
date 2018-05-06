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
            (_, color, backgroundColor, changeColor) => {
                return ChangerCommand.create('text-edit', [color, backgroundColor, changeColor]);
            },
            (desc, color, backgroundColor, changeColor) => {
                console.log([desc, color, backgroundColor, changeColor]);
                const textEdit = new TextEditView({
                    placeholder: desc.source || "",
                    color: color || "black",
                    backgroundColor: backgroundColor || "white",
                    changeColor: changeColor,
                });
                desc.source = "";
                $(desc.target).append(textEdit.buildView());            
            },
            [optional(String), optional(String), optional(String)]
        );

        $(() => {
            const html = '<div class="header">'+
                '<span class="vac-link" ></span>'+
                '<div class="header-content">'+
                    '<div class="header-link home-link"><span>I wanna go home</span><span class="exit-img"></span></div>'
                '</div>' +
                '</div>';
            $('body').prepend($(html));
        })
    }
);