define(['jquery', 'story', 'utils', 'utils/selectors', 'state', 'section'],
function ($, Story, Utils, Selectors, State, Section) {
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
		
		/*
			Generate the HTML for the permalink.
			(This is currently unavailable as of Harlowe 1.0)
		*/
		if (Story.options.permalink && State.save) {
			sidebar.append(
				'<tw-icon tabindex=0 class="permalink" title="Permanent link to this passage"><a href="#' + State.save() + '">&sect;'
			);
		}
		// Apart from the Permalink, the sidebar buttons consist of Undo (Back) and Redo (Forward) buttons.
		back = $('<tw-icon tabindex=0 class="undo" title="Undo">&#8630;</tw-icon>').click(Engine.goBack);
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
	
	/**
		Shows a passage by transitioning the old passage(s) out, and then adds the new passages.

		@method showPassage
		@private
		@param {String} id
		@param {Boolean} stretch Is stretchtext
	*/
	function showPassage (id, stretch) {
		var
			// Passage element to create
			newPassage,
			// Transition ID
			// Temporary measure: must change when customisable links are implemented.
			t8n = "instant",
			// The <tw-passagedata> element
			passageData = Story.passageWithID(id),
			oldPassages,
			section,
			// The <tw-story> element
			story = Utils.storyElement,
			/*
				The <tw-story>'s parent is usually <body>, but if this game is embedded
				in a larger HTML page, it could be different.
			*/
			parent = story.parent();
		/*
			Early exit: the wrong passage ID was supplied.
		*/
		if (!passageData) {
			Utils.impossible("Engine.showPassage", "There's no passage with the id \""+id+"\"!");
			return;
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
		oldPassages = Utils.$(story.children(Utils.passageSelector));

		/*
			If this isn't a stretchtext transition, send away all of the
			old passage instances.
		*/
		if (!stretch && t8n) {
			Utils.transitionOut(oldPassages, t8n);
		}
		
		newPassage = createPassageElement().appendTo(story);
		
		Utils.assert(newPassage.length > 0);
		
		section = Section.create(newPassage);
		
		/*
			Actually do the work of rendering the passage now.
		*/
		
		section.renderInto(
			Utils.unescape(
				passageData.html()
			),
			newPassage,
			{ transition: "dissolve" }
		);
		
		parent.append(story);
		/*
			In stretchtext, scroll the window to the top of the inserted element,
			minus an offset of 5% of the viewport's height.
			Outside of stretchtext, just scroll to the top of the <tw-story>'s element.
		*/
		scroll(
			0,
			stretch ? newPassage.offset().top - ($(window).height() * 0.05) : story.offset().top
		);
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
		
		/*
			Displays a new passage WITHOUT changing the game state.
			Used exclusively by state-loading routines.
		*/
		showPassage: showPassage,
	};
	
	return Object.freeze(Engine);
});
