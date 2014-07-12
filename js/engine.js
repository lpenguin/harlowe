define(['jquery', 'twinemarkup', 'renderer', 'story', 'utils', 'selectors', 'state', 'twinescript', 'macros'], 
function ($, TwineMarkup, Renderer, Story, Utils, Selectors, State, TwineScript, Macros) {
	"use strict";
	
	/**
		A singleton class responsible for rendering passages to the DOM.

		@class Engine
		@static
	*/

	/**
		Creates the HTML structure of the <tw-passage>. Sub-function of showPassage().

		@method createPassageElement
		@private
		@return {jQuery} the element
	*/
	function createPassageElement () {
		var container, back, fwd, sidebar;
		container = $('<tw-passage><tw-sidebar>'),
		sidebar = container.children(Selectors.sidebar);
		
		// Permalink
		sidebar.append('<tw-icon class="permalink" title="Permanent link to this passage"><a href="#' + State.save() + '">&sect;');
		// Apart from the Permalink, the sidebar buttons consist of Undo (Back) and Redo (Forward) buttons.
		back = $('<tw-icon class="undo" title="Undo">&#8630;</tw-icon>').click(Engine.goBack);
		fwd = $('<tw-icon class="redo" title="Redo">&#8631;</tw-icon>').click(Engine.goForward);

		if (State.pastLength <= 0) {
			back.css("visibility", "hidden");
		}
		if (State.futureLength <= 0) {
			fwd.css("visibility", "hidden");
		}
		sidebar.append(back).append(fwd);

		return container;
	}
	
	/**
		Shows a passage by transitioning the old passage(s) out, and then adds the new passages.

		@method showPassage
		@private
		@param {String} id
		@param {Boolean} stretch Is stretchtext
		@param {jQuery} el The DOM parent element to append to
	*/
	function showPassage (id, stretch, el) {
		var newPassage, // Passage element to create
			t8n, // Transition ID
			passageCode,
			passageData = Story.passageWithID(id),
			oldPassages;
		
		el = el || Utils.storyElement;
		oldPassages = Utils.$(el.children(Utils.passageSelector));
		
		if (!passageData) {
			Utils.impossible("Engine.showPassage","no passage with id \""+id+"\"");
			return;
		}

		$(window).scrollTop(oldPassages.offset());

		// Load the default transition if none specified

		t8n = passageData.attr("data-t8n") || "dissolve";

		// Transition out

		if (!stretch && t8n) {
			Utils.transitionOut(oldPassages, t8n);
		}
		// Create new passage
		passageCode = Utils.unescape(passageData.html());
		newPassage = createPassageElement().append(Engine.render(passageCode, $()));
		el.append(newPassage);
		Engine.updateEnchantments(newPassage);

		// Transition in
		if (t8n) {
			Utils.transitionIn(newPassage, t8n);
		}
	}
	
	/**
		Given a <tw-expression js> freshly rendered from TwineScript,
		run the expression and return its value, removing the
		js attribute and rendering the <tw-expression> inert.
		
		@method runExpression
		@private
		@param {jQuery} el The element.
		@param {ScriptEnviron} 
		@return The result of the expression.
	*/
	function runExpression(el, environ) {
		var call = Utils.unescape(el.attr('js'));
		el.removeAttr('js');
		
		/*
			Execute the expression.
		*/
		return environ.eval(call);
	}
	
	/**
		This runs the changer functions that changer macros
		return, and performs the augmentations that they request,
		on the hooks they specify.
	*/
	function runChangerFunction(fn, target, top) {
		/*
			This is the "default" ChangerDescriptor.
			It simply takes the 'code' in the target hook,
			renders it to the target unaltered, appending
			the elements, with no special transition.
		*/
		var result,
			desc = {
				code:             target.attr('code'),
				transition:       "",
				transitionTime:   1000,
				target:           target,
				append:           "append"
			};
		
		// This line here runs the function.
		fn(desc);
		
		/*
			If no code is left in the descriptor, do nothing.
			If there's code but no target, something
			incorrect has transpired.
		*/
		
		if (!desc.code) {
			return;
		}
		else if (!desc.target) {
			Utils.impossible("Engine.runChangerFunction",
				"ChangerDescriptor has code but not a target!");
			return;
		}
		
		// Render the code
		result = Engine.render(desc.code + '', top);
		if (result && !(result instanceof Error)) {
			// Append it using the descriptor's given jQuery method
			desc.target[desc.append](result);
			desc.target.removeAttr('code');
			// Transition it using the descriptor's given transition
			if (desc.transition) {
				Utils.transitionIn(result, desc.transition);
			}
			// and update enchantments
			Engine.updateEnchantments(top);
		}
	}
	
	var
		/*
			These two vars cache the previously rendered source text, and the syntax tree returned by
			TwineMarkup.lex from that.
		*/
		renderCacheKey,
		renderCacheValue,
		
		Engine = {
		
		/**
			Moves the game state backward one turn. If there is no previous state, this does nothing.

			@method goBack
		*/
		goBack: function () {
			//TODO: get the stretch value from state

			if (State.rewind()) {
				showPassage(State.passage);
			}
		},

		/**
			Moves the game state forward one turn, after a previous goBack().

			@method goForward
		*/
		goForward: function () {
			//TODO: get the stretch value from state

			if (State.fastForward()) {
				showPassage(State.passage);
			}
		},

		/**
			Displays a new passage, advancing the game state forward.

			@method goToPassage
			@param {String} id			id of the passage to display
			@param {Boolean} stretch	display as stretchtext?
		*/
		goToPassage: function (id, stretch) {
			// Update the state.
			State.play(id);
			showPassage(id, stretch);
		},

		/**
			Does all initial startup work. This should be called once.

			@method init
		*/
		init: function () {
			var html = $(document.documentElement);
			
			// Install the handler for passage links.

			html.on('click.passage-link', Selectors.internalLink+'[passage-id]', function(e) {
				var next = $(this).attr('passage-id');

				if (next) {
					// TODO: stretchtext
					Engine.goToPassage(next,false);
				}

				e.preventDefault();
			});

			// If the debug option is on, add the debug button.

			if (Story.options.debug) {
				$(document.body).append($('<div class="debug-button">').click(function() {
					html.toggleClass('debug-mode');
				}));
			}
		},

		/**
			Updates all enchantment DOM structures in the passage.

			@method updateEnchantments
			@param {jQuery} top The passage element in which this is being performed.
		*/
		updateEnchantments: function (top) {
			// Remove the old enchantments
			Utils.$(Selectors.pseudoHook, top).children().unwrap();
			Utils.$(Selectors.hook, top).attr("class", "");

			// Perform actions for each scoping macro's scope.
			Utils.$(Selectors.enchanter, top).each(function () {
				var enchantment = $(this).data("enchantment");
				if (enchantment) {
					// Refresh the scope, and enchant it.
					enchantment.refreshScope();
					enchantment.enchantScope();
				}
			});
		},

		/**
			The top-level rendering method.

			@method render
			@param {string} source The code to render - HTML entities must be unescaped
			@param {jQuery} [top] the topmost DOM level into which this will be rendered
			(usually a <tw-passage>). Undefined if this is the document top.
			@return {jQuery} The rendered passage.
		*/
		render: function render(source, top) {
			var ret, html, environ;
			
			// If a non-string is passed into here, there's really nothing to do.
			if (typeof source !== "string") {
				Utils.impossible("Engine.render", "source was not a string, but " + typeof source);
				return $();
			}
			// Let's not bother if this source solely held macros.
			if (source.trim()) {
				/*
					A rudimentary caching mechanism to save on lexing:
					if the previously rendered source is the same as this,
					recall the HTML that was produced.
				*/
				if (source === renderCacheKey) {
					html = renderCacheValue;
				}
				else {
					html = Renderer.render(TwineMarkup.lex(source));
					renderCacheKey = source;
					renderCacheValue = html;
				}
			}
			// Render the HTML
			/*
				Important: various Twine macros perform DOM operations on this pre-inserted jQuery set of
				rendered elements, but assume that all the elements have a parent item, so that e.g.
				.insertBefore() can be performed on them. Also, and perhaps more saliently, the next
				block uses .find() to select <tw-macro> elements etc., which assumes that no <tw-macro>
				elements are present at the jQuery object's "root level".
				
				So, a <tw-temp-container> is temporarily used to house the entire rendered HTML
				before it's inserted at the end of this function.
			*/
			ret = $('<tw-temp-container>' + html);
			
			/*
				To provide the macros with a sufficient top,
				unwrap the <tw-temp-container>, and add the 'top' for this
				rendered fragment.
			*/
			top = ret.contents().add(top);
			environ = TwineScript.environ(top);
			
			/*
				Execute expressions immediately
			*/
			ret.find(Selectors.hook + ","
				+ Selectors.expression + ","
				+ Selectors.internalLink).each(function doExpressions () {
				var el = $(this),
					// Hoisted vars, used by the tw-link case
					passage,
					text,
					visited,
					// Hoisted vars, used by the tw-expression case
					result,
					desc,
					nextHook;

				switch(this.tagName.toLowerCase()) {
					case Selectors.hook:
					{
						if (el.attr('code')) {
							el.append(Engine.render(el.attr('code'), top));
							el.removeAttr('code');
						}
						break;
					}
					case Selectors.expression:
					{
						
						/*
							Execute the expression.
						*/
						result = runExpression(el,environ);
						
						/*
							The result can be any of these values, and
							should be put to use in the following ways:
							
							falsy primitive:
								Remove the nearest hook.
							stringy primitive:
								Print into the passage.
							thunk:
								Unwrap the thunk, then continue.
							function with .changer property:
								Assume this was returned by a changer macro.
								Call runChangerFunction with it and the nearest hook
								as arguments.
							function:
								Run it, passing the nearest hook and the top to it.
						*/
						if (typeof result === "function" && result.thunk) {
							// Unwrap the thunk to get the result
							result = result();
						}
						if (typeof result === "function") {
							/*
								Check if any hook is connected to this expression's result.
							*/
							nextHook = el.next("tw-hook");
							if (nextHook.length) {
								if (result.changer) {
									runChangerFunction(result, nextHook, top);
								}
								else {
									result(nextHook, top);
								}
							}
						}
						// Having run that, print any error that resulted.
						if (result instanceof Error) {
							el.addClass('error').text(result.message);
							break;
						}
						else if (typeof result === "string") {
							/*
								Transition the resulting Twine code into the expression's element.
							*/
							result = Engine.render(result + '', top);
							if (result) {
								el.append(result);
							}
						}
						// And finally, the falsy primitive case
						else if (nextHook && (result === false
								|| result === null || result === undefined)) {
							nextHook.removeAttr('code');
						}
						break;
					}
					
					/*
						TODO: there should perchance exist "lazy links" whose passage-exprs are not
						evaluated into passage-ids until the moment they are clicked.
					*/
					case Selectors.internalLink:
					{
						passage = Utils.unescape(el.attr("passage-expr"));
						text = el.text();
						visited = -1;
						
						if (Story.passageNamed(passage)) {
							visited = (State.passageNameVisited(passage));
						} else {
							// Is it a code link?
							try {
								passage = TwineScript.environ(top).eval(passage);
								Story.passageNamed(passage) && (visited = (State.passageNameVisited(passage)));
							} catch(e) { /* pass */ }
							
							// Not an internal link?
							if (!~visited) {
								el.replaceWith('<tw-broken-link passage-id="' + passage + '">' + (text || passage) + '</tw-broken-link>');
							}
						}
						el.removeAttr("passage-expr").attr("passage-id", Story.getPassageID(passage));
						if (visited) {
							el.addClass("visited");
						}
						if (Story.options.opaquelinks) {
							el.attr("title",passage);
						}
						break;
					}
				}
			});
			// Unwrap the aforementioned <tw-temp-container>.
			return ret.contents();
		}
	};
	
	Utils.log("Engine module ready!");
	/*
	DEBUG
	*/
	window.REPL = function(a) { var r = TwineScript.compile(TwineMarkup.lex("print("+a+")"));console.log(r);return TwineScript.environ().eval(r);};
	window.LEX = function(a) { var r = TwineMarkup.lex(a); return (r.length===1 ? r[0] : r); };
	return Object.freeze(Engine);
});
