define(['jquery', 'twinemarked', 'story', 'utils', 'selectors', 'regexstrings', 'state', 'macros', 'script'], function ($, Marked, Story, Utils, Selectors, RegexStrings, State, Macros, Script) {
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
			el = el || Utils.storyElement,
			passageData = Story.passageWithID(id),
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
	
	/**
		Renders macros to HTML. Called by render().

		@method renderMacros
		@private
		@param {String} source		source text to render
		@return {Array} Two entries: the HTML to render, and all Macros 
	*/
	function renderMacros (source) {
		var macroInstances = [],
			macroCount = 0,
			newhtml = "",
			index = 0;

		Macros.matchMacroTag(source, null, function (m) {
			// A macro by that name doesn't exist

			if (!m.desc)
				m.desc = Macros.get("unknown");

			// Contain the macro in a hidden span.

			newhtml += source.slice(index, m.startIndex) + '<tw-macro count="' + macroCount + '" name="' + m.name +
				'" hidden></tw-macro>';
			macroInstances.push(m);
			macroCount += 1;
			index = m.endIndex;
		});

		newhtml += source.slice(index);
		return [newhtml, macroInstances];
	}
	
	var Engine = {
		/**
			Moves the game state backward one. If there is no previous state, this does nothing.

			@method goBack
		*/
		goBack: function () {
			//TODO: get the stretch value from state

			if (State.rewind()) {
				showPassage(State.passage);
			}
		},

		/**
			Moves the game state forward one after a previous goBack().

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
			
			// Install handler for links

			html.on('click.passage-link', Selectors.internalLink+'[passage-id]', function (e) {
				var next = $(this).attr('passage-id');

				if (next) {
					// TODO: stretchtext
					Engine.goToPassage(next,false);
				}

				e.preventDefault();
			});

			// If debug, add button

			if (Story.options.debug) {
				$(document.body).append($('<div class="debug-button">').click(function (e) {
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
			@param {jQuery} [top] the topmost DOM level into which this will be rendered (usually a <tw-passage>). Undefined if this is the document top.
			@return {jQuery} The rendered passage.
		*/
		render: function (source, context, top) {
			var html, temp, macroInstances;
			
			// If a non-string is passed into here, there's really nothing to do.
			if (typeof source !== "string") {
				Utils.impossible("Engine.render", "source was not a string");
				return $();
			}

			// macros

			temp = renderMacros(source);
			source = temp[0];
			macroInstances = temp[1];

			// Finally, do Markdown
			// (This must come last due to the charspan generation inhibiting any further matches.)

			// Let's not bother if this source solely held macros.
			if (source.trim()) {
				try {
					source = Marked(source);
				} catch (e) {
					Utils.impossible("Engine.render()","Marked crashed");
					temp = renderMacros("<p>"+RegexStrings.macroOpen + "rendering-error " +
						e + RegexStrings.macroClose+"</p>");
					source = temp[0];
					macroInstances = temp[1];
				}
			}

			// Render the HTML

			html = $(source);

			// Execute macros and update links
			// (Naming this closure for stacktrace visibility)

			$(Selectors.macroInstance + ", " + Selectors.internalLink, html).each(function runMacroInstances () {
				var passage,
					text,
					visited,
					count,
					el = $(this).removeAttr("larva");
				
				switch(this.tagName.toLowerCase()) {
					case "tw-macro":
					{
						count = this.getAttribute("count");
						this.removeAttribute("hidden");
						macroInstances[count].run($(this), context, html.add(top));
						break;
					}
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

			// If one <p> tag encloses all the HTML, unwrap it.
			// Note: this must occur at the end
			if (html.length == 1 && html.get(0).tagName.toUpperCase() == 'P')
				html = html.contents();

			return html;
		}
	};
	
	Utils.log("Engine module ready!");
	
	return Object.freeze(Engine);
});
