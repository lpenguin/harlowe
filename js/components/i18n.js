"use strict";
define(
    [],
    () => {
        const i18n = {
            'share': {
                'RU': 'поделиться',
                'EN': 'I want you to see this',
            },
            'home': {
                'RU': 'домой',
                'EN': 'I want to go home',
            },
            'save': {
                'RU': 'сохранить',
                'EN': 'save',
            },
            'description': {
                'RU': 'Интерактивный нарратив',
                'EN': 'Interactive fiction'
            },
            'title': {
                'RU': 'Снова больше историй',
                'EN': 'Again, more stories'
            }

        };

        function translate(text){
            const lang = window._lang || "EN";

            for(let name in i18n){
                const value = i18n[name][lang];
                text = text.replace(`{{${name.toUpperCase()}}}`, value);
            }
            return text;
        }

        
        return translate;
    });
