define(['jquery', 'story', 'utils', 'selectors'],
function($, Story, Utils, Selectors) {
	"use strict";
	/**
		This contains a registry of macro definitions, and methods to add to that registry.
		
		The registration methods also come equipped with default behaviour for hook macro functions, and register
		any enchantment events that the macro definition defines.
		
		@class Macros
		@static
	*/
	
	var Macros,
		// Private collection of registered macros.
		macroRegistry = {},
		// Tracker of registered events and their class lists
		enchantmentEventRegistry = {};

	/**
		Called when an enchantment's event is triggered. 
		This is called as a jQuery .on handler.
		
		Sub-function of Macros.add()
		
		@event enchantmentEventFn
		@private
	*/
	function enchantmentEventFn() {
		var triggerer = $(this),
			story = Utils.storyElement;
		
		// Trigger the hook macros that refer to this enchantment.
		Utils.$(Selectors.enchanter, story).each(function () {
			var el = $(this),
				enchantment = el.data("enchantment");

			if (enchantment.scope && enchantment.scope.hooks && enchantment.scope.hooks.is(triggerer)) {
				enchantment.fn(triggerer);
			}
		});
	}

	/**
		Report an error when a user-loaded macro fails. Sub-function of Macros.add() and Macros.supplement().
		
		@method loaderError
		@private
		@param {String} text The text error to display.
	*/
	function loaderError(text) {
		// TODO: Instead of a basic alert, display a notification banner somewhere.
		window.alert(text);
		return true;
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
			@param {String|Array} name A String, or an Array holding multiple strings.
			@param {Object} desc A macro definition object.
			@return this
		*/
		add: function (name, fn) {
			if (!Utils.stringOrArray(name)) {
				loaderError("Argument 1 of Macros.add isn't an array or a string.");
				return this;
			}
			if (!(fn && typeof fn === "function")) {
				loaderError("Argument 2 of Macros.add (\"" + name + "\") isn't a function.");
				return this;
			}
			// Add desc to the macroRegistry, plus aliases (if name is an array of aliases)
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
			Register an enchantment without creating multiple event handlers for the same event.
			Enchantments are triggered by DOM events assigned with jQuery's .on().
			The enchantment registry keeps track of which events have which handlers.
			
			Sub-function of Macros.add()
			
			@method registerEnchantmentEvent
			@param {String} name Name of the enchantment. This is used for jQuery event namespacing.
			@param {String} newList Comma-separated list of DOM selectors (hence, a
			compound selector) for this macro to apply to.
		*/
		registerEnchantmentEvent: function (name, newList) {
			/*
				Obtain and update the list of jQuery selectors
				that select the elements that can trigger this event.
			*/
			var list = enchantmentEventRegistry[name] || "",
				eventName = name + ".macro";

			// Append the newList to the list, if it isn't present already.
			(!~list.indexOf(newList) && (list += (list && ", ") + newList));

			// Set the event handler
			$(document.documentElement).off(eventName).on(eventName, list, enchantmentEventFn);
			// Add to registry
			enchantmentEventRegistry[name] = list;
		},
		
		/**
			Runs a macro.
			
			@method run
			@param {String} name Name of the macro to run.
			@param args Arguments to pass to the macro.
			@return The result of running the macro's function.
		*/
		run: function(name, args /*variadic*/) {
			var fn;
			
			name = name.toLowerCase();
			if (!Macros.has(name)) {
				return "Unknown macro: " + name;
			}
			fn = Macros.get(name.toLowerCase());
			args = [].slice.call(arguments,1);
			
			return fn.apply(null, args);
		}
	};
	
	Utils.log("Macros module ready!");
	return Object.freeze(Macros);
});
