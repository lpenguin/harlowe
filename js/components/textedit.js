"use strict";
define(
    ['jquery'],
    ($) => {
        //const SVG_TEMPLATE = '
        // <svg class="editor-background-image" xmlns="http://www.w3.org/2000/svg" 
        //    xmlns:xlink="http://www.w3.org/1999/xlink"	version="1.2" 	id="Layer_1" 	
        //        viewBox="0 0 1360.63 170.08" 	preserveAspectRatio="none" 	>	<path id="__svg_path"	
        //        	fill="cadetblue" 		stroke="#000000" 		stroke-width="0.5" 		stroke-linecap="round" 		stroke-linejoin="round" 		stroke-miterlimit="10" 		vector-effect="non-scaling-stroke"		d="		M1343.029,163.249c4.312-57.521,4.089-97.907-2.968-155.369C896.819,7.243,455.395-2.959,12.5,5.062		c1.767,51.183,7.373,102.343,16.786,153.343c88.417,7.693,189.192-1.011,279.098,0.124		C654.236,162.913,1005.789,161.053,1343.029,163.249z"/></svg>';
                            //                         


        const SVG_PATTERN = `    
        <svg>
            <defs>
                <pattern
                    id="Pattern"
                    x="4"
                    y="4"
                    width="50"
                    height="22"
                    patternUnits="userSpaceOnUse"  
                >

                    <line 
                        x1="0" 
                        y1="14" 
                        x2="50" 
                        y2="14" 
                        stroke-width="1"
                        stroke-dasharray="1,4"
                        stroke="rgb(25,25,25)"
                        />
                </pattern>
            </defs>
        </svg>`;

        const SVG_TEMPLATE = `
        <svg width="100%" height="57.4844" xmlns="http://www.w3.org/2000/svg"
        >
            <rect id="__svg_path" width="20" height="20" rx="3" ry="3" stroke-width="0" stroke="#00000000"/>
            <rect id="__svg_dots" y="20" fill="url(#Pattern)" stroke="#000000" stroke-width="0" width="20" height="2000"/>
        </svg>
        `;
        class TextEditView {
            constructor({ color, backgroundColor, placeholder, changeColor, removePlaceholder, showSubmit}){
                if(removePlaceholder == undefined){
                    removePlaceholder = false;
                }
                this.color = color || 'black';
                this.placeholder = placeholder || '';
                this.backgroundColor = backgroundColor || 'white';
                this.changeColor = (changeColor || "false") != "false";
                this.removePlaceholder = (removePlaceholder || "false") != "false";
                this.showSubmit = (showSubmit || "false") != "false";

                this.disabled = false;
            }

            buildView(element) {
                const holder = {};
                if($('#Pattern').length == 0){
                    $('body').append($(SVG_PATTERN));
                }

                holder.root = $('<div class="editor-root" />');
                holder.submitButton = $('<span class="editor-submit-button" />')
                holder.area = $('<div class="editor-area"></div>');
                // holder.editButton = $('<span class="editor-edit-button editor-button" />');
                // holder.saveButton = $('<span class="editor-save-button editor-button" />');
                holder.svg = $(SVG_TEMPLATE);
                holder.svgPath = holder.svg.find('#__svg_path');
                holder.svgDots = holder.svg.find('#__svg_dots');

                holder.root
                    .append(holder.svg)                                        
                    .append(holder.area)
                    .append(holder.submitButton)
                    // .append(holder.saveButton);
                ;
                this.holder = holder;
                // holder.editButton.click(() => { holder.area.focus() });
                holder.svg.css("position", "absolute");
                holder.svgPath.css("fill", this.backgroundColor);
                holder.area.attr("data-placeholder", this.placeholder);
                holder.area.attr("contenteditable", "true"); 
                holder.area.css("color", this.color);
                if(this.showSubmit){
                    holder.submitButton.css("display", "inline-block");
                }

                this.observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        this.resizeSvg();
                    });    
                });
                var config = { attributes: false, childList: true, characterData: true }                
                this.observer.observe(this.holder.area[0], config);
                 
                $(window).resize(() => {
                    this.resizeSvg()
                });

                holder.submitButton.click(() => {
                    window._enteredText = holder.area.text();
                });
                
                this.redrawListener = () => {
                    console.log('redrawListener');
                    var y  = window.pageYOffset || document.documentElement.scrollTop;
                    console.log('Scroll:', y, $(document).scrollTop())

                    this.resizeSvg();
                    // const y = $(document).scrollTop();
                    if(!window._isMobile){
                        holder.area.focus();
                        window.scrollTo(0, y);                        
                    }

                    // let y = $(document).scrollTop();
                    // console.log('ss', y);
                };

                $(document).on('ui:redraw', this.redrawListener);

                holder.area.click(() => {
                    this.holder.area.removeAttr('data-placeholder');
                    // this.holder.area.css('content', '');
                    console.log('area click')
                    
                });

                holder.area.focusout(() => {
                    this.holder.area.attr('data-placeholder', this.placeholder)
                });

                this.goToPassageListener = () => {
                    console.log('goToPassageListener')
                    if (this.disabled){
                        return;
                    }

                    this.holder.area.off('DOMSubtreeModified');
                    this.disabled = true;
                    
                    // console.log([
                    //     this.holder.area.text().length,
                    //     this.holder.area.text(),
                    //     (this.holder.area.text().length !== 0)
                    // ]);
                    if (this.holder.area.text().length != 0) {
                        if (this.changeColor){
                            this.holder.area.css('color', this.backgroundColor);
                            this.holder.area.css('background-color', this.color);
                            this.holder.svg.css('display', 'none');
                        }
                        this.holder.area.attr("contenteditable", "false");
                    } else {
                        this.holder.area.addClass("editor-area-empty-disabled");
                        this.holder.area.attr("contenteditable", "false");
                        if(!this.removePlaceholder){
                            this.holder.area.text(
                                this.holder.area.attr('data-placeholder')
                            );                            
                        }else{
                            this.holder.area.text("");
                        }
                    }
                    this.unbindListeners();
                };
                $(document).on("twine:go-to-passage", this.goToPassageListener);

                return this.holder.root;
            }

            unbindListeners(){
                $(document).off('ui:redraw', this.redrawListener);
                $(document).off("twine:go-to-passage", this.goToPassageListener);
                // this.holder.area.off('DOMSubtreeModified', this.DOMSubtreeModifiedListener);
                this.observer.disconnect();

            }

            resizeSvg(){
                const width = this.holder.area.outerWidth();
                const height = this.holder.area.outerHeight();
                console.log(`resizing to w: ${width}, h: ${height}`);

                // this.holder.svg.css('height', height + "px");
                // this.holder.svg.css('width', width + "px");
                // this.holder.svg.css('visibility', 'visible');

                this.holder.svg.attr('height', height);
                // this.holder.svg.attr('width', width);

                this.holder.svgPath.attr('height', height);
                this.holder.svgPath.attr('width', width);

                const margin = 18;
                this.holder.svgDots.attr('x', margin);
                this.holder.svgDots.attr('width', width - margin * 2);
            }
        }
        return TextEditView;
    }
);