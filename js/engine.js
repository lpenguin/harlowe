define(['jquery', 'story', 'utils', 'selectors', 'state', 'section'], 
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
		if (Story.options.permalink) {
			sidebar.append('<tw-icon class="permalink" title="Permanent link to this passage"><a href="#' + State.save() + '">&sect;');
		}
		// Apart from the Permalink, the sidebar buttons consist of Undo (Back) and Redo (Forward) buttons.
		back = $('<tw-icon class="undo" title="Undo">&#8630;</tw-icon>').click(Engine.goBack);
		fwd  = $('<tw-icon class="redo" title="Redo">&#8631;</tw-icon>').click(Engine.goForward);

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
		@param {jQuery} [el] The DOM parent element to append to
	*/
	function showPassage (id, stretch, el) {
		var
			// Passage element to create
			newPassage,
			// Transition ID
			t8n,
			// The <tw-passagedata> element
			passageData = Story.passageWithID(id),
			oldPassages,
			section,
			win = $(window);

		/*
			Early exit: the wrong passage ID was supplied.
		*/
		if (!passageData) {
			Utils.impossible("Engine.showPassage", "There's no passage with the id \""+id+"\"!");
			return;
		}
		
		/*
			There's an option to supply a destination element for the passage,
			but by and large it will be the storyElement that is the
			recipient.
		*/
		el = el || Utils.storyElement;
		
		el.detach();

		/*
			Find out how many tw-passage elements there are currently in the
			destination element.
		*/
		oldPassages = Utils.$(el.children(Utils.passageSelector));
		
		/*
			Scroll the window to the top, if it's being inserted
			into the window's DOM.
		*/
		if (win.find(el).length) {
			win.scrollTop(oldPassages.offset());
		}

		/*
			Identify which transition this passage is associated with.
			Use the default transition, "fade-in", if none specified.
		*/
		t8n = passageData.attr("data-t8n") || "fade-in";

		/*
			If this isn't a stretchtext transition, send away all of the
			old passage instances.
		*/
		if (!stretch && t8n) {
			Utils.transitionOut(oldPassages, t8n);
		}
		
		newPassage = createPassageElement().appendTo(el);
		
		section = Section.create(newPassage);
		
		/*
			Actually do the work of rendering the passage now.
		*/
		
		section.renderInto(
			Utils.unescape(
				passageData.html()
			),
			newPassage,
			/*
				...and apply the aforementioned transition.
			*/
			[]//function (desc) { desc.transition = t8n; }
		);
		$('body').append(el);
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
