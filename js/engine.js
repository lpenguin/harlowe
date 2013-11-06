define(['jquery', 'twinemarked', 'story', 'utils', 'state', 'macros', 'script'], function ($, Marked, Story, Utils, State, Macros, Script) {
	"use strict";

	/**
	 A singleton class responsible for rendering passages to the DOM.

	 @class Engine
	*/

	var Engine = {
		// Advance the game state back

		/**
			Moves the game state backward one. If there is no previous state, this does nothing.

			@method goBack
		*/
		goBack: function () {
			//TODO: get the stretch value from state

			if (State.rewind()) {
				Engine.showPassage(State.passage);
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
			Engine.showPassage(id, stretch);
		},

		/**
			Does all initial startup work. This should be called once.

			@method init
		*/
		init: function () {
			var html = $(document.documentElement);
			
			// Install handler for links

			html.on('click.passage-link', '.passage-link[data-passage-link]', function (e) {
				var next = Story.getPassageID($(this).attr('data-passage-link'));

				if (next)
					Engine.goToPassage(next);

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
			Utils.$(".pseudo-hook", top).children().unwrap();
			Utils.$(".hook", top).attr("class", "hook");

			// Perform actions for each scoping macro's scope.
			Utils.$(".hook-macro", top).each(function () {
				var instance = $(this).data("instance");
				if (instance) {
					// Refresh the scope, and enchant it.
					instance.refreshScope();
					instance.enchantScope();
				}
			});
		},

		/**
			Creates the HTML structure of the passage <section>. Sub-function of showPassage().

			@method createPassageElement
			@private
		*/
		createPassageElement: function () {
			var container, back, fwd, sidebar;
			container = $(
				'<section class="passage"><nav class="sidebar"><span class="link icon permalink" title="Permanent link to this passage">&sect;</span></nav></section>'
			),
			sidebar = container.children(".sidebar");

			back = $('<span class="link icon undo" title="Undo">&#8630;</span>').click(Engine.goBack);
			fwd = $('<span class="link icon redo" title="Redo">&#8631;</span>').click(Engine.goForward);

			if (State.pastLength() <= 1) {
				back.css({
					visibility: "hidden"
				});
			}
			if (!State.futureLength()) {
				fwd.css({
					visibility: "hidden"
				});
			}
			sidebar.append(back).append(fwd);

			return container;
		},

		/**
			Shows a passage by transitioning the old passage(s) out, and then adds the new passages.

			@method showPassage
			@private
			@param {String} id
			@param {Boolean} stretch Is stretchtext
			@param {jQuery} el DOM parent element to append to
		*/
		showPassage: function (id, stretch, el) {
			var newPassage,
				t8n,
				el = el || Utils.storyElement,
				passageData = Story.passageWithID(id),
				oldPassages = Utils.$(el.children(".passage"));

			if (!passageData)
				return;

			$(window).scrollTop(oldPassages.offset());

			// Load the default transition if none specified

			t8n = passageData.attr("data-t8n") || "dissolve";

			// Transition out

			if (!stretch && t8n)
				Utils.transitionOut(oldPassages, t8n);

			// Create new passage

			newPassage = Engine.createPassageElement().append(Engine.render(Utils.convertEntity(passageData.html()), void 0, el));
			el.append(newPassage);
			Engine.updateEnchantments(el);

			// Transition in
			if (t8n) {
				Utils.transitionIn(newPassage, t8n);
			}
			// TODO: HTML5 history
		},

		/**
			Renders macros to HTML. Called by render().

			@method renderMacros
			@private
			@param {String} source		source text to render
			@return {Array} Two entries: the HTML to render, and all Macros 
		**/
		renderMacros: function (source) {
			var macroInstances = [],
				macroCount = 0,
				newhtml = "",
				index = 0;

			Macros.matchMacroTag(source, null, function (m) {
				// A macro by that name doesn't exist

				if (!m.desc)
					m.desc = Macros.get("unknown");

				// Contain the macro in a hidden span.

				newhtml += source.slice(index, m.startIndex) + '<span data-count="' + macroCount + '" data-macro="' + m.name +
					'" hidden></span>';
				macroInstances.push(m);
				macroCount += 1;
				index = m.endIndex;
			});

			newhtml += source.slice(index);
			return [newhtml, macroInstances];
		},

		/**
			Makes a passage link. Sub-function of render().
			Passage links can be either passage names, or Twine
			code (e.g. "red" + $val).
			TODO: Figure out how external links fit into this.
			TODO: All link code is executed before all macro code. Fix this.

			@method renderLink
			@private
			@param {String} [text] Text to display as link
			@param {jQuery} passage Passage to link to
			@return HTML string
		*/
		renderLink: function (text, passage) {
			var visited = -1;

			if (Story.passageNamed(passage)) {
				visited = (State.passageNameVisited(passage));
			} else {
				// Is it a code link?
				try {
					passage = Script.eval(Script.convertOperators(passage));
					Story.passageNamed(passage) && (visited = (State.passageNameVisited(passage)));
				} catch(e) { console.log(e.message) }
				
				// Not an internal link?
				if (!~visited) {
					return '<span class="broken-link" data-passage-link="' + passage + '">' + (text || passage) + '</span>';
				}
			}

			return '<span class="link passage-link ' + (visited ? 'visited" ' : '" ') + (Story.options.opaquelinks ? '' :
				'href="#' + escape(passage.replace(/\s/g, '')) + '"') + ' data-passage-link="' + passage + '">' + (text || passage) + '</span>';
		},

		/**
			The top-level rendering method.

			@method render
			@param {string} source The code to render - HTML entities must be unescaped
			@param {MacroInstance} context Macro instance which triggered this rendering.
			@param {jQuery} top the topmost DOM level into which this will be rendered (usually ".passage"). Undefined if this is the top.
			@return HTML source
		*/
		render: function (source, context, top) {
			var html, temp, macroInstances;
			
			// The following syntax depends on access to the story data to perform,
			// so it must occur outside of Marked.

			// replace [[ ]] with twine links

			/* 
				Format 1:
				[[display text|link]] format
				Twine 1 / TiddlyWiki / reverse MediaWiki link syntax.
				Possible bug: doesn't check for '\' preceding the first '['
			*/

			source += "";
			source = source.replace(/\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/g, function (match, text, passage) {
				return Engine.renderLink(text, passage);
			});

			/*
				Format 2:
				[[display text->link]] format
				[[link<-display text]] format
				
				Leon note: This, in my mind, looks more intuitive w/r/t remembering the type of the arguments.
				The arrow always points to the passage name.
				Passage names, of course, can't contain < or > signs.
				This regex will interpret the rightmost '->' and the leftmost '<-' as the divider.
			*/

			source = source.replace(/\[\[(?:([^\]]*)\->|([^\]]*?)<\-)([^\]]*)\]\]/g, function (match, p1, p2, p3) {
				// if right-arrow ->, then p1 is text, p2 is "", p3 is link.
				// If left-arrow <-, then p1 is "", p2 is link, p3 is text.
				return Engine.renderLink(p2 ? p3 : p1, p1 ? p3 : p2);
			});

			// [[link]] format

			source = source.replace(/\[\[([^\|\]]*?)\]\]/g, function (match, p1) {
				return Engine.renderLink(void 0, p1);
			});

			// macros

			temp = Engine.renderMacros(source);
			source = temp[0];
			macroInstances = temp[1];

			// Finally, do Markdown
			// (This must come last due to the charspan generation inhibiting any further matches.)

			try {
				source = Marked(source);
			} catch (e) {
				temp = Engine.renderMacros("<p>"+Utils.regexStrings.macroOpen + "rendering-error " +
					e + Utils.regexStrings.macroClose+"</p>");
				source = temp[0];
				macroInstances = temp[1];
			}

			// Render the HTML

			html = $(source);
			
			// Render macro instances
			// (Naming this closure for stacktrace visibility)

			Utils.$("[data-macro]", html).each(function renderMacroInstances() {
				var count = this.getAttribute("data-count");
				this.removeAttribute("hidden");
				macroInstances[count].run($(this), context, html.add(top));
			});

			// If one <p> tag encloses all the HTML, unwrap it.
			// Note: this must occur at the end

			if (html.length == 1 && html.get(0).tagName == 'P')
				html = html.contents();

			return html;
		}
	};

	return Object.freeze(Engine);
});
