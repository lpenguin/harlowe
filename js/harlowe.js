/*
	This require.config call must be in here, so that local testing of Harlowe
	can be conducted without having to recompile harlowe.min.js.
*/
"use strict";
require.config({
	paths: {
		// External libraries
		jquery:                       '../node_modules/jquery/dist/jquery',
		almond:                       '../node_modules/almond/almond',
		"es6-shim":                   '../node_modules/es6-shim/es6-shim',
		"requestAnimationFrame":      '../node_modules/requestanimationframe/app/requestAnimationFrame',
		jqueryplugins:                'utils/jqueryplugins',
		
		markup:                       './markup/markup',
		lexer:                        './markup/lexer',
		patterns:                     './markup/patterns',
	},
	deps: [
		'jquery',
		'es6-shim',
		'jqueryplugins',
	],
});
require(['components/story-saver', 'components/i18n', 'jquery', 'debugmode', 'renderer', 'state', 'engine', 'passages', 'utils/selectors', 'macros',
	'macrolib/values', 'macrolib/commands', 'macrolib/datastructures', 'macrolib/stylechangers', 'macrolib/enchantments', 'macrolib/links',
	'repl', 'macrolib/textedit', 'macrolib/save-button'],
		(getStorySaver, translate, $, DebugMode, Renderer, State, Engine, Passages, Selectors) => {
	/*
		Harlowe, the default story format for Twine 2.
		
		This module contains only code which initialises the document and the game.
	*/
	
	// Used to execute custom scripts outside of main()'s scope.
	function _eval(text) {
		return eval(text + '');
	}
	
	/*
		Sets up event handlers for specific Twine elements. This should only be called
		once at setup.
	*/
	let installHandlers = () => {
		const html = $(document.documentElement);
		
		/*
			This gives interactable elements that should have keyboard access (via possessing
			a tabindex property) some basic keyboard accessibility, by making their
			enter-key event trigger their click event.
		*/
		html.on('keydown', function(event) {
			if (event.which === 13 && event.target.getAttribute('tabindex') === "0") {
				$(event.target).trigger('click');
			}
		});
		
		// If the debug option is on, add the debugger.
		if (Engine.options.debug) {
			DebugMode();
		}
		installHandlers = null;
	};

	/*
		When an uncaught error occurs, then display an alert box once, notifying the author.
		This installs a window.onerror method, but we must be careful not to clobber any existing
		onerror method.
	*/
	((oldOnError) => {
		window.onerror = function (message, _, __, ___, error) {
			/*
				This convoluted line retrieves the error stack, if it exists, and pretty-prints it with
				URL references (in brackets) removed. If it doesn't exist, the message is used instead.
			*/
			const stack = (error && error.stack && ("\n" + error.stack.replace(/\([^\)]+\)/g,'') + "\n")) || ("(" + message + ")\n");
			alert("Sorry to interrupt, but this page's code has got itself in a mess. "
				+ stack
				+ "(This is probably due to a bug in the Harlowe game engine.)");
			/*
				Having produced that once-off message, we now restore the page's previous onerror, and invoke it.
			*/
			window.onerror = oldOnError;
			if (typeof oldOnError === "function") {
				oldOnError(...arguments);
			}
		};
	})(window.onerror);
	
	/*
		This is the main function which starts up the entire program.
	*/
	$(() => {

		const header = $(Selectors.storyData);

		if (header.length === 0) {
			return;
		}

		// Load options from attribute into story object

		const options = header.attr('options');

		if (options) {
			options.split(/\s/).forEach((b) => {
				Renderer.options[b] = Engine.options[b] = true;
			});
		}
		let startPassage = header.attr('startnode');

		/*
			The IFID is currently only used with the saving macros.
		*/
		Renderer.options.ifid = Engine.options.ifid = header.attr('ifid');
		
		// If there's no set start passage, find the passage with the
		// lowest passage ID, and use that.
		if (!startPassage) {
			startPassage = [].reduce.call($(Selectors.passageData), (id, el) => {
				const pid = el.getAttribute('pid');
				return (pid < id ? pid : id);
			}, Infinity);
		}
		startPassage = $(Selectors.passageData + "[pid=" + startPassage + "]").attr('name');

		// Init game engine

		installHandlers();
		
		// Execute the custom scripts
		
		$(Selectors.script).each(function(i) {
			try {
				_eval($(this).html());
			} catch (e) {
				// TODO: Something more graceful - an 'error passage', perhaps?
				alert("There is a problem with this story's script (#" + (i + 1) + "):\n\n" + e.message);
			}
		});
		
		// Apply the stylesheets
		
		$(Selectors.stylesheet).each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).append('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});
		
		window._lang = window._lang || 'EN';

		let headerHtml = `
	    <div class="header">
	      <div class="left-side">
	        <span class="vac-link" ></span>
	      </div>

	      <div class="center-side">
	        <div class="home-link link item">
	            <span><span class="exit-text">{{HOME}}</span> <span class="exit-img"></span></span>
	        </div>
	        <div class="share-link link item">
	            <span><span class="share-header-text">{{SHARE}} </span><span class="share-header-img"></span></span>
	        </div>
	      </div>

	      <div class="right-side">
	        <div class="lang-changer-link link">
            	<a href="{{SWITCH_LANG_LINK}}"><span class="lang-changer-icon lang-{{LANG}}"></span></a>
            </div>
	      </div>
	    </div>
        `;

        if(window._baseUrl == undefined){
        	window._baseUrl = "https://more-stories.v-a-c.ru/";
        }

        let switchLangLink = null;
        let swicthLang = null;
        const currentLocation = window.location.href.replace(/\/$/g, '');
        if(window._lang == 'RU'){
        	switchLangLink = window._baseUrl + '/en';//currentLocation.replace('/en', '')
        	swicthLang = 'EN';
        }else{ // EN
        	switchLangLink = window._baseUrl;
        	swicthLang = 'RU';
        }

        headerHtml = translate(headerHtml);
        headerHtml = headerHtml.replace("{{LANG}}", swicthLang.toLowerCase());
        headerHtml = headerHtml.replace("{{SWITCH_LANG_LINK}}", switchLangLink);





        $('body').prepend($(headerHtml));
        let fbScript = "<script>"+
		  "window.fbAsyncInit = function() {"+
		    "FB.init({"+
		      "appId      : '797963147074005',"+
		      "xfbml      : true,"+
		      "version    : 'v3.0'"+
		    "});"+
		    "FB.AppEvents.logPageView();"+
		  "};"+
		  "(function(d, s, id){"+
		     "var js, fjs = d.getElementsByTagName(s)[0];"+
		     "if (d.getElementById(id)) {return;}"+
		     "js = d.createElement(s); js.id = id;"+
		     "js.src = 'https://connect.facebook.net/en_US/sdk.js';"+
		     "fjs.parentNode.insertBefore(js, fjs);"+
		   "}(document, 'script', 'facebook-jssdk'));"+
		"</script>";
		if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
 			window._isMobile = true;
		}

		// window.scrollTo(0,0); 
		$('body').prepend($(fbScript));
        // $(window).resize(() => {
        // 	const documentRight = $('tw-story').outerWidth() + $('tw-story').offset().left;
        // 	const homeLinkRight =  $('.home-link').outerWidth() + $('.home-link').offset().left;
        // 	$('.home-link').css('right', (documentRight-$('.home-link').outerWidth())+'px');
        // 	// if(documentRight > homeLinkRight){
        // 		// $('.home-link').css('margin-right', (documentRight-homeLinkRight) + 'px');
        // 	// }
        // });

        $('.home-link').click(() => {
        	window.location.href = 'https://v-a-c.ru';
        });

        let shareButton = $(".share-link");
        shareButton.click(()=>{
        	let storyUrl = window.location.href;
    		FB.ui({
	          method: 'share',
	          href: storyUrl,
	        }, function(response){});
        	// let saver = getStorySaver();
        	// saver.saveStory((data)=>{
        	// 	let link = data['link-html'];
        	// 	console.log(link);

        	// })
        });

        const images = ['ALYS.jpg','ANGRY.jpg','ANGRY_EN.png','ANGRY_RU.png','ANTIN.jpg','B&C.jpg','CHERRI.jpg','DEAN.jpg','DOHERTY.jpg','DRAG.jpg','DRAG_EN.png','DRAG_RU.png','FICTIONS.jpg','FICTIONS_EN.png','FICTIONS_RU.png','FISH.jpg','FLOORS_EN.png','FLOORS_RU.png','FLUIDS.jpg','FLUIDS_EN.png','FLUIDS_RU.png','FRIEDL.jpg','GANDER.jpg','GLUSCHENKO.jpg','GONZALEZ.jpg','LAMPADA.jpg','MARBLE.jpg','MCKENZIE.jpg','MENICK.jpg','MOLLUSK.jpg','MOULENE.jpg','MYSE.jpg','MYSE_EN.png','MYSE_RU.png','OTOBONG_1.jpg','OTOBONG_2.jpg','PENONE.jpg','PERSISTENT.jpg','PERSISTENT_EN.png','PERSISTENT_RU.png','PIRICI_1.jpg','PIRICI_2.jpg','REENA.jpg','RICHER.jpg','RICHTER.jpg','SIDUR.jpg','SPOONER_1.jpg','SPOONER_2.jpg','SYSTEMS.jpg','SYSTEMS_EN.png','SYSTEMS_RU.png','TILLMANS.jpg','UFL.jpg','WARBOYS.jpg','WILLIAMS.jpg','WITNESSES.jpg','WITNESSES_EN.png','WITNESSES_RU.png','_cover.jpg', ];
		for(let imageUrl of images){
			const image = new Image();
			image.src = `http://more-stories.v-a-c.ru/${imageUrl}`;
		}
		console.log(images);


		// Load the hash if it's present
		if (window.location.hash && !window.location.hash.includes("stories")) {
			if (State.load(window.location.hash)) {
				Engine.showPassage(State.passage);
				return;
			}
		}



		// Show first passage!
		Engine.goToPassage(startPassage);
	});
});
