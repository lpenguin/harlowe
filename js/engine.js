define(['jquery', 'utils', 'utils/selectors', 'state', 'section', 'passages'],
($, Utils, Selectors, State, Section, Passages) => {
	"use strict";
	/*
		Utils.storyElement is a getter, so we need a reference to Utils as well
		as all of these methods.
	*/
	const {escape, impossible, passageSelector, transitionOut, assert} = Utils;
	
	/**
		A singleton class responsible for rendering passages to the DOM.

		@class Engine
		@static
	*/
	let Engine;
	
	/**
		Story options, loaded at startup and provided to other modules that may use them.
		
		Implemented values:
		
		debug : debug mode is ready. Click the bug icon to reveal all macro spans.
		undo : enable the undo button.
		redo : enable the redo button.
		
		@property {Object} options
	*/
	const options = Object.create(null);

	/**
		Creates the HTML structure of the <tw-passage>. Sub-function of showPassage().

		@method createPassageElement
		@private
		@return {jQuery} the element
	*/
	function createPassageElement () {
		const
			container = $('<tw-passage><tw-sidebar>'),
			sidebar = container.children(Selectors.sidebar);
		
		/*
			Generate the HTML for the permalink.
			(This is currently unavailable as of Harlowe 1.0)
		*/
		if (options.permalink && State.save) {
			sidebar.append(
				'<tw-icon tabindex=0 class="permalink" title="Permanent link to this passage"><a href="#' + State.save() + '">&sect;'
			);
		}
		// Apart from the Permalink, the sidebar buttons consist of Undo (Back) and Redo (Forward) buttons.
		const
			back = $('<tw-icon tabindex=0 class="undo" title="Undo">&#8630;</tw-icon>').click(Engine.goBack),
			fwd  = $('<tw-icon tabindex=0 class="redo" title="Redo">&#8631;</tw-icon>').click(Engine.goForward);

		if (State.pastLength <= 0) {
			back.css("visibility", "hidden");
		}
		if (State.futureLength <= 0) {
			fwd.css( "visibility", "hidden");
		}
		sidebar.append(back).append(fwd);

		return container;
	}
	
	/*
		A small helper that generates a HTML tag containing injected
		setup passage source. Used in showPassage.
	*/
	function setupPassageElement(tagType, setupPassage) {
		return "<tw-include type=" + tagType + " title='"
			+ escape(setupPassage.get('name'))
			+ "'>"
			+ setupPassage.get('source')
			+ "</tw-include>";
	}
	
	/**
		Shows a passage by transitioning the old passage(s) out, and then adds the new passages.

		@method showPassage
		@private
		@param {String} name
		@param {Boolean} stretch Is stretchtext
	*/
	function showPassage (name, stretch) {
		const
			// Transition ID
			// Temporary measure: must change when customisable links are implemented.
			t8n = "instant",
			// The passage
			passageData = Passages.get(name),
			// The <tw-story> element
			story = Utils.storyElement,
			/*
				The <tw-story>'s parent is usually <body>, but if this game is embedded
				in a larger HTML page, it could be different.
			*/
			parent = story.parent();
		/*
			Early exit: the wrong passage name was supplied.
			Author error must never propagate to this method - it should have been caught earlier.
		*/
		if (!passageData || !(passageData instanceof Map) || !passageData.has('source')) {
			impossible("Engine.showPassage", "There's no passage with the name \""+name+"\"!");
		}
		
		/*
			Because rendering a passage is a somewhat intensive DOM manipulation,
			the <tw-story> is detached before and reattached after.
		*/
		story.detach();
		
		/*
			Find out how many tw-passage elements there are currently in the
			destination element.
		*/
		const oldPassages = Utils.$(story.children(passageSelector));
		
		/*
			If this isn't a stretchtext transition, send away all of the
			old passage instances.
		*/
		if (!stretch && t8n) {
			transitionOut(oldPassages, t8n);
		}
		
		const newPassage = createPassageElement().appendTo(story);
		
		assert(newPassage.length > 0);
		
		const section = Section.create(newPassage);
		
		/*
			Actually do the work of rendering the passage now.
			First, gather the source of the passage in question.
		*/
		let source = passageData.get('source');
		
		/*
			Now, we add to it the source of the 'header' and 'footer' tagged passages.
			We explicitly include these passages inside <tw-header> elements
			so that they're visible to the author when they're in debug mode, and can clearly
			see the effect they have on the passage.
		*/
		source =
			(options.debug
				? Passages.getTagged('debug-header')
					.map(setupPassageElement.bind(0, "debug-header"))
					.join('')
				: '')
			+ Passages.getTagged('header')
			.map(setupPassageElement.bind(0, "header"))
			.join('')
			+ source
			+ Passages.getTagged('footer')
			.map(setupPassageElement.bind(0, "footer"))
			.join('')
			+ (options.debug
				? Passages.getTagged('debug-footer')
					.map(setupPassageElement.bind(0, "debug-footer"))
					.join('')
				: '')
			;
		
		/*
			We only add the startup and debug-startup passages if this is the very first passage.
			Note that the way in which source is modified means that startup code
			runs before header code.
		*/
		if (State.pastLength <= 0) {
			if (options.debug) {
				source = Passages.getTagged('debug-startup')
					.map(setupPassageElement.bind(0, "debug-startup"))
					.join('')
					+ source;
			}
			source = Passages.getTagged('startup')
				.map(setupPassageElement.bind(0, "startup"))
				.join('')
				+ source;
		}
		
		/*
			Then, run the actual passage.
		*/
		section.renderInto(
			source,
			newPassage,
			/*
				Use the author's styles, assigned using TwineScript,
				as well as this basic, default ChangeDescriptor-like object
				supplying the transition.
			*/
			[{ transition: "dissolve" }]
		);
		
		// TODO: Change `$('html')` to `parent` for 2.0.0
		$('html').append(story);
		/*
			In stretchtext, scroll the window to the top of the inserted element,
			minus an offset of 5% of the viewport's height.
			Outside of stretchtext, just scroll to the top of the <tw-story>'s element.
		*/
		scroll(
			0,
			// TODO: Change `parent` to `story` for 2.0.0
			stretch ? newPassage.offset().top - ($(window).height() * 0.05) : parent.offset().top
		);
	}
	
	Engine = {
		
		/**
			Moves the game state backward one turn. If there is no previous state, this does nothing.

			@method goBack
		*/
		goBack() {
			//TODO: get the stretch value from state

			if (State.rewind()) {
				showPassage(State.passage);
			}
		},

		/**
			Moves the game state forward one turn, after a previous goBack().

			@method goForward
		*/
		goForward() {
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
		goToPassage(id, stretch) {
			// Update the state.
			State.play(id);
			showPassage(id, stretch);
		},
		
		/*
			Displays a new passage WITHOUT changing the game state.
			Used exclusively by state-loading routines.
		*/
		showPassage: showPassage,
		
		options: options,
	};
	
	return Object.freeze(Engine);
});
