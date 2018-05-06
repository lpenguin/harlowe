"use strict";
define(
    ['jquery'],
    ($) => {
        const SVG_TEMPLATE = '<svg class="editor-background-image" xmlns="http://www.w3.org/2000/svg" 	xmlns:xlink="http://www.w3.org/1999/xlink"	version="1.2" 	id="Layer_1" 		viewBox="0 0 1360.63 170.08" 	preserveAspectRatio="none" 	>	<path id="__svg_path"		fill="cadetblue" 		stroke="#000000" 		stroke-width="0.5" 		stroke-linecap="round" 		stroke-linejoin="round" 		stroke-miterlimit="10" 		vector-effect="non-scaling-stroke"		d="		M1343.029,163.249c4.312-57.521,4.089-97.907-2.968-155.369C896.819,7.243,455.395-2.959,12.5,5.062		c1.767,51.183,7.373,102.343,16.786,153.343c88.417,7.693,189.192-1.011,279.098,0.124		C654.236,162.913,1005.789,161.053,1343.029,163.249z"/></svg>';
        class TextEditView {
            constructor({ color, backgroundColor, placeholder, changeColor}){
                this.color = color || 'black';
                this.placeholder = placeholder || '';
                this.backgroundColor = backgroundColor || 'white';
                this.disabled = false;
                this.changeColor = changeColor || false;
            }

            buildView(element) {
                const holder = {};
                holder.root = $('<div class="editor-root" />');
                holder.area = $('<div class="editor-area"/>');
                holder.editButton = $('<span class="editor-edit-button editor-button" />');
                holder.saveButton = $('<span class="editor-save-button editor-button" />');
                holder.svg = $(SVG_TEMPLATE);
                holder.svgPath = holder.svg.find('path#__svg_path');

                holder.root
                    .append(holder.svg)
                    .append(holder.editButton)                    
                    .append(holder.area)
                    .append(holder.saveButton);
                
                holder.editButton.click(() => { holder.area.focus() });
                
                // holder.area.css("background-color", this.color);
                holder.area.attr("data-placeholder", this.placeholder);
                holder.area.attr("contenteditable", "true");
                holder.area.css("color", this.color);
                holder.svgPath.attr("fill", this.backgroundColor);
                setTimeout(() => {
                    this.resizeSvg();
                }, 100);

                holder.area.on('DOMSubtreeModified', () => {this.resizeSvg()});
                
                this.holder = holder;
                $(document).on("twine:go-to-passage", () => {
                    if (this.disabled){
                        return;
                    }
                    this.disabled = true;
                    console.log(this.changeColor);
                    if (this.changeColor){
                        this.holder.area.css('color', this.backgroundColor);
                    }
                    
                    this.holder.area.attr("contenteditable", "false");
                    this.holder.svgPath.remove();
                    this.holder.editButton.remove();
                    this.holder.saveButton.remove();
                });
                return this.holder.root;
            }

            resizeSvg(){
                this.holder.svg.css('height', this.holder.area.outerHeight() + "px");
                this.holder.svg.css('width', this.holder.area.outerWidth() + "px");
            }
        }
        return TextEditView;
    }
);