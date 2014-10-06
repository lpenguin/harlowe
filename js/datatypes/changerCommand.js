define([], function() {
	"use strict";
	/*
		A ChangerCommand is a function that is used to mutate a ChangerDescriptor object,
		that itself is used to alter a Section's rendering.
		
		This decorator function accepts a function (which defines the ChangerCommand's internal
		implementation), the name of the macro that created it, and some
		author-supplied configuration parameters, and creates
		a partial function augmented with the necessary TwineScript related methods.
		
		For instance, for (transition: "dissolve"), the name would be 
		"transition" and params would be ["dissolve"].
		
		Since it basically transforms an existing function without modifying its prototype,
		it isn't really a "class", and thus isn't a prototype object with a .create() method.
	*/
	return function ChangerCommand(impl, name, params) {
		/*
			This creates a partially-applied version of the function
			that pre-fills all but the first argument (the ChangerDescriptor).
		*/
		var fn = function(d) {
			return impl.apply(0, [d].concat(params));
		};
		fn.changer = true;
		fn.macroName = name;
		fn.params = params;
		fn.TwineScript_ObjectName = "a ("  +name + ":) command";
		fn.toString = function() {
			return "[A '" + name + "' command]";
		};
		return fn;
	};
});
