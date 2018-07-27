"use strict";
define(
    ['jquery'],
    ($) => {
        let cache = null;
        let instance = null;


        class Request{
            constructor(){
                this.listeners = [];
            }

            addListener(listener){
                if(listener){
                    this.listeners.push(listener);
                }
            }

            emit(data){
                for(let listener of this.listeners){
                    listener(data);    
                }
            }
        }

        class StorySaver{
            constructor({baseUrl}){
                this._baseUrl = baseUrl;
                this._currentRequest = null;
            }

            saveStory(listener){
                if(cache != null){
                    listener(cache);
                    return;
                }

                if(this._currentRequest != null){
                    this._currentRequest.addListener(listener);
                    return;
                }
                
                $('.part-right').remove()
                const storyContents = $('tw-story').html();
                const styleContents = $('style[title="Twine CSS"]').html();

                const contents = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8" />
                    </head>
                    <body>
                        <style title="Twine CSS">${styleContents}</style>
                        <tw-story>${storyContents}</tw-story>
                    </body>
                </html>`;

                const username = window._enteredText;
                const data = {
                    contents: contents, 
                    username: username || null,
                };
                console.log(data);

                this._currentRequest = new Request();
                this._currentRequest.addListener(listener);

                $.ajax({
                    url: `${this._baseUrl}/api/submissions`,
                    type: 'POST',
                    data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8",
                    crossDomain: true,
                    success: (data) => {
                        cache = data;
                        this._currentRequest.emit(data);
                    },
                    complete: () => {
                        this._currentRequest = null;
                    }
                });
            }
        }


        function getStorySaver(){
            if(instance == null){
                instance = new StorySaver({baseUrl: window._baseUrl});
            }
            return instance;
        }
        return getStorySaver;
    });
