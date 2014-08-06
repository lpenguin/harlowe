define(['jquery', 'story', 'utils'],
function($, Story, Utils) {
	"use strict";
	/**
		This contains a registry of macro definitions, and methods to add to that registry.
		
		@class Macros
		@static
	*/
	
	var Macros,
		// Private collection of registered macros.
		macroRegistry = {};

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
			return macroRegistry.hasOwnProperty(e);
		},
		
		/**
			Retrieve a registered macro definition by name.
			
			@method get
			@param {String} Name of the macro definition to get
			@return Macro definition object, or false
		*/
		get: function (e) {
			return (macroRegistry.hasOwnProperty(e) && macroRegistry[e]);
		},

		/**
			Register a new macro.
			If an array of names is given, an identical macro is created under each name.
			
			@method add
			@param {String|Array} name  A String, or an Array holding multiple strings.
			@param {String} type The type (either "sensor", "changer", or, and in absentia, "value")
			@param {Function} fn  The function.
			@return this
		*/
		add: function (name, type, fn) {
			type = type || "value";
			fn.type = type;
			
			// Add the fn to the macroRegistry, plus aliases (if name is an array of aliases)
			if (Array.isArray(name)) {
				name.forEach(function (n) {
					Utils.lockProperty(macroRegistry, n, fn);
				});
			} else {
				Utils.lockProperty(macroRegistry, name + "", fn);
			}
			return this;
		},
		
		/**
			Given the name of a registered macro definition,
			retrieves its type.
			
			@method getType
			@param {String} Name of the macro definition to get
			@return {String} The result.
		*/
		getType: function(name) {
			var m = Macros.get(name);
			return (m ? m.type : "");
		}
	};
	
	Utils.log("Macros module ready!");
	return Object.freeze(Macros);
});
