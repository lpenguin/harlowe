/*jshint unused:false */
define(['jquery', 'utils', 'macros', 'state'], function($, Utils, Macros, State) {
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
		What follows from here are runtime functions and variables that
		Script.environ() relies on to be in scope.
	*/
	
	/*
		Generates an operation object, given an identifiers object.
		
		The operation object is a list of operations which TwineScript proxies
		for JavaScript. Most of these have implicit type coercion or silent errors 
		which must be dealt with.
	*/
	function operations(Identifiers) {
		var Operation;
		
		/*
			Some TwineScript objects can, in fact, be coerced to string.
			HookRefs, for instance, coerce to the string value of their first
			matching hook.
			
			This returns the resulting string, or false if it couldn't be performed.
		*/
		function coerceToString(fn, left, right) {
			if (typeof left  === "string" && "TwineScript_ToString" in right) {
				return fn(left, right.TwineScript_ToString());
			}
			/*
				We can't really replace this case with a second call to
				canCoerceToString, passing (fn, right, left), because fn
				may not be symmetric.
			*/
			if (typeof right  === "string" && "TwineScript_ToString" in left) {
				return fn(left.TwineScript_ToString(), right);
			}
			return false;
		}
		
		/*
			Some TwineScript objects have an ObjectName method which supplies a name
			string to the error message facilities.
		*/
		function objectName(obj) {
			return (obj && typeof obj === "object" && "TwineScript_ObjectName" in obj)
				? obj.TwineScript_ObjectName()
				: obj;
		}
		
		/*
			Converts a function to type-check its two arguments before
			execution, and thus suppress JS type coercion.
			
		*/
		function doNotCoerce(fn) {
			return function(left, right) {
				if (typeof left !== typeof right) {
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
							objectName(left)
							+ " isn't the same type of data as "
							+ objectName(right));
				}
				/*
					This part allows errors to propagate up the TwineScript stack.
				*/
				else if (Utils.containsError([left, right])) {
					return left;
				}
				return fn(left, right);
			};
		}
		
		/*
			Converts a function to set Identifiers.it after it is done.
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
		*/
		function contains(container,obj) {
			var i, keys;
			if (container) {
				/*
					Basic array or string indexOf check
				*/
				if (typeof container === "string" || Array.isArray(container)) {
					return container.indexOf(obj) > -1;
				}
				/*
					Controversially, for plain object containers, it returns true if
					the obj is a stored value OR a string key.
				*/
				if (container.constructor === Object) {
					for (i = 0, keys = Object.keys(container); i < keys.length; i+=1) {
						if (keys === obj || container[keys] === obj) {
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
		
		Operation = {
			
			add:      doNotCoerce(function(l, r) { return l + r; }),
			subtract: doNotCoerce(function(l, r) { return l - r; }),
			multiply: doNotCoerce(function(l, r) { return l * r; }),
			divide:   doNotCoerce(function(l, r) { return l / r; }),
			modulo:   doNotCoerce(function(l, r) { return l % r; }),
			
			lt:  comparisonOp(doNotCoerce(function(l,r) { return l <  r; })),
			gt:  comparisonOp(doNotCoerce(function(l,r) { return l >  r; })),
			lte: comparisonOp(doNotCoerce(function(l,r) { return l <= r; })),
			gte: comparisonOp(doNotCoerce(function(l,r) { return l >= r; })),
			
			is: comparisonOp(Object.is),
			isNot: comparisonOp(function(l,r) {
				return !Operation.is(l,r);
			}),
			contains: comparisonOp(contains),
			isIn: comparisonOp(function(l,r) {
				return contains(r,l);
			}),
			
			/*
				Runs a macro.
				
				In TwineScript.compile(), the myriad arguments given to a macro invocation are converted to 2 parameters to runMacro:
				
				@param {String} name     The macro's name.
				@param {Function} thunk  A thunk enclosing the expressions 
			*/
			runMacro: function(name, thunk) {
				var fn, error;
				
				name = name.toLowerCase();
				if (!Macros.has(name)) {
					return new ReferenceError("Unknown macro: " + name);
				}
				fn = Macros.get(name.toLowerCase());
				
				return fn(thunk);
			}
		};
		return Object.freeze(Operation);
	}

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
		This mixin function takes a plain function that is assumed to be a thunk,
		and attaches some thunk methods and properties to it.
	*/
	function makeThunk(fn) {
		return Object.assign(fn, {
			thunk: true
		});
	}
	
	/*
		A helper function for compile(). This takes some compiled
		Javascript values in string form, and joins them into a compiled
		Javascript thunk function.
	*/
	function thunkJS(/* variadic */) {
		return 'makeThunk(function argsThunk(){return ['
			+ Array.from(arguments).join()
			+ ']})';
	}
	
	/**
		This takes an array from TwineMarkup, rooted at a macro,
		and returns raw Javascript code for the macro's execution.
		
		@method compile
		@param {Array} tokens The tokens array.
		@return {String} String of Javascript code.
	*/
	function compile(tokens) {
		var i, left, right, type,
			/*
				Hoisted temp variables
			*/
			compiledLeft, token,
			/*
				Setting values to either of these two variables
				determines the code to emit: for midString, a plain
				JS infix operation between left and right; for operation, an
				Operation method call with left and right as arguments.
			*/
			midString, operation,
			/*
				Some operators, like >, don't work when the other side is absent,
				even when people expect them to. e.g. $var > 3 and < 5 (which is
				legal in Inform 6). To cope, I implicitly convert a blank left side to
				"it", which is the nearest previous left-hand operand.
			*/
			implicitLeftIt = false;
		
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
			if (token.type === "identifier") {
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
				return " State.variables." + token.name + " ";
			}
		}
		
		/*
			Attempt to find the index of a valid token, using this
			order of precedence:
			
			grouping ()
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
		if ((i = indexOfType(tokens, "comma")) >-1) {
			midString = ",";
		}
		else if ((i = indexOfType(tokens, "to")) >-1) {
			midString = "=";
		}
		else if ((i = indexOfType(tokens, "augmentedAssign")) >-1) {
			midString = tokens[i].type;
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
		else if ((i = indexOfType(tokens, "add", "subtract", "multiply", "divide", "modulo")) >-1) {
			operation = tokens[i].type;
		}
		else if ((i = indexOfType(tokens, "not")) >-1) {
			midString = "!";
		}
		else if ((i = indexOfType(tokens, "macro")) >-1) {
			/*
				The arguments given to a macro instance must be converted to a thunk.
				The reason is that "live" macros need to be reliably called again and
				again, using the same variable bindings in their original invocations.
				
				For instance, consider the macro instance "(when: time > 2s)". The "time"
				variable needs to be re-evaluated every time - something which isn't
				possible by just transpiling the macro instance into a JS function call.
			*/
			midString = 'Operation.runMacro("'
				+ tokens[i].name + '", ' + thunkJS(
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
					compile(tokens[i].children)
				) + ')';
		}
		else if ((i = indexOfType(tokens, "grouping")) >-1) {
			midString = "(" + compile(tokens[i].children) + ")";
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
			left  = left  || (compile(tokens.slice (0,  i))).trim();
			right = right || (compile(tokens.splice(i + 1))).trim();
			/*
				The compiler should implicitly insert the "it" keyword when the 
				left-hand-side of a comparison operator was omitted.
			*/
			if (implicitLeftIt && !(left)) {
				left = " Identifiers.it ";
			}
			if (midString) {
				return left + midString + right;
			}
			else if (operation) {
				return " Operation." + operation + "(" + left + "," + right + ") ";
			}
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else if (tokens.length === 1) {
			return (token.value || token.text) + "";
		}
		else {
			return tokens.reduce(function(a, token) { return a + compile(token); }, "");
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
					Utils.impossible("TwineScript.environ().eval",
						"Javascript error:\n\t" + Array.from(arguments).join('')
						+ "\n" + e.message);
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