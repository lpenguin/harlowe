"use strict";
    function getScrollY(){
        // if(window.pageYOffset!= undefined){
        //   return pageYOffset;
        //  }
        //  else{
          var sx, sy, d= document, r= d.documentElement, b= d.body;
          sx= r.scrollLeft || b.scrollLeft || 0;
          sy= r.scrollTop || b.scrollTop || 0;
          return sy;
 // }
    }

define([
    'jquery', 
    'macros',
    'datatypes/changercommand',
    'components/textedit',
    ],
    ($, Macros, ChangerCommand, TextEditView) => {
        const {optional} = Macros.TypeSignature;
        Macros.addChanger(['text-edit'],
            (_, color, backgroundColor, changeColor, removePlaceholder, showSubmit) => {
                return ChangerCommand.create('text-edit', [color, backgroundColor, changeColor, removePlaceholder, showSubmit]);
            },
            (desc, color, backgroundColor, changeColor, removePlaceholder, showSubmit) => {
                // console.log([desc, color, backgroundColor, changeColor, removePlaceholder]);
                const textEdit = new TextEditView({
                    placeholder: desc.source || "",
                    color: color || "black",
                    backgroundColor: backgroundColor || "white",
                    changeColor: changeColor,
                    removePlaceholder: removePlaceholder,
                    showSubmit: showSubmit
                });
                desc.source = "";
                var e = textEdit.buildView();
                $(desc.target).append(e);    
                // textEdit.resizeSvg();
              //   setTimeout(function(){
              //     var y = $(window).scrollTop();
              //     // console.log('scroll top: ', getScrollY())
              //     // textEdit.holder.area[0].focus({preventScroll: true});
              //     // window.scrollTo(0, y);         
              //     // console.log('scroll top: ', getScrollY())

              // }, 1)
            },
            [optional(String), optional(String), optional(String), optional(String), optional(String)]
        );
    }
);