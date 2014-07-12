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

			if (enchantment.scope && enchantment.scope.hooks
					&& enchantment.scope.hooks.is(triggerer)) {
				enchantment.fn(triggerer);
			}
		});
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
			@param {String|Array} name  A String, or an Array holding multiple strings.
			@param {Object|Function} desc  A macro definition object, or just a function.
			@return this
			
			Definition objects have this structure:
				type: String (either "sensor", "changer", or, and in absentia, "value")
				live: Boolean (false in absentia)
				fn: the function.
				
		*/
		add: function (name, desc) {
			var fn;
			/*
				If a raw function was passed, assume the default definition for
				this macro.
			*/
			if (typeof desc === "function") {
				desc = {
					live: false,
					type: "value",
					fn: desc
				};
			}
			
			/*
				Operation.runMacro() in TwineScript passes its arguments as a thunk.
				See that page for the formal explanation.
				
				Now, the macro passed to Macros.add() is expected to be a "plain"
				Javascript function that has ordinary parameters. So,
				some modification is needed to make this function handle the
				arguments thunk automatically.
				
				Non-live macros don't actually need the thunk - they take it,
				unwrap it, and discard it. Live macros, however, need to retain
				it and re-evaluate it over and over.
			*/
			if(!desc.live) {
				/*
					Wrap the function, fn, in an outer function which immediately 
					opens argsThunk and then calls fn with those arguments.
					
					Hence, this converts fn into an outwardly identical function
					that accepts an argsThunk and applies it to its actual parameters.
				*/
				desc.fn = (function(fn) {
					return function macroResult(argsThunk) {
						var args = argsThunk(),
							// Do the error check now.
							error = Utils.containsError(args);

						if (error) {
							return error;
						}
						return fn.apply(0, args);
					};
				}(desc.fn));
			}
			else {
				/*
					Wrap the function, fn, in an outer function, O, which
					takes argsThunk and returns another thunk that calls the args
					on fn.
					
					Hence, this converts fn into a function that joins the argsThunk
					with the macro's call, creating a combined thunk.
				*/
				desc.fn = (function(fn) {
					return function deferredMacroResult(argsThunk) {
						/*
							While macroResultThunk's interior is similar to macroResult,
							note that the binding of argsThunk is different,
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
						t.thunk = true;
						return t;
					};
				}(desc.fn));
			}
			desc.fn.type = desc.type;
			
			// Add the fn to the macroRegistry, plus aliases (if name is an array of aliases)
			if (Array.isArray(name)) {
				name.forEach(function (n) {
					Utils.lockProperty(macroRegistry, n, desc.fn);
				});
			} else {
				Utils.lockProperty(macroRegistry, name + "", desc.fn);
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
		},
		
		/**
			Register an enchantment without creating multiple event handlers for the same event.
			Enchantments are triggered by DOM events assigned with jQuery's .on().
			The enchantment registry keeps track of which events have which handlers.
			
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
		}
	};
	
	Utils.log("Macros module ready!");
	return Object.freeze(Macros);
});
