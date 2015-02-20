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
			Note that due to the Object.freeze() call, this is non-writable and
			non-shadowable on the prototype chain: no other variables called $Styles
			can be created.
		*/
		Styles: new Map([
			["Passage",  null],
		]),
	});
});
