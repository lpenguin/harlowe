define(['jquery', 'macros', 'utils', 'wordarray'], function ($, Macros, Utils, WordArray) {
	"use strict";
	/**
		Script
		@class Script
	*/
	
	var Script = {

		/**
			Creates a new script execution environment, in which certain key variables like "top"
			and "it" are bound to certain values.
			@method environ
			@param {jQuery} top The DOM context for WordArray.create
			@return {Object} An environ object with eval methods.
		*/
		environ: function (top) {
		
			/*
				Wrappers for WordArray
				
			*/
			/* jshint unused:false */
			var Text = function (a) {
					return WordArray.create('"' + a + '"', top);
				},
				Hook = function (a) {
					return WordArray.create('?' + a, top);
				};
			
			return {
				eval: function (/* variadic */) {
					// This specifically has to be a "direct eval()" - calling eval() "indirectly"
					// makes it run in global scope.
					try {
						return eval(
							[].join.call(arguments, '')
						);
					} catch(e) {
						Utils.impossible("Script.environ.eval",
							"Javascript error:\n\t" + [].join.call(arguments, '')
							+ "\n" + e.message);
					}
				}
			};
		}
	};
	/* jshint unused:true */
	Utils.log("Script module ready!");
	return Object.freeze(Script);
});
