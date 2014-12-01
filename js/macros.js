define(['jquery', 'story', 'utils', 'twinescript/operations'],
function($, Story, Utils, Operations) {
	"use strict";
	/**
		This contains a registry of macro definitions, and methods to add to that registry.
		
		@class Macros
		@static
	*/
	
	var Macros,
		// Private collection of registered macros.
		macroRegistry = {},
		// Private collection of command definitions, which are created by command macros.
		commandRegistry = {};
		
	/*
		Operations.runMacro() passes its arguments as a thunk.
		See that page for the formal explanation. These two functions, eager and deferred,
		convert regular Javascript functions to accept a such a thunk as its sole argument.
		
		Non-live macros ("eager" macros) don't actually need the thunk - they take it,
		unwrap it, and discard it. Live macros, however, need to retain
		it and re-evaluate it over and over.
		
		These should currently (August 2014) only be called by
		Macros.addChanger() and Macros.addValue().
	*/
	function eager(fn) {
		return function eagerMacroResult(argsThunk) {
			var args = argsThunk();
			
			// Spreaders are spread out now.
			args = args.reduce(function(newArgs, el) {
				if (el && el.spreader === true) {
					/*
						Currently, the full gamut of spreadable
						JS objects isn't available - only arrays and strings.
					*/
					if (Array.isArray(el.value) || typeof el.value === "string") {
						for(var i = 0; i < el.value.length; i++) {
							newArgs.push(el.value[i]);
						}
					}
					else {
						newArgs.push(
							new TypeError(
								"I can't spread out "
								+ Operations.objectName(el.value)
								+ ", which is not a string or array."
							)
						);
					}
				}
				else {
					newArgs.push(el);
				}
				return newArgs;
			}, []);
			
			// Do the error check now.
			var error = Utils.containsError(args);

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
			t.sensor = true;
			t.TwineScript_Print = function() {
				return new TypeError("I can't print a sensor macro.");
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
		This function checks the type of a single argument. It's run
		for every argument passed into a type-signed macro.
		
		@param {Anything}     arg  The plain JS argument value to check.
		@param {Array|Object} type A type description to compare the argument with.
		@return {Boolean} True if the argument passes the check, false otherwise.
	*/
	function singleTypeCheck(arg, type) {
		/*
			First, check if it's a None type.
		*/
		if (type === null) {
			return arg === undefined;
		}
		/*
			Now, check if the signature is an Optional or Either.
		*/
		if (type.innerType) {
			/*
				Optional signatures can exit early if the arg is absent.
			*/
			if (type.pattern === "optional" || type.pattern === "zero or more") {
				if (arg === undefined) {
					return true;
				}
				type = type.innerType;
			}
			/*
				Either signatures must check every available type.
			*/
			else if (type.pattern === "either") {
				/*
					The arg passes the test if it matches some of the types.
				*/
				return type.innerType.some(function(type) {
					return singleTypeCheck(arg, type);
				});
			}
		}
		// If Type but no Arg, then return an error.	
		if(type !== undefined && arg === undefined) {
			return false;
		}
				
		// The Any type permits any argument, as long as it's present.
		if (type === Macros.TypeSignature.Any && arg !== undefined) {
			return true;
		}
		/*
			The built-in types. Let's not get tricky here.
		*/
		if (type === String) {
			return typeof arg === "string";
		}
		if (type === Boolean) {
			return typeof arg === "boolean";
		}
		if (type === Number) {
			return typeof arg === "number";
		}
		if (type === Array) {
			return Array.isArray(arg);
		}
		/*
			For TwineScript-specific types, this check should mostly suffice.
			TODO: I really need to replace those duck-typing properties.
		*/
		return Object.isPrototypeOf.call(type,arg);
	}
	
	/*
		This converts a passed macro function into one that performs type-checking
		on its inputs before running. It provides macro authors with another layer of
		error feedback.
		
		@param {String|Array}      name            The macro's name(s).
		@param {Function}          fn              A macro function that does NOT receive a thunk.
		@param {Array|Object|null} typeSignature   An array of Twine macro parameter type data.
	*/
	function typeSignatureCheck(name, fn, typeSignature) {
		/*
			Return early if no signature was present for this macro.
		*/
		if (!typeSignature) {
			return fn;
		}
		/*
			The typeSignature *should* be an Array, but if it's just one item,
			we can normalise it to Array form.
		*/
		typeSignature = [].concat(typeSignature);
		
		/*
			The name is used solely for error message generation. It can be a String or
			an Array of Strings. If it's the latter, and there's more than one name,
			we'll (often incorrectly, but still informatively) use the first name,
			as we have no other information about which macro name was used.
			It's an uncomfortable state of affairs, I know.
		*/
		name = "(" + (Array.isArray(name) && name.length > 1 ? name[0] : name) + ":)";
		
		// That being done, we now have the wrapping function.
		return function typeCheckedMacro() {
			var args = Array.from(arguments)
				// The first argument is the Section, not a user-provided argument.
				// We discard it thus.
					.slice(1),
				type, arg, ind, end, rest;
			
			for(ind = 0, end = Math.max(args.length, typeSignature.length); ind < end; ind += 1) {
				type = typeSignature[ind];
				arg = args[ind];
				
				/*
					A rare early error check can be made up here: if ind >= typeSignature.length,
					and Rest is not in effect, then too many params were supplied.
				*/
				if (ind >= typeSignature.length && !rest) {
					return new TypeError((args.length - typeSignature.length) +
						" too many values were given to this " + name + " macro.");
				}
				
				/*
					If a Rest type has already come before, then it will fill in for
					the absence of a type now.
				*/
				type || (type = rest);
				/*
					Conversely, if the rest type is being introduced now,
					we now note it down and extract the type parameter...
				*/
				if (type.innerType && (type.pattern === "rest" || type.pattern === "zero or more")) {
					rest = type.innerType;
					/*
						...but, we only extract the type parameter if it's a Rest.
						ZeroOrMore is used in singleTypeCheck as a synonym for Optional,
						and should remain boxed.
					*/
					if (type.pattern === "rest") {
						type = type.innerType;
					}
				}
				// Now do the check.
				if (!singleTypeCheck(arg,type)) {
					/*
						If the check failed, an error message must be supplied.
						We can infer the reason why singleTypeCheck returned just by
						examining arg.
						
						For instance, if the arg is undefined, then the problem is a
						"not enough values" error.
					*/
					
					if (arg === undefined) {
						return new TypeError("The " + name + " macro needs "
							+ Utils.plural((typeSignature.length - ind), "more value") + ".");
					}
					
					/*
						Otherwise, it was the most common case: an invalid data type.
					*/
					return new TypeError(name + "'s " +
						Utils.nth(ind + 1) + " value is " + Operations.objectName(arg) +
						", but should be " +
						Operations.typeName(type) + ".");
				}
			}
			/*
				Type checking has passed - now let the macro run.
			*/
			return fn.apply(0, arguments);
		};
	}
	
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
			A high-level wrapper for Macros.add() that creates a Value Macro from 3
			entities: a macro implementation function, a ChangerCommand function, and
			a parameter type signature array.
			
			The passed-in function should return a changer.
			
			@method addValue
			@param {String} name
			@param {Function} fn
		*/
		addValue: function addValue(name, fn, typeSignature) {
			Macros.add(name,
				"value",
				eager(typeSignatureCheck(name, fn, typeSignature))
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
			@param {Array} typeSignature
		*/
		addSensor: function addSensor(name, fn, typeSignature) {
			fn.sensor = true;
			fn.macroName = name;
			fn.toString = function() {
				return "[A '" + name + "' sensor]";
			};
			Macros.add(name,
				"sensor",
				deferred(typeSignatureCheck(name, fn, typeSignature))
			);
			// Return the function to enable "bubble chaining".
			return addSensor;
		},
	
		/**
			Takes a function, and registers it as a live Changer macro.
			
			Changers return a transformation function (a ChangerCommand) that is used to mutate
			a ChangeDescriptor object, that itself is used to alter a Section's rendering.
			
			The second argument, ChangerCommandFn, is the "base" for the ChangerCommands returned
			by the macro. The ChangerCommands are partial-applied versions of it, pre-filled
			with author-supplied parameters and given TwineScript-related expando properties.
			
			For instance, for (font: "Skia"), the changerCommandFn is partially applied with "Skia"
			as an argument, augmented with some other values, and returned as the ChangerCommand
			result.
			
			A ChangeDescriptor is a plain object with the following values:
			
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
		addChanger: function addChanger(name, fn, changerCommandFn, typeSignature) {
			Utils.assert(changerCommandFn);
			
			Macros.add(name,
				"changer",
				eager(typeSignatureCheck(name, fn, typeSignature))
			);
			// I'll explain later. It involves registering the changerCommand implementation.
			commandRegistry[Array.isArray(name) ? name[0] : name] = changerCommandFn;
			
			// Return the function to enable "bubble chaining".
			return addChanger;
		},
		
		/**
			This simple getter should only be called by changerCommand, in its run() method, which
			allows the registered changer function to finally be invoked.
			
			TODO: This makes me wonder if this changer registering business shouldn't be in
			the changerCommand module instead.
			
			@method getChangerFn
			@param {String} name
			@return {Function} the registered changer function.
		*/
		getChangerFn: function getChanger(name) {
			return commandRegistry[name];
		},
		
		/*
			These helper functions/constants are used for defining semantic type signatures for
			standard library macros.
		*/
		TypeSignature: {
			
			optional: function(type) {
				return {pattern: "optional",         innerType: type };
			},
			
			zeroOrMore: function(type) {
				return {pattern: "zero or more",     innerType: type };
			},
			
			either: function(/*variadic*/) {
				return {pattern: "either",           innerType: Array.from(arguments)};
			},
			
			rest: function(type) {
				return {pattern: "rest",             innerType: type };
			},
			
			Any: {
				TwineScript_TypeName: "anything",
			}, // In ES6, this would be a Symbol.
			
		},
		
		/**
			Runs a macro.
			
			In TwineScript.compile(), the myriad arguments given to a macro invocation are
			converted to 2 parameters to runMacro:
			
			@param {String} name     The macro's name.
			@param {Function} thunk  A thunk enclosing the expressions
			@return The result of the macro function.
		*/
		run: function(name, thunk) {
			var fn;
			// First and least, the error rejection check.
			if (Utils.containsError(name)) {
				return name;
			}
			/*
				Check if the macro exists as a built-in.
			*/
			if (!Macros.has(name)) {
				/*
					If not, then try and find an author-defined passage to run.
					Unlike macros, this uses the exact name (no insensitivity).
					That's a bit of a discrepancy, I know...
				*/
				if (!Story.passageNamed(name)) {
					return new ReferenceError(
						"I can't run the macro '"
						+ name
						+ "' because it doesn't exist."
					);
				}
				// TODO: Implement passage macros.
				return new Error("Passage macros are not implemented yet.");
			}
			else fn = Macros.get(name);
			
			return fn(thunk);
		},
		
	};
	
	return Object.freeze(Macros);
});
