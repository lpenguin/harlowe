"use strict";
define(
    ['jquery'],
    ($) => {
        class SplitScrollView {
            constructor({offset}){
                this._passagesMap = {};
                this._offset = offset || 0;

                $(window).on('scroll', () => {
                    var scrolledY = window.pageYOffset || document.documentElement.scrollTop;
                    var scrolledX = window.pageXOffset || document.documentElement.scrollLeft;
                    this.onScroll(scrolledY, scrolledX);
                })

                // $(window).on('scroll', () => {});
                $(window).resize(() => {
                    this.checkSizes()
                    this.initWidth();
                })
                // this.$rightSideInner.on("DOMSubtreeModified", () => {
                //     console.log('DOMSubtreeModified');
                //     var scrolledY = window.pageYOffset || document.documentElement.scrollTop;
                //     var scrolledX = window.pageXOffset || document.documentElement.scrollLeft;
                //     this.onScroll(scrolledY, scrolledX);
                // });
            }

            checkSizes(){
                if(window._isMobile || this.$root.outerWidth() < 600){
                    this.$leftSide.css('width', '100%');
                    this.$rightSide.css('display', 'none');
                }else{
                    this.$rightSide.css('display', 'block');
                    this.$leftSide.css('width', '50%');
                }
            }
            createElement(){
                this.$root = $("<div></div>").addClass("split-root");
                this.$leftSide = $("<div></div>").addClass("split-left");
                this.$rightSide = $("<div></div>").addClass("split-right");
                this.$rightSideInner = $("<div></div>").addClass('right-side-inner');

                this.$root.append(this.$leftSide);
                this.$root.append(this.$rightSide);
                this.$rightSide.append(this.$rightSideInner);

                // setTimeout(() => {
                // }, 0);

                // this.checkSizes();
                return this.$root;
            }
            initWidth(){
                this.$rightSideInner_width = this.$rightSide.outerWidth();
                this.$rightSideInner.css('width', this.$rightSideInner_width + 'px');
            }
            addPassage(name, $partLeft, $partRight){
                this.$leftSide.append($partLeft);
                this._passagesMap[name] = [$partLeft, $partRight];
                this.showPassage(name);
                // this.$rightSideInner.empty();
                // this.$rightSideInner.append($partRight);
                
                // this._selectPassage($partLeft);
            }

            _handleStickyRightSize(scrolledY){
                // console.log(`_handleStickyRightSize(${scrolledY})`);
                const rootTop = this.$root.offset().top;
                const rootBottom1 = rootTop + this.$root.outerHeight() 
                                          - this.$rightSideInner.outerHeight()
                                          ;
                // console.log(scrolledY, rootBottom1, scrolledY - rootBottom1)
                if(this.$rightSideInner.outerHeight() > this.$root.outerHeight()){
                    this.$rightSideInner.removeClass('right-side-inner-fixed');
                    this.$rightSideInner.removeClass('right-side-inner-bottom');
                    this.$rightSideInner.css('top', '');
                } else if (scrolledY < rootTop - this._offset) {
                    // console.log(1);
                    this.$rightSideInner.removeClass('right-side-inner-fixed');
                    this.$rightSideInner.removeClass('right-side-inner-bottom');
                    this.$rightSideInner.css('top', '');
                } else if (scrolledY >= (rootTop - this._offset) && scrolledY < rootBottom1 - this._offset){
                    // console.log(2);
                    this.$rightSideInner.removeClass('right-side-inner-bottom');
                    this.$rightSideInner.addClass('right-side-inner-fixed');
                    this.$rightSideInner.css('top', this._offset+'px');
                } else {
                    // console.log(3);
                    this.$rightSideInner.removeClass('right-side-inner-fixed');
                    this.$rightSideInner.addClass('right-side-inner-bottom');
                    this.$rightSideInner.css('top', (rootBottom1 - rootTop) + 'px');
                }
            }

            showPassage(name){
                const [$partLeft, $partRight] = this._passagesMap[name];
                if($partRight.text() != ""){
                    this.$rightSideInner.empty();
                    this.$rightSideInner.append($partRight);  
                    $partRight.css('opacity', 0);
                    $partRight.animate({'opacity': 1}, 300);
                }
                // $partRight.addClass('part-selected');
                // $partLeft.css('background-color', 'red');
                this._selectPassage($partLeft);

            }

            _selectPassage($partLeft){
                $.each(this._passagesMap, (name, l) => {
                    const [$partLeft, $partRight] = l;
                    $partLeft.removeClass('part-selected');
                });
                $partLeft.addClass('part-selected');
            }
            
            onScroll(scrolledY, scrolledX){
                this._handleStickyRightSize(scrolledY);
            }
        }
        return SplitScrollView;
    }
);