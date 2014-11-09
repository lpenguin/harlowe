define(['utils', 'state', 'story', 'datatypes/colour', 'datatypes/assignmentRequest'], function(Utils, State, Story, Colour, AssignmentRequest) {
	"use strict";
	/**
		Operation objects are a table of operations which TwineScript proxies
		for/sugars over JavaScript. These include basic fixes like the elimination
		of implicit type coercion and the addition of certain early errors, but also
		includes support for new TwineScript operators, overloading of old operators,
		and other things.
		
		@class Operations
	*/
	var Operations,
		/*
			The "it" keyword is bound to whatever the last left-hand-side value
			in a comparison operation was. Since its scope is so ephemeral,
			it can just be a shared identifier right here.
		*/
		It = false,
		/*
			Used to determine if a property name is an array index.
			If negative indexing sugar is ever added, this could
			be replaced with a function.
		*/
		numericIndex = /^(?:[1-9]\d*|0)$/;
	
	/*
		First, a quick shortcut to determine whether the
		given value is an object (i.e. whether the "in"
		operator can be used on a given value).
	*/
	function isObject(value) {
		return !!value && (typeof value === "object" || typeof value === "function");
	}
	/*
		Next, a shortcut to determine whether a given value should have
		sequential collection functionality (e.g. Array, String, other stuff).
	*/
	function isSequential(value) {
		return typeof value === "string" || Array.isArray(value);
	}

	/*
		Some TwineScript objects can, in fact, be coerced to string.
		HookRefs, for instance, coerce to the string value of their first
		matching hook.
		
		(Will I pay for this later???)
		
		This returns the resulting string, or false if it couldn't be performed.
		@return {String|Boolean}
	*/
	function coerceToString(fn, left, right) {
		if     (typeof left  === "string" && isObject(right) &&
				"TwineScript_ToString" in right) {
			return fn(left, right.TwineScript_ToString());
		}
		/*
			We can't really replace this case with a second call to
			canCoerceToString, passing (fn, right, left), because fn
			may not be symmetric.
		*/
		if     (typeof right === "string" && isObject(left) &&
				"TwineScript_ToString" in left) {
			return fn(left.TwineScript_ToString(), right);
		}
		return false;
	}
	
	/*
		Most TwineScript objects have an ObjectName method which supplies a name
		string to the error message facilities.
		@return {String}
	*/
	function objectName(obj) {
		return (isObject(obj) && "TwineScript_ObjectName" in obj)
			? obj.TwineScript_ObjectName
			: Array.isArray(obj) ? "an array"
			: (typeof obj === "string" || typeof obj === "number") ? 'the ' + typeof obj + " " + JSON.stringify(obj)
			/*
				For ES6 symbol compatibility, we must use String(obj) here instead of obj + "".
				I don't actually expect symbols to enter the TwineScript userland, but better safe.
			*/
			: String(obj);
	}
	/*
		The TypeName method is also used to supply error messages relating to type signature
		checks. Generally, a TwineScript datatype prototype should be supplied to this function,
		compared to objectName, which typically should receive instances.
		
		Alternatively, for Javascript types, the global constructors String, Number, Boolean
		and Array may be given.
		
		Finally, certain "type descriptor" objects are used by Macros, and take the form
			{ pattern: {String, innerType: {Array|Object|String} }
		and these should be warmly received as well.
		
		@return {String}
	*/
	function typeName(obj) {
		/*
			First, check for the "either" type descriptor.
		*/
		if (obj.innerType) {
			if (obj.pattern === "either") {
				Utils.assert(Array.isArray(obj.innerType));
				
				return obj.innerType.map(typeName).join(" or ");
			}
			else if (obj.pattern === "optional") {
				return "(an optional) " + typeName(obj.innerType);
			}
			return typeName(obj.innerType);
		}
		
		return (
			/*
				Second, if it's a global constructor, simply return its name in lowercase.
			*/
			(obj    === String ||
				obj === Number ||
				obj === Boolean)  ? "a "  + obj.name.toLowerCase()
			:   obj === Array     ? "an " + obj.name.toLowerCase()
			/*
				Otherwise, defer to the TwineScript_TypeName, or TwineScript_ObjectName
			*/
			: (isObject(obj) && "TwineScript_TypeName" in obj) ? obj.TwineScript_TypeName
			: objectName(obj));
	}
	
	/*
		This converts a TwineScript property index into a JavaScript property indexing
		operation.
		
		While doing so, it checks if a property name is valid, and returns
		an error instead if it is not.
		Currently, property names beginning with '__' or 'TwineScript' are not valid.
		@return {String|Error}
	*/
	function compilePropertyIndex(obj, prop) {
		var 
			// A cached error message fragment.
			onlyIcan = "Only I can use data keys beginning with ",
			// Hoisted variable.
			match;
		
		if(prop.startsWith("__")) {
			return new Error(onlyIcan + "'__'.");
		}
		if(prop.startsWith("TwineScript") && prop !== "TwineScript_Assignee") {
			return new Error(onlyIcan + "'TwineScript'.");
		}
		/*
			Sequentials have special sugar property indices:
			
			.length: this falls back to JS's length property for Arrays and Strings.
			.last: antonym of .1st
			.1st, .2nd etc.: 1-indexed synonyms for .0, .1, .2.
			
			As you can see, .n is 0-indexed and falls back to JS,
			and .nth is 1-indexed sugar above it.
		*/
		if (isSequential(obj)) {
			if (prop === "last") {
				prop = obj.length - 1 + "";
			}
			/*
				This should generously allow "1rd" or "2st".
			*/
			if ((match = /(\d+)(?:st|[nr]d|th)/.exec(prop))) {
				prop = match[1];
				// Notice that this guards against NaN (which is not > or < anything).
				if (+prop > 0) {
					prop = prop - 1 + "";
				}
			}

		}
		return prop;
	}
	
	/*
		Having defined those under-the-skin abstract operations, I now move on
		to author-facing operations.
		But first, here are some wrapping functions which will be applied to
		the Operations methods, providing type-checking and such to their arguments.
	*/
	
	/*
		Converts a function to refuse its arguments if one
		of them is not a number.
		@return {Function}
	*/
	function onlyNumbers(fn, operationVerb) {
		operationVerb = operationVerb || "do this to";
		return function(left, right) {
			if (typeof left !== "number" || typeof right !== "number") {
				return new TypeError("I can only " + operationVerb + " numbers, not " +
				objectName(typeof left !== "number" ? left : right) + ".");
			}
			return fn(left, right);
		};
	}
	
	/*
		Converts a function to type-check its two arguments before
		execution, and thus suppress JS type coercion.
		@return {Function}
	*/
	function doNotCoerce(fn) {
		return function(left, right) {
			var error;
			// VarRefs cannot have operations performed on them.
			// TODO: Except &&, perhaps?
			if (left && left.varref) {
				return new TypeError("I can't give an expression a new value.");
			}
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			if ((error = Utils.containsError(left, right))) {
				return error;
			}
			/*
				This checks that left and right are generally different types
				(both different typeof or, if both are object, different Arrayness)
			*/
			if (typeof left !== typeof right
				|| Array.isArray(left) !== Array.isArray(right)) {
				/*
					Attempt to coerce to string using TwineScript specific
					methods, and return an error if it fails.
				*/
				return coerceToString(fn, left, right)
					/*
						TwineScript errors are handled by TwineScript, not JS,
						so don't throw this error, please.
					*/
					|| new TypeError(
						// BUG: This isn't capitalised.
						objectName(left)
						+ " isn't the same type of data as "
						+ objectName(right)
					);
			}
			return fn(left, right);
		};
	}
	
	/*
		Converts a function to set It after it is done.
		@return {Function}
	*/
	function comparisonOp(fn) {
		return function(left, right) {
			It = left;
			return fn(It, right);
		};
	}
	
	/*
		As the base function for Operations.contains,
		this implements the "x contains y" and "y is in x" keywords.
		This is placed outside so that Operation.isIn can call it.
		@return {String}
	*/
	function contains(container,obj) {
		var i, keys;
		if (container) {
			/*
				Basic array or string indexOf check.
			*/
			if (isSequential(container)) {
				return container.indexOf(obj) > -1;
			}
			/*
				For plain object containers, it returns true if
				the obj is a stored value.
			*/
			if (container.constructor === Object) {
				for (i = 0, keys = Object.keys(container); i < keys.length; i+=1) {
					if (container[keys] === obj) {
						return true;
					}
				}
			}
		}
		/*
			Default: since "'r' is in 'r'" is true, so is "false is in false".
		*/
		return Operations.is(container,obj);
	}

	/*
		Now, let's define the operations themselves.
	*/
	Operations = {
		
		/*
			While for the most part Operations is static, instances should
			nonetheless be created...
		*/
		create: function(section) {
			/*
				The only varying state that an Operations instance would have
				compared to the prototype is the "section" object, which
				as it turns out is only used to enable the "time" identifier.
				Hrmmm... #awkward
			*/
			var ret = Object.create(this);
			
			/*
				This contains special runtime identifiers which may change at any time.
			*/
			ret.Identifiers = {

				get it() {
					return It;
				},
				
				/*
					The "time" keyword binds to the number of milliseconds since the passage
					was rendered.
			
					It might be something of a toss-up whether the "time" keyword should
					intuitively refer to the entire passage's lifetime, or just the nearest
					hook's. I believe that the passage is what's called for here.
				*/
				get time() {
					// This is, as far as I know, the only "this" usage in the class.
					return (Date.now() - section.timestamp);
				}
				/*
					TODO: An author-facing error message for setting time()
				*/
			};
			
			return ret;
		},
		
		"+":  doNotCoerce(function(l, r) {
			/*
				I'm not a fan of the fact that + is both concatenator and 
				arithmetic op, but I guess it's close to what people expect.
				Nevertheless, applying the logic that a string is just as much a
				sequential collection as an array, I feel I can overload +
				on arrays to mean immutable array concatenation.
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array.
				*/
				return [].concat(l, r);
			}
			/*
				Function composition is the basis for advanced use of "changer"
				macros - (transition:), (gradient:), etc. Currently, the means
				of performing composition is to add the returned changer
				functions together.
			*/
			else if (typeof l === "function") {
				var ret = function() {
					/*
						In what order should the functions be composed?
						I think right-as-innermost is more intuitive, but
						I'm none too sure...
					*/
					return l(r.apply(0, arguments));
				};
				/*
					It's best to think of the returned function as a 'modified'
					version of l - it has the same expando properties, etc.
					as it, but a different [[call]].
				*/
				Object.assign(ret, l);
				return ret;
			}
			/*
				New colours can be created by addition.
			*/
			else if (l && typeof l === "object" && Object.getPrototypeOf(l) === Colour) {
				return Colour.create({
					/*
						You may notice this is a fairly glib blending
						algorithm. It's the same one from Game Maker,
						though, so I'm hard-pressed to think of a more
						intuitive one.
					*/
					r : Math.min(Math.round((l.r + r.r) * 0.6), 0xFF),
					g : Math.min(Math.round((l.g + r.g) * 0.6), 0xFF),
					b : Math.min(Math.round((l.b + r.b) * 0.6), 0xFF),
				});
			}
			return l + r;
		}),
		"-":  doNotCoerce(function(l, r) {
			/*
				Overloading - to mean "remove all instances from".
				So, "reed" - "e" = "rd", and [1,3,5,3] - 3 = [1,5].
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array. Subtracting 1 element
					from an array requires it be wrapped in an (a:) macro.
				*/
				return l.filter(function(e) { return r.indexOf(e) === -1; });
			}
			else if (typeof l === "string") {
				/*
					This is an easy but cheesy way to remove all instances
					of the right string from the left string.
				*/
				return l.split(r).join('');
			}
			return l - r;
		}),
		"*":  onlyNumbers( doNotCoerce(function(l, r) {
			return l * r;
		}), "multiply"),
		"/":  onlyNumbers( doNotCoerce(function(l, r) {
			return l / r;
		}), "divide"),
		"%":  onlyNumbers( doNotCoerce(function(l, r) {
			return l % r;
		}), "modulus"),
		
		lt:  comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l <  r; }), "do < to")),
		gt:  comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l >  r; }), "do > to")),
		lte: comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l <= r; }), "do <= to")),
		gte: comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l >= r; }), "do >= to")),
		
		is: comparisonOp(Object.is),
		isNot: comparisonOp(function(l,r) {
			return !Operations.is(l,r);
		}),
		contains: comparisonOp(contains),
		isIn: comparisonOp(function(l,r) {
			return contains(r,l);
		}),

		/*
			A wrapper around Javascript's [[get]], which
			returns an error if a property is absent rather than
			returning undefined. (Or, in the case of State.variables,
			uses a default value instead of returning the error.)
			
			@method get
			@return {Error|Anything}
		*/
		get: function(obj, prop, defaultValue) {
			if (obj === null || obj === undefined) {
				return new ReferenceError(
					"I can't get a property named '"
					+ prop
					+ "' from "
					+ typeof obj
					+ "."
				);
			}
			if (Utils.containsError(obj)) {
				return obj;
			}
			/*
				Compile the property index - returning the error if
				one was produced during compilation.
			*/
			prop = compilePropertyIndex(obj, prop);
			if (Utils.containsError(prop)) {
				return prop;
			}
			/*
				An additional error condition exists for get(): if the property
				doesn't exist, don't just return undefined.
				
				I wanted to use hasOwnProperty here, but it didn't work
				with the State.variables object, which, as you know, uses
				differential properties on the prototype chain. Oh well,
				it's probably not that good an idea anyway.
			*/
			if (!(prop in obj)) {
				/*
					If a default value is given (only for State.variables,
					currently) then return that.
				*/
				if (defaultValue !== undefined) {
					return defaultValue;
				}
				/*
					Otherwise, produce an error message.
				*/
				return new ReferenceError("I can't find a '" + prop + "' data key in "
					+ objectName(obj));
			}
			return obj[prop];
		},
		
		/*
			A wrapper around Javascript's delete operation, which
			returns an error if the deletion failed, and also removes holes in
			arrays caused by the deletion.
		*/
		delete: function(obj, prop) {
			/*
				If it's an array, and the prop is an index,
				we should remove the item in-place without creating a hole.
			*/
			if (Array.isArray(obj) && numericIndex.exec(prop)) {
				obj.splice(prop, 1);
				return;
			}
			if (!delete obj[prop]) {
				return new ReferenceError(
					"I couldn't delete '"
					+ prop
					+ "' from "
					+ objectName(obj)
					+ "."
				);
			}
		},
		
		/*
			This takes a plain function that is assumed to be a thunk,
			and attaches some thunk methods and properties to it.
			
			Currently, it just attaches an identifying "thunk" property.
			Thunks should not be observable to TwineScript authors.
		*/
		makeThunk: function(fn) {
			return Object.assign(fn, {
				thunk: true,
			});
		},
		
		/*
			To provide (set:) with a proper, live reference to the object
			to set to (as well as preventing the non-setter macros from performing
			assignments), two kinds of structures are needed: AssignmentRequests,
			which comprise a request to change a variable, and VarRef, which represent
			the variable within the AssignmentRequest.

			This here creates the VarRef, by first checking that the author's chosen
			property chain is valid, and then returning an object that pairs the chain
			with the variable.
		*/
		makeVarRef: (function(){
			/*
				The prototype object for VarRefs. Currently only has
				one method on it.
			*/
			var VarRefProto = Object.freeze({
				varref: true,
				TwineScript_ObjectName:
					"the left half of an assignment operation",
				
				/*
					Get to the farthest object in the chain, by advancing through all
					but the last part of the chain (which must be withheld and used
					for the assignment operation).
				*/
				get deepestObject() {
					return this.propertyChain.slice(0, -1).reduce(function(obj, f) {
						return obj[f];
					}, this.object);
				},
				
				/*
					Shortcut to the final property from the chain.
				*/
				get deepestProperty() {
					return this.propertyChain.slice(-1)[0];
				},
				
				/*
					These three tiny methods allow macros given this VarRef
					(such as (set:)) to perform [[Get]]s and [[Set]]s on this VarRef.
				*/
				get: function() {
					return Operations.get(this.deepestObject, this.deepestProperty);
				},
				set: function(value) {
					this.deepestObject[this.deepestProperty] = value;
				},
				delete: function() {
					Operations.delete(this.deepestObject, this.deepestProperty);
				}
				/*
					It's impossible for VarRefs to be stored by the author, so
					there's no toJSON() needed here.
				*/
			});

			return function(object, propertyChain) {
				/*
					This function accepts both arrays of strings, and single strings.
					Convert a single passed string to an array of itself.
				*/
				propertyChain = [].concat(propertyChain);
				/*
					Desugar TwineScript-specific properties and check for errors.
					This must go through and resolve every object
					in the property chain, running compilePropertyIndex on them
					instead of just the root object.
				*/
				propertyChain = propertyChain.reduce(function(objectAndChain, e) {
					var chain = objectAndChain.chain,
						object = objectAndChain.object;
					
					/*
						Convert the currently passed chain element, e,
						using compilePropertyIndex in the context of the
						current object. 
						For instance, if object is an array, and e is "1st",
						this converts e to "0".
					*/
					e = compilePropertyIndex(object, e);
					
					// Add it to the returned chain.
					chain.push(e);
					
					/*
						Move to the next object in the chain (which is, as you know,
						another object property of the current object).
					*/
					object = object[e];
					
					return {
						chain:  chain,
						object: object
					};
				}, {chain:[], object: object}).chain;
				
				/*
					This allows "it" to be used in e.g. (set: $red.x to it + 2)
					by setting it to the correct object value ($red.x instead of $red).
				*/
				It = propertyChain.reduce(function(object,e) {
					/*
						Reference down the chain until it's at an end.
					*/
					return object[e];
				}, object);
				
				return Object.assign(Object.create(VarRefProto), {
					object: object,
					// Coerce the propertyChain to an array.
					propertyChain: propertyChain,
				});
			};
		}()),
		
		/*
			And here is the function for creating AssignmentRequests.
			Because a lot of error checking must be performed, and
			appropriate error messages must be generated, all of this
			is part of TwineScript instead of the AssignmentRequest module.
		*/
		makeAssignmentRequest: function(dest, src, operator) {
			var propertyChain,
				/*
					Refuse if the object or value is an error.
				*/
				error = Utils.containsError(dest, src);
			
			if (error) {
				return error;
			}
			
			/*
				Also refuse if the dest is not, actually, a VarRef.
			*/
			if (!isObject(dest) || !("propertyChain" in dest)) {
				return new TypeError(
					"I can't give "
					+ objectName(dest)
					+ " a new value.");
			}
			/*
				Also refuse if the propertyChain contains an error.
			*/
			propertyChain = dest.propertyChain;
			if ((error = Utils.containsError(propertyChain))) {
				return error;
			}
			/*
				Refuse if the dest is an Array and the property chain's
				first property is not a numeric index.
			*/
			if (Array.isArray(dest.object[propertyChain[0]])
					&& propertyChain[1] && !numericIndex.exec(propertyChain[1])) {
				return new RangeError(
					"Arrays can only have number data keys (not '"
					+ propertyChain[1] + "')."
				);
			}
			// The input is all clear, it seems.
			return AssignmentRequest.create(dest, src, operator);
		},
		
		/*
			While these (OK, maybe just objectName) are more commonly used internally,
			some modules (like Macros) should call on them as well for consistent error
			messages. 
		*/
		objectName: objectName,
		typeName: typeName,
		
	};
	return Object.freeze(Operations);
});