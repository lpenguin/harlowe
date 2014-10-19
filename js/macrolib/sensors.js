define(['macros'], function(Macros) {
	"use strict";
	/*
		Built-in sensor macros.
		This module modifies the Macros module only, and exports nothing.
	*/

	/*
		Standard sensor macros.
	*/
	Macros.addSensor
		/*
			(when:)
			Triggers once when the expression is true.
		*/
		("when", function(_, expr) {
			return {
				value: expr,
				done: expr
			};
		})
		
		/*
			(until:)
			Triggers once when the expression is false.
		*/
		("until", function(_, expr) {
			return {
				value: !expr,
				done: expr
			};
		})
		
		/*
			(whenever:)
			Triggers any time the expression changes from false to true.
		*/
		("whenever", function(_, expr) {
			return {
				value: expr,
				done: false
			};
		});
});
