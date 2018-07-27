"use strict";
define(
    ['jquery', 'components/story-saver', 'components/i18n'],
    ($, getStorySaver, translate) => {
        class SaveButton{
            constructor({baseUrl}){
                this._baseUrl = baseUrl;
            }

            buildView(){
                let text = `<span title="{{SAVE}}" class="save-button"></span>`;

                const span = $(translate(text));
                span.click(() => this.saveStory());
                this.$el = span;

                return span;
            }

            saveStory(){
                let storySaver = getStorySaver();
                storySaver.saveStory((data) => {
                    const url = `${this._baseUrl}/${data['link-pdf']}`;
                    window.open(url);
                    // this.replaceEl(data['link-html'], data['link-pdf']);
                });
            }

            // replaceEl(linkHtml, linkPdf){
            //     const href = $(`<p><a style="color:black" href="${this._baseUrl}/${linkHtml}">Link</a></p><p><a style="color:black" href="${this._baseUrl}/${linkPdf}">Download PDF</a></p>
            //     `);
            //     this.$el.replaceWith(href);
            // }
        }
        return SaveButton;
    });
