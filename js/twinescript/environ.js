define(['macros', 'state', 'utils', 'datatypes/colour', 'twinescript/operations'], function(Macros, State, Utils, Colour, OperationsProto) {
	"use strict";
	/**
		Creates a new script execution environment. This accepts and
		decorates a Section object (see Engine.showPassage) with the
		eval method.
		
		@module Environ
		@param {Section} section
		@return {Object} An environ object with eval methods.
	*/
	return function environ(section) {
		if (typeof section !== "object" || !section) {
			Utils.impossible("TwineScript.environ", "no Section argument was given!");
		}
		
		var Operations = OperationsProto.create(section);
		
		/*
			This suppresses the JSHint unused warning.
			In reality, this is used by the eval()'d code.
		*/
		Operations, Macros, State;
		
		return Object.assign(section, {
			eval: function(/* variadic */) {
				try {
					/*
						This specifically has to be a "direct eval()" - calling eval() "indirectly"
						makes it run in global scope.
					*/
					return eval(
						Array.from(arguments).join('')
					);
				} catch(e) {
					/*
						This returns the Javascript error object verbatim
						to the author, as a last-ditch and probably
						unhelpful error message.
						
						Javascript error messages are presaged with a coffee cup,
						to signify that the browser produced them and not Twine.
					*/
					Utils.log(e);
					e.message = "\u2615 " + e.message;
					return e;
				}
			}
		});
	};
});
