define(['jquery', 'utils', 'utils/selectors'], function($, Utils, Selectors) {
	"use strict";
	/**
		$Passages
		A userland registry of Passage objects.
		
		@class $Design
		@static
	*/
	
	/*
		Passage objects are simple Maps.
	*/
	function passage(elem) {
		var name = elem.attr('name');
		return Object.assign(new Map([
			/*
				Passage objects have the following properties:
				code: the raw TwineMarkup code of the passage.
			*/
			["code", Utils.unescape(elem.html())],
			/*
				tags: an array of its tags, as strings.
			*/
			["tags", (elem.attr('tags') || "").split(/\s/)],
			/*
				name: its name, which can be altered to change how
				passage links can refer to this (!!!).
			*/
			["name", name],
		]),{
			TwineScript_TypeName: "passage datamap",
			TwineScript_ObjectName: "a passage datamap",
		});
	}
	
	var Passages = new Map();
	
	/*
		Unfortunately, the DOM isn't visible until the page is loaded, so we can't
		read every <tw-passagedata> from the <tw-storydata> HTML and store them in Passages until then.
	*/
	$(document).ready(function() {
		Array.from($(Selectors.storyData + " > " + Selectors.passageData)).forEach(function(e) {
			e = $(e);
			Passages.set(e.attr('name'), passage(e));
		});
	});
	return Passages;
});
