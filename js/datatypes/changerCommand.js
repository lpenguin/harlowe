define([], function() {
	"use strict";
	/*
		A ChangerCommand is a function that is used to mutate a ChangerDescriptor object,
		that itself is used to alter a Section's rendering.
		
		This decorator function accepts a function (which defines the ChangerCommand's internal
		implementation)	and the name of the macro that created it, and augments the function
		with the necessary TwineScript related methods.
		
		Since it basically transforms an existing function without modifying its prototype,
		it isn't really a "class", and thus isn't a prototype object with a .create() method.
	*/
	return function ChangerCommand(fn, name) {
		fn.changer = true;
		fn.macroName = name;
		fn.TwineScript_ObjectName = "a ("  +name + ":) command";
		fn.toString = function() {
			return "[A '" + name + "' command]";
		};
		return fn;
	};
});
