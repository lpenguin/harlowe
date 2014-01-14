define(['jquery', 'utils'], function($, Utils) {
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
		passageNamed: function (name) {
			var passage = $(Utils.selectors.storyData + " > " + Utils.selectors.passageData +'[data-name="' + name + '"]');
			
			return !!passage.length && passage;
		},

		// Get a passage, given an ID
		passageWithID: function (id) {
			var passage = $(Utils.selectors.storyData + " > " + Utils.selectors.passageData +'[data-id="' + id + '"]');

			return !!passage.length && passage;
		},

		// Get the name of a passage, given its ID
		getPassageName: function (id) {
			var p = this.passageWithID(id);
			
			return p ? p.attr("data-name") : "";
		},

		// Get the ID of a passage, given its name
		getPassageID: function (name) {
			var p = this.passageNamed(name);
			
			return p ? p.attr("data-id") : ""
		}
	};

	Utils.log("Story module ready! (" + $(Utils.selectors.passageData).length + " passages)");
	
	// Story is finally frozen by Harlowe.js
	return Object.seal(Story);
});
