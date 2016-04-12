define(['jquery', 'utils/naturalsort', 'utils', 'utils/operationutils', 'datatypes/lambda', 'internaltypes/twineerror'],
($, NaturalSort, {insensitiveName, nth, plural, andList, assert, lockProperty}, {objectName, typeName, singleTypeCheck}, Lambda, TwineError) => {
	"use strict";
	/**
		This contains a registry of macro definitions, and methods to add to that registry.
		
		@class Macros
		@static
	*/
	
	let Macros;
	const
		// Private collection of registered macros.
		macroRegistry = {},
		// Private collection of command definitions, which are created by command macros.
		commandRegistry = {};
		
	/*
		This function wraps another function (expected to be a macro implementation
		function) in such a way that its arguments are spread-out, error-checked,
		and then passed to the function.
	*/
	function readArguments(fn) {
		/*
			The arguments are already in array form - no need
			to use Array.from(arguments) here!
		*/
		return (args) => {
			
			// Spreaders are spread out now.
			args = args.reduce((newArgs, el) => {
				if (el && el.spreader === true) {
					/*
						Currently, the full gamut of spreadable
						JS objects isn't available - only arrays, sets and strings.
					*/
					if (Array.isArray(el.value)
							|| typeof el.value === "string") {
						for(let i = 0; i < el.value.length; i++) {
							newArgs.push(el.value[i]);
						}
					}
					else if (el.value instanceof Set) {
						newArgs.push(Array.from(el.value).sort(NaturalSort("en")));
					}
					else {
						newArgs.push(
							TwineError.create("operation",
								"I can't spread out "
								+ objectName(el.value)
								+ ", because it is not a string, dataset or array."
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
			const error = TwineError.containsError(args);

			if (error) {
				return error;
			}
			return fn(...args);
		};
	}
	
	/*
		This converts a passed macro function into one that performs type-checking
		on its inputs before running. It provides macro authors with another layer of
		error feedback.
		
		@param {String|Array}      name            The macro's name(s).
		@param {Function}          fn              A macro function.
		@param {Array|Object|null} typeSignature   An array of Twine macro parameter type data.
	*/
	function typeSignatureCheck(name, fn, typeSignature) {
		/*
			The typeSignature *should* be an Array, but if it's just one item,
			we can normalise it to Array form.
			If the item is null or undefined, then that means it should be a 0-length type signature.
		*/
		typeSignature = [].concat(typeSignature || []);
		
		/*
			The name is used solely for error message generation. It can be a String or
			an Array of Strings. If it's the latter, and there's more than one name,
			we'll (often incorrectly, but still informatively) use the first name,
			as we have no other information about which macro name was used.
			It's an uncomfortable state of affairs, I know.
		*/
		name = "(" + (Array.isArray(name) && name.length > 1 ? name[0] : name) + ":)";
		/*
			This is also used for error message generation: it provides the author with
			a readable sentence about the type signature of the macro.
		*/
		let signatureInfo;
		if (typeSignature.length > 0) {
			signatureInfo = "The " + name + " macro must only be given "
				// Join [A,B,C] into "A, B, and C".
				+ typeSignature.map(typeName).reduce(
					/*
						This somewhat convoluted line only prints:
						* a separating comma if there are multiple items,
						* "and" if this is the final item.
					*/
					(a,e,i,arr) => a + (i === 0 ? "" : i < arr.length-1 ? ", " : ", and ") + e,
					''
				)
				+ (typeSignature.length > 1 ? ", in that order" : ".");
		} else {
			signatureInfo = "The macro must not be given any data - just write " + name + ".";
		}
		
		// That being done, we now have the wrapping function.
		return (section, ...args) => {
			let rest;
			
			for(let ind = 0, end = Math.max(args.length, typeSignature.length); ind < end; ind += 1) {
				let type = typeSignature[ind];
				const arg = args[ind];
				
				/*
					A rare early error check can be made up here: if ind >= typeSignature.length,
					and Rest is not in effect, then too many params were supplied.
				*/
				if (ind >= typeSignature.length && !rest) {
					return TwineError.create(
						"typesignature",
						(args.length - typeSignature.length) +
							" too many values were given to this " + name + " macro.",
						signatureInfo
					);
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
						return TwineError.create(
							"typesignature",
							"The " + name + " macro needs "
								+ plural((typeSignature.length - ind), "more value") + ".",
							signatureInfo
						);
					}
					/*
						Unobservable data types are the only kinds which Any signatures will not
						match. Produce a special error message in this case.
					*/
					if (arg && arg.TwineScript_Unobservable && type === Macros.TypeSignature.Any) {
						return TwineError.create(
							"typesignature",
							name + "'s " + nth(ind + 1) + " value is not valid data for this macro.",
							signatureInfo
						);
					}

					/*
						If the data type is a lambda, produce special error messages.
					*/
					if (arg && Lambda.isPrototypeOf(arg) && type.pattern === "lambda") {
						/*
							Print an error comparing the expected clauses with the actual ones.
						*/
						/*jshint -W083 */
						return TwineError.create('typesignature',
							name + "'s " + nth(ind + 1) + " value (a lambda) should have "
							+ andList(["where","making","via","with"].filter(e => type.clauses.includes(e)).map(e => "a '" + e + "' clause"))
							+ ", not "
							+ andList(["where","making","via","with"].filter(e => e in arg).map(e => "a '" + e + "' clause"))
							+ ".");
					}

					/*
						Otherwise, it was the most common case: an invalid data type.
					*/
					return TwineError.create(
						"typesignature",
						name + "'s " +
							nth(ind + 1) + " value is " + objectName(arg) +
							", but should be " +
							typeName(type) + ".",
						/*
							If this type signature has a custom error message, use that here.
						*/
						type.message || signatureInfo
					);
				}
			}
			/*
				Type checking has passed - now let the macro run.
			*/
			return fn(section, ...args);
		};
	}
	
	/**
		The bare-metal macro registration function.
		If an array of names is given, an identical macro is created under each name.
		
		@method privateAdd
		@private
		@param {String|Array} name  A String, or an Array holding multiple strings.
		@param {String} type The type (either "sensor", "changer", or, and in absentia, "value")
		@param {Function} fn  The function.
	*/
	function privateAdd(name, type, fn) {
		// Add the fn to the macroRegistry, plus aliases (if name is an array of aliases)
		if (Array.isArray(name)) {
			name.forEach((n) => lockProperty(macroRegistry, insensitiveName(n), fn));
		} else {
			lockProperty(macroRegistry, insensitiveName(name), fn);
		}
	}
	
	Macros = {
		/**
			Checks if a given macro name is registered.
			@method has
			@param {String} Name of the macro definition to check for existence
			@return {Boolean} Whether the name is registered.
		*/
		has(e) {
			e = insensitiveName(e);
			return macroRegistry.hasOwnProperty(e);
		},
		
		/**
			Retrieve a registered macro definition by name.
			
			@method get
			@param {String} Name of the macro definition to get
			@return Macro definition object, or false
		*/
		get(e) {
			e = insensitiveName(e);
			return (macroRegistry.hasOwnProperty(e) && macroRegistry[e]);
		},
		
		/**
			A high-level wrapper for add() that creates a Value Macro from 3
			entities: a macro implementation function, a ChangerCommand function, and
			a parameter type signature array.
			
			The passed-in function should return a changer.
			
			@method add
			@param {String} name
			@param {Function} fn
		*/
		add: function add(name, fn, typeSignature) {
			privateAdd(name,
				"value",
				readArguments(typeSignatureCheck(name, fn, typeSignature))
			);
			// Return the function to enable "bubble chaining".
			return add;
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
			
			@method addChanger
			@param {String} name
			@param {Function} fn
			@param {Function} changerCommand
		*/
		addChanger: function addChanger(name, fn, changerCommandFn, typeSignature) {
			assert(changerCommandFn);
			
			privateAdd(name,
				"changer",
				readArguments(typeSignatureCheck(name, fn, typeSignature))
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
		getChangerFn(name) {
			return commandRegistry[name];
		},
		
		/*
			These helper functions/constants are used for defining semantic type signatures for
			standard library macros.
		*/
		TypeSignature: {
			
			optional(type) {
				return {pattern: "optional",         innerType: type };
			},
			
			zeroOrMore(type) {
				return {pattern: "zero or more",     innerType: type };
			},
			
			either(...innerType) {
				return {pattern: "either",           innerType };
			},
			
			rest(type) {
				return {pattern: "rest",             innerType: type };
			},
			
			/*
				This is used exclusively to provide custom error messages for particular
				type constraints.
			*/
			
			wrapped(innerType, message) {
				return {pattern: "wrapped", innerType, message };
			},
			
			/*d:
				Any data
				
				A macro that is said to accept "Any" will accept any kind of data
				without complaint, as long as the data does not contain any errors.
			*/
			Any: {
				TwineScript_TypeName: "anything",
			},
			
		},
		
		/**
			Runs a macro.
			
			In TwineScript.compile(), the myriad arguments given to a macro invocation are
			converted to 2 parameters to runMacro:
			
			@param {String} name     The macro's name.
			@param {Array}  args     An array enclosing the passed arguments.
			@return The result of the macro function.
		*/
		run(name, args) {
			// First and least, the error rejection check.
			if (TwineError.containsError(name)) {
				return name;
			}
			/*
				Check if the macro exists as a built-in.
			*/
			if (!Macros.has(name)) {
				return TwineError.create("macrocall",
					"I can't run the macro '"
					+ name
					+ "' because it doesn't exist."
				);
			}
			return Macros.get(name)(args);
		},
		
	};
	
	return Object.freeze(Macros);
});
