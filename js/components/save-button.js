"use strict";
define(
    ['jquery'],
    ($) => {
        class SaveButton{
            constructor({baseUrl}){
                this._baseUrl = baseUrl;
            }

            buildView(){
                const span = $("<span />");
                span.addClass('save-button');
                span.click(() => this.saveStory());
                this.$el = span;

                return span;
            }

            saveStory(){
                const storyContents = $('tw-story').html();
                const styleContents = $('style[title="Twine CSS"]').html();

                const contents = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8" />
                        <style title="Twine CSS">${styleContents}</style>
                    </head>
                    <body>
                        <tw-story>${storyContents}</tw-story>
                    </body>
                </html>`;

                const username = "Foo bar!";
                const data = {
                    contents, username
                };

                $.ajax({
                    url: `${this._baseUrl}/api/submissions`,
                    type: 'POST',
                    data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8",
                    crossDomain: true,
                    success: (data) => {
                        this.replaceEl(data['link-html'], data['link-pdf']);
                    }
                });
            }

            replaceEl(linkHtml, linkPdf){
                const href = $(`<p><a style="color:black" href="${this._baseUrl}/${linkHtml}">Link</a></p><p><a style="color:black" href="${this._baseUrl}/${linkPdf}">Download PDF</a></p>
                `);
                this.$el.replaceWith(href);
            }
        }
        return SaveButton;
    });
