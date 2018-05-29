"use strict";
define(
    ['jquery'],
    ($) => {
        //const SVG_TEMPLATE = '
        // <svg class="editor-background-image" xmlns="http://www.w3.org/2000/svg" 
        //    xmlns:xlink="http://www.w3.org/1999/xlink"	version="1.2" 	id="Layer_1" 	
        //        viewBox="0 0 1360.63 170.08" 	preserveAspectRatio="none" 	>	<path id="__svg_path"	
        //        	fill="cadetblue" 		stroke="#000000" 		stroke-width="0.5" 		stroke-linecap="round" 		stroke-linejoin="round" 		stroke-miterlimit="10" 		vector-effect="non-scaling-stroke"		d="		M1343.029,163.249c4.312-57.521,4.089-97.907-2.968-155.369C896.819,7.243,455.395-2.959,12.5,5.062		c1.767,51.183,7.373,102.343,16.786,153.343c88.417,7.693,189.192-1.011,279.098,0.124		C654.236,162.913,1005.789,161.053,1343.029,163.249z"/></svg>';
        const SVG_TEMPLATE = `
        <svg width="20000" height="20000" xmlns="http://www.w3.org/2000/svg"
            shape-rendering="crispEdges"
        >
            <defs>
                <pattern
                    id="Pattern"
                    x="0"
                    y="3"
                    width="50"
                    height="22"
                    patternUnits="userSpaceOnUse"  
 
                >
                    <line 
                        x1="0" 
                        y1="14" 
                        x2="50" 
                        y2="14" 
                        stroke-dasharray="1, 4"
                        stroke-width="0.5"
                        style="stroke:rgb(25,25,25);
                            " />
                </pattern>
            </defs>
            <rect id="__svg_path" width="20000" height="20000" rx="10" ry="10" stroke-width="1" stroke="black"/>
            <rect y="20" fill="url(#Pattern)" stroke="black" stroke-width="0" width="20000" height="20000"/>
        </svg>
        `;
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
                // holder.editButton = $('<span class="editor-edit-button editor-button" />');
                // holder.saveButton = $('<span class="editor-save-button editor-button" />');
                holder.svg = $(SVG_TEMPLATE);
                holder.svgPath = holder.svg.find('#__svg_path');

                holder.root
                    .append(holder.svg)
                    // .append(holder.editButton)                    
                    .append(holder.area)
                    // .append(holder.saveButton);
                ;
                this.holder = holder;
                // holder.editButton.click(() => { holder.area.focus() });
                holder.svg.css("position", "absolute");
                holder.svgPath.css("fill", this.backgroundColor);
                holder.area.attr("data-placeholder", this.placeholder);
                holder.area.attr("contenteditable", "true");
                holder.area.css("color", this.color);
                
                // holder.area.css("background-color", this.backgroundColor);
                setTimeout(() => {
                    this.resizeSvg();
                }, 100);

                holder.area.on('DOMSubtreeModified', () => {this.resizeSvg()});
                $(window).resize(() => {this.resizeSvg()});


                
                $(document).on("twine:go-to-passage", () => {
                    if (this.disabled){
                        return;
                    }

                    this.disabled = true;
                    
                    console.log([
                        this.holder.area.text().length,
                        this.holder.area.text(),
                        (this.holder.area.text().length !== 0)
                    ]);
                    if (this.holder.area.text().length != 0) {
                        if (this.changeColor){
                            this.holder.area.css('color', this.backgroundColor);
                            // this.holder.area.css('background-color', this.color);
                        }
                        this.holder.area.attr("contenteditable", "false");
                    } else {
                        this.holder.area.addClass("editor-area-empty-disabled");
                        this.holder.area.attr("contenteditable", "false");
                        this.holder.area.text(
                            this.holder.area.attr('data-placeholder')
                        );
                    }
                    
                    
                    
                    // this.holder.svgPath.remove();
                    // this.holder.editButton.remove();
                    // this.holder.saveButton.remove();

                    // if (this.holder.area.text().length === 0) {
                    //     this.holder.area.css('height', this.holder.area.outerHeight()+'px');
                    //     this.holder.area.css('min-height', '0');
                    //     this.holder.area.css('padding', '0');
                    //     this.holder.area.animate({ opacity: 0, height: 0 }, 300, function () {
                    //         $(this).css("display", "none")
                    //     });
                    // }
                });
                return this.holder.root;
            }

            resizeSvg(){
                this.holder.svg.css('height', this.holder.area.outerHeight() + "px");
                this.holder.svg.css('width', this.holder.area.outerWidth() + "px");

                this.holder.svg.attr('height', this.holder.area.outerHeight());
                this.holder.svg.attr('width', this.holder.area.outerWidth());

                this.holder.svgPath.attr('height', this.holder.area.outerHeight());
                this.holder.svgPath.attr('width', this.holder.area.outerWidth());
            }
        }
        return TextEditView;
    }
);