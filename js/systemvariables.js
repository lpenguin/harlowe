define([], function() {
	"use strict";
	/**
		SystemVariables
		The root object for the state variables.
		
		@class SystemVariables
		@static
	*/
	
	return Object.freeze({
		/*
			Note that due to the above Object.freeze() call, this is non-writable and
			non-shadowable on the prototype chain: no other variables called $Styles
			can be created.
		*/
		Styles: Object.assign(new Map([
			["Passage",  null],
		]),{
			/*
				This adds a "sealed" expando property to the map,
				meaning that VarRef objectOrMapSet cannot add properties
				to it.
			*/
			sealed: true,
			TwineScript_ObjectName: "the $Styles datamap",
		}),
		TwineScript_ObjectName: "this story's variables",
	});
});
