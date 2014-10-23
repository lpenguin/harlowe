define([], function() {
	"use strict";
	/*
		This simply returns a special Error object
		whose name is "TwineWarning", which is used to
		differentiate macro errors from debug mode warnings.
	*/
	return function TwineWarning(message) {
		var error = new Error(message);
		error.name = "TwineWarning";
		return error;
	};
});
