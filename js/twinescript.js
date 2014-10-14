/*jshint unused:false */
define(['jquery', 'utils', 'macros', 'state', 'story', 'colour', 'assignmentRequest'], function($, Utils, Macros, State, Story, Colour, AssignmentRequest) {
	"use strict";
	
	// JShint's "unused" variables accessible to eval()
	State;
	
	/**
		A module that handles the compilation and execution of Twine
		script syntax tokens.
		
		@class TwineScript
		@static
	*/

	/*
		In some places, it's necessary to print numbers, strings and arrays of primitives
		as JS literals. This is a semantic shortcut for a certain
		built-in method that can accomplish this easily.
	*/
	var toJSLiteral = JSON.stringify;
	
	/*
		Before I continue, I'd like to explain the API for "TwineScript datatype" objects.
		This is an otherwise plain object that may implement any of the following:
		
		{Function|String} TwineScript_ObjectName:
			returns a string that's used when TwineScript needs to
			name the object in error messages or the debug menu.
		
		{Function} TwineScript_ToString:
			returns a string that's used when the object CAN be implicitly
			coerced to string. This should be used very sparingly.
		
		{Function} set TwineScript_Assignee:
			a setter function that, if present, proxies the act of setting a value to
			this object, if it's usable as an lvalue. Currently hardcoded to only
			work for hookRefs!!
		
		{Function} toString:
			if this is present and !== Object.prototype.toString, then this is
			used by Section to convert this datatype to renderable TwineMarkup code.
			This is named "toString" so that Array, Function and other objects can be
			interpreted by Section.
	*/
	/*
		This generates an Operations object, given an identifiers object.
		
		The Operations object is a table of operations which TwineScript proxies
		for/sugars over JavaScript. These include basic fixes like the elimination
		of implicit type coercion and the addition of certain early errors, but also
		includes support for new TwineScript operators, overloading of old operators,
		and other things.
		
		@class Operation
		@private
		@for TwineScript
	*/
	function operations(Identifiers) {
		var Operation, VarRefProto,
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
			Some TwineScript objects have an ObjectName method which supplies a name
			string to the error message facilities.
			@return {String}
		*/
		function objectName(obj) {
			return (isObject(obj) && "TwineScript_ObjectName" in obj)
				? obj.TwineScript_ObjectName
				: Array.isArray(obj) ? "an array"
				: (typeof obj === "string" || typeof obj === "number") ? 'the ' + typeof obj + " " + toJSLiteral(obj)
				/*
					For ES6 symbol compatibility, we must use String(obj) here instead of obj + "".
					I don't actually expect symbols to enter the TwineScript userland, but better safe.
				*/
				: String(obj);
		}
		
		/*
			This filter checks if a property name is valid for the user to set, and returns
			an error instead if it is not.
			Currently, property names beginning with '__' or 'TwineScript' are not valid.
			@return {String|Error}
		*/
		function validatePropertyName(prop) {
			var onlyIcan = "Only I can use data keys beginning with ";
			if(prop.startsWith("__")) {
				return new Error(onlyIcan + "'__'.");
			}
			if(prop.startsWith("TwineScript") && prop !== "TwineScript_Assignee") {
				return new Error(onlyIcan + "'TwineScript'.");
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
					return new TypeError("I can only " + operationVerb + " numbers.");
				}
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
			Converts a function to set Identifiers.it after it is done.
			@return {Function}
		*/
		function comparisonOp(fn) {
			return function(left, right) {
				Identifiers.it = left;
				return fn(Identifiers.it, right);
			};
		}
		
		/*
			As the base function for Operation.contains,
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
				if (typeof container === "string" || Array.isArray(container)) {
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
			return Operation.is(container,obj);
		}

		/*
			Now, let's define the operations themselves.
		*/
		Operation = {
			
			"+":  doNotCoerce(function(l, r) {
				/*
					I'm not a fan of the fact that + is both concatenator and 
					arithmetic op, but I guess it's close to what people expect.
					Nevertheless, applying the logic that a string is just as much a
					collection as an array, I feel I can overload + on arrays to mean
					"create a new array concatenating the first with the second".
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
			
			lt:  comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l <  r; }))),
			gt:  comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l >  r; }))),
			lte: comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l <= r; }))),
			gte: comparisonOp( onlyNumbers( doNotCoerce(function(l,r) { return l >= r; }))),
			
			is: comparisonOp(Object.is),
			isNot: comparisonOp(function(l,r) {
				return !Operation.is(l,r);
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
					Check that the property is valid, and replace it with
					an error if it is not valid.
				*/
				prop = validatePropertyName(prop);
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
				Runs a macro.
				
				In TwineScript.compile(), the myriad arguments given to a macro invocation are
				converted to 2 parameters to runMacro:
				
				@param {String} name     The macro's name.
				@param {Function} thunk  A thunk enclosing the expressions 
			*/
			runMacro: function(name, thunk) {
				var fn, error;
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
			
			/*
				This takes a plain function that is assumed to be a thunk,
				and attaches some thunk methods and properties to it.
				
				Currently, it just attaches an identifying "thunk" property.
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
						return Operation.get(this.deepestObject, this.deepestProperty);
					},
					set: function(value) {
						this.deepestObject[this.deepestProperty] = value;
					},
					delete: function() {
						Operation.delete(this.deepestObject, this.deepestProperty);
					}
					/*
						It's impossible for VarRefs to be stored by the author, so
						there's no toJSON() needed here.
					*/
				});

				return function(object, propertyChain) {
					// Convert a single passed string to an array of itself.
					propertyChain = [].concat(propertyChain);
					// Forbid access to internal properties
					propertyChain = propertyChain.map(validatePropertyName);
					/*
						This allows "it" to be used in e.g. (set: $red.x to it + 2)
					*/
					Identifiers.it = propertyChain.reduce(function(object,e) {
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
		};
		return Object.freeze(Operation);
	}

	/*
		Everything preceding was concerned with runtime TwineScript operations.
		From here on are functions concerned with compile-time TwineScript -
		that is, compiling TwineScript into JS.
	*/

	/*
		A helper function for compile(). When given a token array, and a
		bunch of token type strings, it returns the index in the array of the
		first token that has one of those types. Very useful.
		
		@param {Array} array The tokens array.
		@param {String} type* The token type(s).
		@return {Number} The array index, or NaN.
	*/
	function indexOfType(array, type /* variadic */) {
		var i,
			types = (arguments.length === 1
				? type
				: Array.from(arguments).slice(1));
		
		for (i = 0; i < array.length; i+=1) {
			/*
				Odd fact: unary + is often used to convert non-numbers to
				numbers, but it also converts negative numbers to positive.
				So, use 0+ instead when that matters.
			*/
			if (0+types.indexOf(array[i].type) > -1) {
				return i;
			}
		}
		return NaN;
	}
	
	/*
		A helper function for compile(). This takes some compiled
		Javascript values in string form, and joins them into a compiled
		Javascript thunk function.
	*/
	function compileThunk(/* variadic */) {
		return 'Operation.makeThunk(function(){return ['
			+ Array.from(arguments).join()
			+ ']})';
	}
	
	/**
		This takes a single TwineMarkup token being used in an assignmentRequest, 
		and returns a tuple that contains an object reference, and a property name or chain.
		
		Currently, when given multiple tokens, it simply glibly drills down.
	*/
	function compileVarRef(token) {
		var propertyNames;
		
		if (token.type === "identifier") {
			/*
				I don't think this is correct...
			*/
			return "Operation.makeVarRef(Identifiers, '" + token.text + "' )";
		}
		if (token.type === "hookRef") {
			/*
				Assignments to hookRefs assign text to all of their matching hooks.
				
				TwineScript_Assignee is a setter accessor used as a TwineScript
				assignment interface.
			*/
			return "Operation.makeVarRef(section.selectHook('?" + token.name + "'), 'TwineScript_Assignee')";
		}
		else if (token.type === "variable") {
			propertyNames = token.children.map(function(e){
				return e.name;
			});
			
			return "Operation.makeVarRef(State.variables, "
				/*
					Print the propertyNames array literal.
				*/
				+ toJSLiteral(propertyNames)
				+ ")";
		}
		return "";
	}
	
	/*
		This helper function for compile() emits code for a makeAssignmentRequest call.
		Placing it here is a bit clearer than being cloistered deep in compile().
	*/
	function compileAssignmentRequest(left, right, operator) {
		return "Operation.makeAssignmentRequest("
			+ left + ","
			+ right + ","
			+ toJSLiteral(operator)
			+")";
	}
	
	/**
		This takes an array from TwineMarkup, rooted at an expression,
		and returns raw Javascript code for the expression's execution.
		
		@method compile
		@param {Array} tokens The tokens array.
		@param {Boolean} isVarRef Whether the returned expression should be a VarRef.
		@return {String} String of Javascript code.
	*/
	function compile(tokens, isVarRef) {
		var i, type,
			/*
				These hold the returned compilations of the tokens
				surrounding a currently matched token, as part of this function's
				recursive descent. 
			*/
			left, right,
			/*
				Hoisted temp variables
			*/
			macroNameToken, token, varRefTemp,
			/*
				Setting values to either of these variables
				determines the code to emit: 
				- for midString, a plain JS infix operation between left and right; 
				- for operation, an Operation method call with left and right as arguments.
				- for assignment, an AssignmentRequest.
			*/
			midString, operation, assignment,
			/*
				Some operators should present a simple error when one of their sides is missing.
			*/
			needsLeft = true, needsRight = true,
			/*
				Some operators, like >, don't automatically work when the other side
				is absent, even when people expect them to. e.g. $var > 3 and < 5 (which is
				legal in Inform 6). To cope, I implicitly convert a blank left side to
				"it", which is the nearest previous left-hand operand.
			*/
			implicitLeftIt = false;
		
		/*
			Recursive base case: no tokens.
			Any behaviour that should be done in the event of no tokens
			must be performed elsewhere.
		*/
		if (!tokens) {
			return "";
		}
		// Convert non-arrays to arrays;
		tokens = [].concat(tokens);
		
		/*
			Potential early return if we're at a leaf node.
		*/
		if (tokens.length === 1) {
			token = tokens[0];
			if (isVarRef) {
				/*
					If we can make a varRef out of this token,
					return the varRef code.
				*/
				varRefTemp = compileVarRef(token);
				if (varRefTemp) {
					return varRefTemp;
				}
			}
			else if (token.type === "identifier") {
				return " Identifiers." + token.text + " ";
			}
			else if (token.type === "hookRef") {
				/*
					Some remarks:
					
					1. Note that the 'section' is that provided by the environ,
					and is not the Section prototype.
					2. The ? sigil is needed to distinguish the hook name
					from a pseudo-hook selector string.
				*/
				return " section.selectHook('?" + token.name + "') ";
			}
			else if (token.type === "variable") {
				return compile(token.children);
			}
			else if (token.type === "string") {
				return toJSLiteral(
					// Trim off the enclosing " or ' or ` characters.
					token.text.slice(1,-1)
				);
			}
			else if (token.type === "colour") {
				return "Colour.create("
					+ toJSLiteral(token.colour)
					+ ")";
			}
			/*
				Root tokens are usually never passed in, but let's
				harmlessly handle them anyway.
			*/
			else if (token.type === "root") {
				return compile(token.children);
			}
		}
		
		/*
			Attempt to find the index of a valid token, using this
			order of precedence:
			
			grouping ()
			property . []
			macro
			not
			multiply
			divide
			modulo
			add
			subtract
			<
			<=
			>
			>=
			is
			is not
			and
			or
			to
			comma
			
			We must check these in reverse, so that the least-precedent
			is associated last.
		*/
		
		/*
			I'll admit it: I'm not yet sure what place the JS comma will have in
			TwineScript. As of right now, let's just pass it through
			at the correct precedence, and require both sides.
		*/
		if ((i = indexOfType(tokens, "comma")) >-1) {
			midString = ",";
		}
		else if ((i = indexOfType(tokens, "to")) >-1) {
			assignment = "to";
			left  = compile(tokens.slice(0,  i), "varRef");
		}
		else if ((i = indexOfType(tokens, "into")) >-1) {
			assignment = "into";
			right = compile(tokens.slice(0,  i), "varRef");
			left  = compile(tokens.slice(i + 1), "varRef");
		}
		/*
			I'm also not sure if augmented assignment is strictly necessary given that
			one can do (set: $x to it+1), and += is sort of an overly abstract token.
		*/
		else if ((i = indexOfType(tokens, "augmentedAssign")) >-1) {
			assignment = tokens[i].operator;
			left  = compile(tokens.slice(0,  i), "varRef");
			/*
				This line converts the "b" in "a += b" into "a + b" (for instance),
				thus partially de-sugaring the augmented assignment.
				
				Note that the left tokens must be compiled again, as a non-varRef this time.
				
				Note also that this assumes the token's assignment property corresponds to
				a binary-arity Operation method name.
			*/
			right = "Operation['" + assignment + "']("
				+ (compile(tokens.slice (0,  i)) + ","
				+  compile(tokens.splice(i + 1))) + ")";
		}
		else if ((i = indexOfType(tokens, "and", "or")) >-1) {
			midString =
				( tokens[i].type === "and" ? " && " : " || " );
		}
		else if ((i = indexOfType(tokens, "is", "isNot", "contains", "isIn")) >-1) {
			implicitLeftIt = true;
			operation = tokens[i].type;
		}
		else if ((i = indexOfType(tokens, "lt", "lte", "gt", "gte")) >-1) {
			implicitLeftIt = true;
			operation = tokens[i].type;
		}
		else if ((i = indexOfType(tokens, "arithmetic")) >-1) {
			operation = tokens[i].operator;

			/*
				Since arithmetic can also be the unary - and + tokens,
				we must, in those cases, change the left token to 0 if
				it doesn't exist.
				This would ideally be an "implicitLeftZero", but, well...
			*/
			if ("+-".contains(tokens[i].text)) {
				left  = compile(tokens.slice(0,  i));
				if (!left) {
					left = "0";
				}
			}
		}
		else if ((i = indexOfType(tokens, "not")) >-1) {
			midString = "!";
			needsLeft = false;
		}
		else if ((i = indexOfType(tokens, "variableProperty")) >-1) {
			/*
				This is somewhat tricky - we need to manually wrap the left side
				inside the Operation.get call, while leaving the right side as is.
			*/
			left = "Operation.get(" + compile(tokens.slice (0,  i))
				/*
					toJSLiteral() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ "," + toJSLiteral(tokens[i].name) + ")";
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if ((i = indexOfType(tokens, "simpleVariable")) >-1) {
			midString = " Operation.get(State.variables,"
				+ toJSLiteral(tokens[i].name)
				/*
					Here is where the default value for variables is passed!
				*/
				+ ", 0)";
			needsLeft = needsRight = false;
		}
		else if ((i = indexOfType(tokens, "macro")) >-1) {
			/*
				The first child token in a macro is always the method name.
			*/
			macroNameToken = tokens[i].children[0];
			Utils.assert(macroNameToken.type === "macroName");
			
			midString = 'Operation.runMacro('
				/*
					The macro name, if it constitutes a method call, contains a
					variable expression representing which function should be called.
					Operation.runMacro will, if given a function instead of a string
					identifier, run the function in place of a macro's fn.
				*/
				+ (macroNameToken.isMethodCall
					? compile(macroNameToken.children)
					: '"' + tokens[i].name + '"'
				)
				/*
					The arguments given to a macro instance must be converted to a thunk.
					The reason is that "live" macros need to be reliably called again and
					again, using the same variable bindings in their original invocations.
					
					For instance, consider the macro instance "(when: time > 2s)". The "time"
					variable needs to be re-evaluated every time - something which isn't
					possible by just transpiling the macro instance into a JS function call.
				*/
				+ ', ' + compileThunk(
					/*
						The first argument to macros must be the current section,
						so as to give the macros' functions access to data
						about the runtime state (such as, whether this expression
						is nested within another one).
					*/
					"section",
					/*
						You may notice here, unseen, is the assumption that Javascript array literals
						and TwineScript macro invocations use the same character to separate arguments/items.
						(That, of course, being the comma - (macro: 1,2,3) vs [1,2,3].)
						This is currently true, but it is nonetheless a fairly bold assumption.
					*/
					compile(tokens[i].children.slice(1))
				) + ')';
			needsLeft = needsRight = false;
		}
		else if ((i = indexOfType(tokens, "grouping")) >-1) {
			midString = "(" + compile(tokens[i].children, isVarRef) + ")";
			needsLeft = needsRight = false;
		}
		
		/*
			If a token was found, we can recursively
			compile those next to it.
		*/
		if (i >- 1) {
			/*
				Any of the comparisons above could have provided specific
				values for left and right, but usually they will just be
				the tokens to the left and right of the matched one.
			*/
			left  = left  || (compile(tokens.slice (0,  i), isVarRef)).trim();
			right = right || (compile(tokens.splice(i + 1))).trim();
			/*
				The compiler should implicitly insert the "it" keyword when the 
				left-hand-side of a comparison operator was omitted.
			*/
			if (implicitLeftIt && !(left)) {
				left = " Identifiers.it ";
			}
			/*
				If there is no implicitLeftIt, produce an error message.
			*/
			if ((needsLeft && !left) || (needsRight && !right)) {
				return "new SyntaxError('I need some code to be "
					+ (needsLeft ? "left " : "")
					+ (needsLeft && needsRight ? "and " : "")
					+ (needsRight ? "right " : "")
					+ "of "
					+ '"' + tokens[i].text + '"'
					+ "')";
			}

			if (midString) {
				return left + midString + right;
			}
			else if (assignment) {
				return compileAssignmentRequest(left, right, assignment);
			}
			else if (operation) {
				return " Operation[" + toJSLiteral(operation) + "](" + left + "," + right + ") ";
			}
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else if (tokens.length === 1) {
			return ((token.value || token.text) + "").trim();
		}
		else {
			return tokens.reduce(function(a, token) { return a + compile(token, isVarRef); }, "");
		}
		return "";
	}
	
	/**
		Creates a new script execution environment. This accepts and
		decorates a Section object (see Engine.showPassage) with the
		eval method.
		
		@method environ
		@param {Section} section
		@return {Object} An environ object with eval methods.
	*/
	function environ(section) {
		if (typeof section !== "object" || !section) {
			Utils.impossible("TwineScript.environ", "no Section argument was given!");
		}
		
		var 
			/*
				This contains special runtime identifiers which may change at any time.
			*/
			Identifiers = {
				/*
					The "it" keyword is bound to whatever the last left-hand-side value
					in a comparison operation was.
				*/
				it: false,
				/*
					The "time" keyword binds to the number of milliseconds since the passage
					was rendered.
					
					It might be something of a toss-up whether the "time" keyword should
					intuitively refer to the entire passage's lifetime, or just the nearest
					hook's. I believe that the passage is what's called for here.
				*/
				get time() {
					return (Date.now() - section.timestamp);
				}
				/*
					TODO: An author-facing error message for setting time()
				*/
			},
			Operation = operations(Identifiers);
			
		return Object.assign(section, {
			eval: function(/* variadic */) {
				try {
					/*
						This specifically has to be a "direct eval()" - calling eval() "indirectly"
						makes it run in global scope.
					*/
					return eval(
						Array.from(arguments).join('')
					);
				} catch(e) {
					/*
						This returns the Javascript error object verbatim
						to the author, as a last-ditch and probably
						unhelpful error message.
					*/
					return e;
				}
			}
		});
	}
	
	var TwineScript = Object.freeze({
		compile: compile,
		environ: environ
	});
	
	Utils.log("TwineScript module ready!");
	return TwineScript;
	/*jshint unused:true */
});