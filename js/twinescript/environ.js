define([
	'macros',
	'state',
	'utils',
	'datatypes/colour',
	'datatypes/lambda',
	'internaltypes/varref',
	'internaltypes/twineerror',
	'twinescript/operations'
],
/*
	To keep the eval scope very clean in compiled code, no destructuring is done here.
*/
(Macros, State, Utils, Colour, Lambda, VarRef, TwineError, OperationsProto) => {
	"use strict";
	/**
		Creates a new script execution environment. This accepts and
		decorates a Section object (see Engine.showPassage) with the
		eval method.
		
		@module Environ
		@param {Section} section
		@return {Object} An environ object with eval methods.
	*/
	return (section) => {
		if (typeof section !== "object" || !section) {
			Utils.impossible("TwineScript.environ", "no Section argument was given!");
		}
		
		/*
			Operations instances store the intermediary values of the Identifiers,
			such as It and Time. Otherwise, they are indistinguishable from Operations.
		*/
		const Operations = OperationsProto.create(section);
		
		/*
			This suppresses the JSHint unused warning.
			In reality, this is used by the eval()'d code.
		*/
		Operations;
		
		section.eval = function(...args) {
			try {
				/*
					This specifically has to be a "direct eval()" - calling eval() "indirectly"
					makes it run in global scope.
				*/
				return eval(
					args.join('')
				);
			} catch(e) {
				/*
					This returns the Javascript error object verbatim
					to the author, as a last-ditch and probably
					unhelpful error message.
				*/
				Utils.log(e);
				Utils.log(args.join(''));
				return e;
			}
		};
		return section;
	};
});
