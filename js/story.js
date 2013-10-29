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

		// Get a passage, given a name
		passageNamed: function (name) {
			var passage = $('div[data-role="twinestory"] > div[data-name="' + name + '"]');

			if (!passage.length) {
				throw new RangeError("there's no passage named " + name);
				return;
			}
			return passage;
		},

		// Get a passage, given an ID
		passageWithID: function (id) {
			var passage = $('div[data-role="twinestory"] > div[data-id="' + id + '"]');

			if (!passage.length) {
				throw new RangeError("there's no passage with ID " + id);
				return;
			}
			return passage;
		},

		// Get the name of a passage, given its ID
		getPassageName: function (id) {
			var p = this.passageWithID(id);
			if (p) {
				return p.attr("data-name");
			}
			return "";
		},

		// Get the ID of a passage, given its name
		getPassageID: function (name) {
			var p = this.passageNamed(name);
			if (p) {
				return p.attr("data-id");
			}
			return "";
		}
	};

	// Story is finally frozen by Harlowe.js

	return Object.seal(Story);
});
