define(['jquery', 'twinemarked', 'renderer', 'story', 'utils', 'selectors', 'state', 'macros', 'script'], 
function ($, TwineMarked, Renderer, Story, Utils, Selectors, State, Macros, Script) {
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
		newPassage = createPassageElement().append(Engine.render(passageCode));
		el.append(newPassage);
		Engine.updateEnchantments(newPassage);

		// Transition in
		if (t8n) {
			Utils.transitionIn(newPassage, t8n);
		}
	}
	
	var Engine = {
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
			Utils.$(Selectors.hookMacroInstance, top).each(function () {
				var instance = $(this).data("instance");
				if (instance) {
					// Refresh the scope, and enchant it.
					instance.refreshScope();
					instance.enchantScope();
				}
			});
		},

		/**
			The top-level rendering method.

			@method render
			@param {string} source The code to render - HTML entities must be unescaped
			@param {MacroInstance} [context] Macro instance which triggered this rendering.
			@param {jQuery} [top] the topmost DOM level into which this will be rendered
			(usually a <tw-passage>). Undefined if this is the document top.
			@return {jQuery} The rendered passage.
		*/
		render: function (source, context, top) {
			var html;
			
			// If a non-string is passed into here, there's really nothing to do.
			if (typeof source !== "string") {
				Utils.impossible("Engine.render", "source was not a string");
				return $();
			}

			/*
				Do Markdown
			*/
			// Let's not bother if this source solely held macros.
			if (source.trim()) {
				try {
					source = Renderer.render(TwineMarked.lex(source));
				} catch (e) {
					Utils.impossible("Engine.render","Renderer crashed");
					
					source = "<tw-macro name='rendering-error'>" + e.stack + "</tw-macro>";
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
			html = $('<tw-temp-container>' + source);
			
			/*
				Execute macros immediately
			*/
			html.find(Selectors.macroInstance + ", " + Selectors.internalLink).each(function runMacroInstances () {
				var el = $(this),
					// Hoisted vars, used by the tw-link case
					passage,
					text,
					visited,
					// Hoisted vars, used by the tw-macro case
					desc,
					name,
					call,
					contents;

				switch(this.tagName.toLowerCase()) {
					case "tw-macro":
					{
						call = el.attr("call");
						contents = el.attr("contents");
						name = el.attr("name");
						desc = Macros.get(name);
						
						el.removeAttr("call").removeAttr("contents");
						
						Macros.instantiate(name, call, contents).run(el, context, 
							/*
								To provide the macros with a sufficient top,
								unwrap the <tw-temp-container>, and add the 'top' for this
								rendered fragment.
							*/
							html.contents().add(top));
						break;
					}
					/*
						To consider: there should perchance exist "lazy links" whose passage-exprs are not
						evaluated into passage-ids until the moment they are clicked.
					*/
					case "tw-link":
					{
						passage = Utils.unescape(el.attr("passage-expr"));
						text = el.text();
						visited = -1;
						
						if (Story.passageNamed(passage)) {
							visited = (State.passageNameVisited(passage));
						} else {
							// Is it a code link?
							try {
								passage = Script.environ().evalExpression(passage);
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
			return html.contents();
		}
	};
	
	Utils.log("Engine module ready!");
	
	return Object.freeze(Engine);
});
