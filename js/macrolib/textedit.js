"use strict";
define([
    'jquery', 
    'macros',
    'datatypes/changercommand',
    'components/textedit',
    ],
    ($, Macros, ChangerCommand, TextEditView) => {
        Macros.addChanger(['text-edit'],
            (_, expr) => {
                // if (!expr) {
                // 	return TwineError.create("macrocall", emptyLinkTextError);
                // }
                console.log("add changer 1");
                return ChangerCommand.create('text-edit', ['']);
            },
            (desc, text) => {
                /*
                    This check ensures that multiple concatenations of (link:) do not overwrite
                    the original source with their successive '<tw-link>' substitutions.
                */
               
                console.log("add changer 2");
                console.log(desc);
                const textEdit = new TextEditView({placeholder: "Type your text here"});
                $(desc.target).append(textEdit.buildView());
            //     desc.source = `
			// <div class='editor'>
			// 	<textarea class='editor-textarea' placeholder="${desc.source}"></textarea>
			// 	<div class='editor-result'></div>
			// 	<a href="" class='editor-save-button editor-button'>Save</a>
			// 	<a href="" class='editor-edit-button editor-button'>Edit</a>
			// </div>`.replace(/[\n\t]/g, '');
                /*
                    Only (link-replace:) removes the link on click (by using the "replace"
                    append method) - the others merely append.
                */
                // desc.data.saveEvent = (button, parentDiv) => {

                //     const editorResult = parentDiv.find('.editor-result');
                //     const editorTextarea = parentDiv.find('.editor-textarea');
                //     const saveButton = parentDiv.find('.editor-save-button');
                //     const editButton = parentDiv.find('.editor-edit-button');
                //     saveButton.css('visibility', 'hidden');
                //     editButton.css('visibility', 'visible');

                //     const text = editorTextarea.val();

                //     editorResult.css('display', 'block');
                //     editorResult.text(text);
                //     editorTextarea.css('display', 'none');
                // };

                // desc.data.editEvent = (button, parentDiv) => {

                //     const editorResult = parentDiv.find('.editor-result');
                //     const editorTextarea = parentDiv.find('.editor-textarea');
                //     const saveButton = parentDiv.find('.editor-save-button');
                //     const editButton = parentDiv.find('.editor-edit-button');
                //     saveButton.css('visibility', 'visible');
                //     editButton.css('visibility', 'hidden');


                //     editorResult.css('display', 'none');
                //     editorTextarea.css('display', 'block');
                // };
            },
            []
        )
    }
);