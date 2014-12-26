define([
	'utils',
	'state',
	'story',
	'datatypes/colour',
	'datatypes/assignmentrequest',
	'utils/operationutils',
],
function(Utils, State, Story, Colour, AssignmentRequest, OperationUtils) {
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
		It = 0,
		/*
			Used to determine if a property name is an array index.
			If negative indexing sugar is ever added, this could
			be replaced with a function.
		*/
		numericIndex = /^(?:[1-9]\d*|0)$/,
		/*
			The default defaultValue, used for all uninitialised properties
			and variables, is 0.
		*/
		defaultValue = 0,
		/*
			In ES6, this would be a destructured assignment.
		*/
		isObject        = OperationUtils.isObject,
		collectionType  = OperationUtils.collectionType,
		isSequential    = OperationUtils.isSequential,
		clone           = OperationUtils.clone,
		coerceToString  = OperationUtils.coerceToString,
		objectName      = OperationUtils.objectName,
		contains        = OperationUtils.contains
		;
	
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
			match,
			error;
		
		if((error = Utils.containsError(obj, prop))) {
			return error;
		}
		if(prop.startsWith("__")) {
			return new Error(onlyIcan + "'__'.");
		}
		if(prop.startsWith("TwineScript") && prop !== "TwineScript_Assignee") {
			return new Error(onlyIcan + "'TwineScript'.");
		}
		/*
			Sequentials have special sugar property indices:
			
			length: this falls back to JS's length property for Arrays and Strings.
			1st, 2nd etc.: indices.
			last: antonym of 1st.
			2nd-last, 3rd-last: reverse indices.
		*/
		if (isSequential(obj)) {
			/*
				Note that this glibly allows "1rd" or "2st".
				There's no real problem with this.
			*/
			if ((match = /(\d+)(?:st|[nr]d|th)/.exec(prop))) {
				prop = match[1] - 1 + "";
			}
			else if (prop === "last") {
				prop = obj.length - 1 + "";
			}
			else if ((match = /(\d+)(?:st|[nr]d|th)-last/.exec(prop))) {
				prop = obj.length - match[1] + "";
			}
			else if (prop !== "length") {
				return new Error("You can only use positions ('4th', 'last', '2nd-last', etc.) and 'length' with a "
					+ objectName(obj) + ".");
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
			var error;
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			if ((error = Utils.containsError(left, right))) {
				return error;
			}
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
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			if ((error = Utils.containsError(left, right))) {
				return error;
			}
			// VarRefs cannot have operations performed on them.
			if (left && left.varref) {
				return new TypeError("I can't give an expression a new value.");
			}
			/*
				This checks that left and right are generally different types
				(both different typeof or, if both are object, different collection types)
			*/
			if (typeof left !== typeof right
				|| collectionType(left) !== collectionType(right)) {
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
			var ret;
			/*
				I'm not a fan of the fact that + is both concatenator and
				arithmetic op, but I guess it's close to what people expect.
				Nevertheless, applying the logic that a string is just as much a
				sequential collection as an array, I feel I can overload +
				on collections to mean immutable concatenation or set union.
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array.
				*/
				return [].concat(l, r);
			}
			/*
				For Maps and Sets, create a new instance combining left and right.
				You may note that in the case of Maps, values of keys used on the
				right side trump those on the left side.
			*/
			if (l instanceof Map) {
				ret = new Map(l);
				r.forEach(function(v,k) {
					ret.set(k, v);
				});
				return ret;
			}
			if (l instanceof Set) {
				ret = new Set(l);
				r.forEach(function(v) {
					ret.add(v);
				});
				return ret;
			}
			/*
				If a TwineScript object implements a + method, use that.
			*/
			else if (typeof l["TwineScript_+"] === "function") {
				return l["TwineScript_+"](r);
			}
			return l + r;
		}),
		"-":  doNotCoerce(function(l, r) {
			var ret;
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
			/*
				Sets, but not Maps, can be subtracted.
			*/
			else if (l instanceof Set) {
				ret = new Set(l);
				r.forEach(function(v) {
					ret.delete(v);
				});
				return ret;
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
		
		"<":  comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l <  r; }), "do < to")),
		">":  comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l >  r; }), "do > to")),
		"<=": comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l <= r; }), "do <= to")),
		">=": comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l >= r; }), "do >= to")),
		
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
		get: function(obj, prop) {
			if (obj === null || obj === undefined) {
				return new ReferenceError(
					"I can't get a property named '"
					+ prop
					+ "' from "
					+ typeof obj
					+ "."
				);
			}
			
			/*
				First, check for and propagate earlier errors.
			*/
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
			if ((obj instanceof Map)
					? !obj.has(prop)
					/*
						Notice that the 'in' operator fails on primitives, so
						Object(obj) must be used.
					*/
					: !(prop in Object(obj))) {
				/*
					If the property is actually a State.variables access,
					then it's a variable, and uses the defaultValue in place
					of undefined.
				*/
				if (obj === State.variables) {
					return defaultValue;
				}
				/*
					Otherwise, produce an error message.
				*/
				return new ReferenceError("I can't find a '" + prop + "' data key in "
					+ objectName(obj));
			}
			return (obj instanceof Map) ? obj.get(prop) : obj[prop];
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
			This takes a plain value assumed to be an array, and wraps
			it in a special structure that denotes it to be spreadable.
			This is created by the spread (...) operator.
		*/
		makeSpreader: function(val) {
			return {
				value: val,
				spreader: true,
			};
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
		makeVarRef: (function() {
			/*
				As Maps have a different means of accessing stored values
				than arrays, these tiny utility functions are needed.
				They have the slight bonus that they can fit into some .reduce() calls
				below, which potentially offsets the cost of being re-created for each varRef.
			*/
			function objectOrMapGet(obj, prop) {
				if (obj instanceof Map) {
					return obj.get(prop);
				} else {
					return obj[prop];
				}
			}
			function objectOrMapSet(obj, prop, value) {
				if (obj instanceof Map) {
					obj.set(prop, value);
				} else {
					obj[prop] = value;
				}
			}
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
					return this.propertyChain.slice(0, -1).reduce(objectOrMapGet, this.object);
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
					/*
						If value has a TwineScript_AssignValue() method
						(i.e. is a HookSet) then its returned value is used
						instead of copying over the object itself.
					*/
					if (value && value.TwineScript_AssignValue) {
						value = value.TwineScript_AssignValue();
					}
					/*
						Most all objects in TwineScript are passed by value.
						Hence, setting to an object duplicates it.
					*/
					if (isObject(value)) {
						value = clone(value);
					}
					objectOrMapSet(this.deepestObject, this.deepestProperty, value);
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
					object = objectOrMapGet(object, e);
					
					return {
						chain:  chain,
						object: object
					};
				}, {chain:[], object: object}).chain;
				
				/*
					This allows "it" to be used in e.g. (set: $red.x to it + 2)
					by setting it to the correct object value ($red.x instead of $red).
					
					Notice this uses Operations.get in place of objectOrMapGet: this
					is because It is essentially a special variable, and should use
					the default value, propagate errors, etc.
				*/
				It = propertyChain.reduce(Operations.get, object);
				
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
		
	};
	return Object.freeze(Operations);
});