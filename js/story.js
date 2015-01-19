define(['jquery', 'utils', 'utils/selectors'], function($, Utils, Selectors) {
	"use strict";
	/**
		Singleton object governing data concerning the stort and its structure.
		@class Story
		@static
	*/

	var Story = {

		/**
			Set of options, loaded at startup.
			
			opaquelinks : prevent players 'link sniffing' by eliminating the HREF of internal passage links.
			debug : debug mode is ready. Click the bug icon to reveal all macro spans.
			undo : enable the undo button.
			redo : enable the redo button.
			
			@property {Object} options
		*/
		options: {},
		
		/**
			The Page is essentially a simplified DOM for TwineScript access.
			
			Each element of this is a Map (known in TwineScript as a (datamap:)) that
			loosely maps to one of the actual TwineScript DOM elements,
			(<html>, <tw-story>, <tw-passage>), and has	the following properties:
			
			- "style": A ChangerCommand which determines how the given element is styled.
			Engine applies this style whenever it renders an element.
		*/
		page: new Map([
			/*
				First, the style of the page itself.
			*/
			["style", null],
			
			/*
				Now, the contained elements.
			*/
			["story", new Map([
				["style", null],
			])],
			
			["passage", new Map([
				["style", null],
			])],
		]),
		
		/**
			ID of the start passage.
			@property {String} startPassage
		*/
		startPassage: "",

		/**
			Get a passage, given a name
			This should only be called by story code handling objects - internally, passages are referenced by ID.
			
			@method passageNamed
			@param {String} name Name of the passage
			@return {jQuery|Boolean} The passage data element, or false.
			TODO: instead of false, return $().
		*/
		passageNamed: function (name) {
			var passage = $(Selectors.storyData + " > " + Selectors.passageData +'[name=' + Utils.toJSLiteral(name) + ']');
			
			return !!passage.length && passage;
		},

		/**
			Get a passage, given an ID
			
			@method passageWithID
			@param {String} id ID of the passage.
			@return {jQuery|Boolean} The passage data element, or false.
		*/
		passageWithID: function (id) {
			var passage = $(Selectors.storyData + " > " + Selectors.passageData +'[pid="' + id + '"]');

			return !!passage.length && passage;
		},

		/**
			Get the name of a passage, given its ID.
			@method getPassageName
			@param {String} id ID of the passage.
			@return {String} Name of the passage, or empty string.
		*/
		getPassageName: function (id) {
			var p = this.passageWithID(id);
			
			return p ? p.attr("name") : "";
		},

		/**
			Get the ID of a passage, given its name
			@method getPassageID
			@param {String} name Name of the passage.
			@return {String} ID of the passage, or empty string.
		*/
		getPassageID: function (name) {
			var p = this.passageNamed(name);
			
			return p ? p.attr("pid") : "";
		}
	};

	Utils.log("Loaded the story (" + $(Selectors.passageData).length + " passages)");
	
	// Story is finally frozen by Harlowe.js, when startPassage is finally set.
	return Object.seal(Story);
});
