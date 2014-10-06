define(['jquery', 'story', 'utils', 'changercommand'],
function($, Story, Utils, ChangerCommand) {
	"use strict";
	/**
		This contains a registry of macro definitions, and methods to add to that registry.
		
		@class Macros
		@static
	*/
	
	var Macros,
		// Private collection of registered macros.
		macroRegistry = {},
		// Private collection of ChangerCommand definitions.
		changerCommandRegistry = {};
		
	/*
		Operation.runMacro() in TwineScript passes its arguments as a thunk.
		See that page for the formal explanation. These two functions, eager and deferred,
		convert regular Javascript functions to accept a such a thunk as its sole argument.
		
		Non-live macros ("eager" macros) don't actually need the thunk - they take it,
		unwrap it, and discard it. Live macros, however, need to retain
		it and re-evaluate it over and over.
		
		These should currently (August 2014) only be called by
		Macros.addChanger() and Macros.addValue().
	*/
	function eager(fn) {
		return function macroResult(argsThunk) {
			var args = argsThunk(),
				// Do the error check now.
				error = Utils.containsError(args);

			if (error) {
				return error;
			}
			return fn.apply(0, args);
		};
	}
	
	/*
		Conversely, this one wraps the function, fn, in an outer function, O,
		which takes argsThunk and returns another thunk that calls the args
		on fn.
		
		Hence, this converts fn into a function that joins the argsThunk
		with the macro's call, creating a combined thunk.
		
		Again, this should currently (August 2014) only be called by addSensor.
	*/
	function deferred(fn) {
		return function deferredMacroResult(argsThunk) {
			/*
				While macroResultThunk's interior is similar to macroResult,
				returned up above in eagerFunction(),
				note that the scope binding of argsThunk is different,
				and thus it can't really be abstracted out.
			*/
			var t = function macroResultThunk() {
				var args = argsThunk(),
					// Do the error check now.
					error = Utils.containsError(args);
				
				if (error) {
					return error;
				}
				return fn.apply(0, args);
			};
			/*
				The combined thunk should have the same expando properties
				("changer", "sensor", etc.) as the initial function.
			*/
			Object.assign(t, fn);
			return t;
		};
	}
	
	/*
		The object containing all the macros available to a story.
	*/
	Macros = {
		/**
			Checks if a given macro name is registered.
			@method has
			@param {String} Name of the macro definition to check for existence
			@return {Boolean} Whether the name is registered.
		*/
		has: function (e) {
			e = Utils.insensitiveName(e);
			return macroRegistry.hasOwnProperty(e);
		},
		
		/**
			Retrieve a registered macro definition by name.
			
			@method get
			@param {String} Name of the macro definition to get
			@return Macro definition object, or false
		*/
		get: function (e) {
			e = Utils.insensitiveName(e);
			return (macroRegistry.hasOwnProperty(e) && macroRegistry[e]);
		},
		
		/**
			The bare-metal macro registration function.
			If an array of names is given, an identical macro is created under each name.
			
			@method add
			@param {String|Array} name  A String, or an Array holding multiple strings.
			@param {String} type The type (either "sensor", "changer", or, and in absentia, "value")
			@param {Function} fn  The function.
		*/
		add: function (name, type, fn) {
			type = type || "value";
			fn.type = type;
			
			// Add the fn to the macroRegistry, plus aliases (if name is an array of aliases)
			if (Array.isArray(name)) {
				name.forEach(function (n) {
					Utils.lockProperty(macroRegistry, Utils.insensitiveName(n), fn);
				});
			} else {
				Utils.lockProperty(macroRegistry, Utils.insensitiveName(name), fn);
			}
		},
		
		/**
			A high-level wrapper for Macros.add() that creates a Value Macro from two
			entities: a macro implementation function, and a ChangerCommand function.
			
			The passed-in function should return a changer.
			
			@method addValue
			@param {String} name
			@param {Function} fn
		*/
		addValue: function addValue(name, fn) {
			Macros.add(name,
				"value",
				eager(fn)
			);
			// Return the function to enable "bubble chaining".
			return addValue;
		},
	
		/**
			A high-level wrapper for Macros.add() that takes a plain function, creates a
			thunk-accepting version of it, and registers it as a live Sensor Macro.
			
			Sensors return an object signifying whether to display the
			attached hook, and whether to continue sensing.
			
			The returned object has:
				{Boolean} value Whether to display or not
				{Boolean} done Whether to stop sensing.
			
			@method addSensor
			@param {String} name
			@param {Function} fn
		*/
		addSensor: function addSensor(name, fn) {
			fn.sensor = true;
			fn.macroName = name;
			fn.toString = function() {
				return "[A '" + name + "' sensor]";
			};
			Macros.add(name,
				"sensor",
				deferred(fn)
			);
			// Return the function to enable "bubble chaining".
			return addSensor;
		},
	
		/**
			Takes a function, and registers it as a live Changer macro.
			
			Changers return a transformation function (a ChangerCommand) that is used to mutate
			a ChangerDescriptor object, that itself is used to alter a Section's rendering.
			
			The second argument, ChangerCommandFn, is the "base" for the ChangerCommands returned
			by the macro. The ChangerCommands are partial-applied versions of it, pre-filled
			with author-supplied parameters and given TwineScript-related expando properties.
			
			For instance, for (font: "Skia"), the changerCommandFn is partially applied with "Skia"
			as an argument, augmented with some other values, and returned as the ChangerCommand
			result.
			
			A ChangerDescriptor is a plain object with the following values:
			
			{String} transition      Which transition to use.
			{Number} transitionTime  The duration of the transition, in ms. CURRENTLY UNUSED.
			{String} code            Transformations made on the hook's code before it is run.
			{jQuery} target          Where to render the code, if not the hookElement.
			{String} append          Which jQuery method to append the code to the dest with.
			
			@method addChanger
			@param {String} name
			@param {Function} fn
			@param {Function} changerCommand
		*/
		addChanger: function addChanger(name, fn, changerCommandFn) {
			Utils.assert(changerCommandFn);
			
			Macros.add(name,
				"changer",
				eager(fn)
			);
			// I'll explain later. It involves registering the changerCommand implementation.
			changerCommandRegistry[Array.isArray(name) ? name[0] : name] = changerCommandFn;
			
			// Return the function to enable "bubble chaining".
			return addChanger;
		},
		
		/**
			This is basically a wrapper for the ChangerCommand decorator function, but which
			accesses the changerCommandRegistry.
			
			Maybe the changerCommandRegistry should be in the ChangerCommand module.
			
			@method ChangerCommand
		*/
		ChangerCommand: function(name, params) {
			return ChangerCommand(changerCommandRegistry[name], name, params);
		},
	};
	
	Utils.log("Macros module ready!");
	return Object.freeze(Macros);
});
