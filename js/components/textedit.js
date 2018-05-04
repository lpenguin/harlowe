"use strict";
define(
    ['jquery'],
    ($) => {
        class TextEditView {
            constructor({color, placeholder}){
                this.color = color || 'white';
                this.placeholder = placeholder || '';
            }

            buildView(element) {
                const holder = {};
                holder.root = $('<div class="editor-root" />');
                holder.area = $('<div class="editor-area"/>');
                holder.editButton = $('<span class="editor-edit-button editor-button" />');
                holder.saveButton = $('<span class="editor-save-button editor-button" />');

                holder.root
                    .append(holder.editButton)                    
                    .append(holder.area)
                    .append(holder.saveButton);
                
                holder.editButton
                    .click(() => { holder.area.focus() })
                ;
                // holder.saveButton.text('Save');

                
                holder.area.css("background-color", this.color);
                holder.area.attr("data-placeholder", this.placeholder);
                holder.area.attr("contenteditable", "true");
                this.holder = holder;

                return this.holder.root;
            }
        }
        return TextEditView;
    }
);