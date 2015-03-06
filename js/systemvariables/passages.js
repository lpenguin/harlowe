define(['jquery', 'utils', 'utils/selectors'], function($, Utils, Selectors) {
	"use strict";
	/**
		$Passages
		A userland registry of Passage objects.
		
		@class $Passages
		@static
	*/
	
	/*
		Passage objects are simple Maps.
	*/
	function passage(elem) {
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
				
				Sadly, it's not yet possible to rebind this within $Passages
				just by changing this attribute.
			*/
			["name", elem.attr('name')],
		]),{
			TwineScript_TypeName: "passage datamap",
			TwineScript_ObjectName: "a passage datamap",
			/*
				This does not have TwineScript_Sealed because I want
				authors to be able to dynamically modify passages at runtime.
			*/
		});
	}
	
	var Passages = Object.assign(new Map(), {
		TwineScript_ObjectName: "the $Passages datamap",
	});
	
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
