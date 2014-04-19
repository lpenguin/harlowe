define(['jquery', 'utils', 'selectors'], function($, Utils, Selectors) {
	"use strict";
	/*
		Story
		Module governing data concerning the stort and its structure.
	*/

	/*
		Story options:
			opaquelinks : prevent players 'link sniffing' by eliminating the HREF of internal passage links.
			debug : debug mode is ready. Click the bug icon to reveal all macro spans.
			undo : enable the undo button.
			redo : enable the redo button.
	*/

	var Story = {

		// Set of options, loaded at startup.
		options: {},

		// Set of JS-based text effects.
		effects: {},
		
		// ID of the start passage.
		startPassage: "",

		// Get a passage, given a name
		// This should only be called by story code handling objects - internally, passages are referenced by ID.
		passageNamed: function (name) {
			var passage = $(Selectors.storyData + " > " + Selectors.passageData +'[name="' + name + '"]');
			
			return !!passage.length && passage;
		},

		// Get a passage, given an ID
		passageWithID: function (id) {
			var passage = $(Selectors.storyData + " > " + Selectors.passageData +'[pid="' + id + '"]');

			return !!passage.length && passage;
		},

		// Get the name of a passage, given its ID
		getPassageName: function (id) {
			var p = this.passageWithID(id);
			
			return p ? p.attr("name") : "";
		},

		// Get the ID of a passage, given its name
		getPassageID: function (name) {
			var p = this.passageNamed(name);
			
			return p ? p.attr("pid") : ""
		}
	};

	Utils.log("Story module ready! (" + $(Selectors.passageData).length + " passages)");
	
	// Story is finally frozen by Harlowe.js
	return Object.seal(Story);
});
