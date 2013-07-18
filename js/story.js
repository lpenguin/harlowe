define(['jquery', 'utils'], function($, utils)
{
	"use strict";

	var story = {
		// Set of options, loaded at startup.
		options: {},
		
		// Set of JS-based text effects.
		effects: {},
		
		// Get a passage, given a name
		passageNamed: function (name)
		{
			var passage = $('div[data-role="twinestory"] > div[data-name="' + name + '"]');
			return (passage.length == 0 ? null : passage);
		},
		
		// Get a passage, given an ID
		passageWithID: function (id)
		{
			var passage = $('div[data-role="twinestory"] > div[data-id="' + id + '"]');
			return (passage.length == 0 ? null : passage);
		},
			
		// Get the name of a passage, given its ID
		getPassageName: function (id)
		{
			var p = this.passageWithID(id);
			if (p)
			{
				return p.attr("data-name");
			}
			return "";
		},
		
		// Get the ID of a passage, given its name
		getPassageID: function (name)
		{
			var p = this.passageNamed(name);
			if (p)
			{
				return p.attr("data-id");
			}
			return "";
		}
	};
	return utils.lockProperties(story);
});