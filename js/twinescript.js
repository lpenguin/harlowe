/*jshint unused:false */
define(['utils', 'macros', 'wordarray', 'state'], function(Utils, Macros, WordArray, State) {
	"use strict";
	
	// JShint's "unused" variables accessible to eval()
	Macros, WordArray, State;
	
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
	
	function isRuntimeError(/*variadic*/) {
		return [].some.call(arguments,function(e) { return e instanceof Error; });
	}
	
	var
		/*
			This contains special runtime identifiers which may change at any time.
			TODO: this should be re-initialised after every environ().eval().
		*/
		Identifiers = {
		
			/*
				The "it" keyword is bound to whatever the last left-hand-side value
				in a comparison operation was.
			*/
			it: false
		},
		
		/*
			This is a list of operations which TwineScript proxies for JavaScript.
			Most of these have implicit type coercion or silent errors which must
			be dealt with.
		*/
		Operation = (function Operation(){
			
			/*
				Converts a function to type-check its two arguments before
				execution, and thus suppress JS type coercion.
			*/
			function doNotCoerce(fn) {
				return function(left, right) {
					if (typeof left !== typeof right) {
						return new TypeError(left + " isn't the same type of data as " + right);
					}
					else if (isRuntimeError(left, right)) {
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
			
			return {
				
				add:      doNotCoerce(function(l, r) { return l + r; }),
				subtract: doNotCoerce(function(l, r) { return l - r; }),
				multiply: doNotCoerce(function(l, r) { return l * r; }),
				divide:   doNotCoerce(function(l, r) { return l / r; }),
				modulo:   doNotCoerce(function(l, r) { return l % r; }),
				
				lt:  comparisonOp(doNotCoerce(function(l,r) { return l <  r; })),
				gt:  comparisonOp(doNotCoerce(function(l,r) { return l >  r; })),
				lte: comparisonOp(doNotCoerce(function(l,r) { return l <= r; })),
				gte: comparisonOp(doNotCoerce(function(l,r) { return l >= r; })),
				
				/*
					This fixes the NaN !== NaN "bug" in IEEE754.
					If ES6 Object.is() is available, it also makes -0 !== 0.
				*/
				is: comparisonOp(Object.is || function(l,r) {
					return (l === r) === (l !== l && r !== r);
				}),
				isNot: comparisonOp(function(l,r) {
					return !Operation.is(l,r);
				}),
				contains: comparisonOp(contains),
				isIn: comparisonOp(function(l,r) {
					return contains(r,l);
				}),
			};
		}());
	
	/*
		A helper function for compile()
	*/
	function indexOfType(array, type /* variadic */) {
		var i,
			types = (arguments.length === 1
				? type
				: array.slice.call(arguments, 1));
		
		for (i = 0; i < array.length; i+=1) {
			if (0+types.indexOf(array[i].type) > -1) {
				return i;
			}
		}
		return NaN;
	}
	
	/**
		This takes an array from TwineMarkup, rooted at a macro,
		and returns raw Javascript code for the macro's execution.
		
		@method compile
		@param {Array} array The tokens array.
		@return {String} String of Javascript code.
	*/
	function compile(array) {
		var i, left, right, type,
			/*
				Hoisted temp variables
			*/
			compiledLeft, token,
			/*
				Setting values to either of these
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
		
		if (!array) {
			return;
		}
		// Convert non-arrays to arrays;
		array = [].concat(array);
		
		/*
			Potential early return if we're at a leaf node.
		*/
		if (array.length === 1) {
			token = array[0];
			if (token.type === "identifier") {
				return " Identifiers." + token.text + " ";
			}
			else if (token.type === "hookRef") {
				return " WordArray.create('?" + token.name + "') ";
			}
			else if (token.type === "variable") {
				// TODO: Defaulting to 0
				return " State.variables." + token.name + " ";
			}
		}
		/*
			Precedence:
			
			grouping ()
			macro
			comma
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
			
			We must check these in reverse, so that the least-precedent
			is associated last.
		*/
		if ((i = indexOfType(array, "comma")) >-1) {
			midString = ",";
		}
		else if ((i = indexOfType(array, "to")) >-1) {
			midString = " = ";
		}
		else if ((i = indexOfType(array, "and", "or")) >-1) {
			midString =
				( array[i].type === "and" ? " && " : " || " );
		}
		else if ((i = indexOfType(array, "is", "isNot", "contains", "isIn")) >-1) {
			implicitLeftIt = true;
			operation = array[i].type;
		}
		else if ((i = indexOfType(array, "lt", "lte", "gt", "gte")) >-1) {
			implicitLeftIt = true;
			operation = array[i].type;
		}
		else if ((i = indexOfType(array, "add", "subtract", "multiply", "divide", "modulo")) >-1) {
			operation = array[i].type;
		}
		else if ((i = indexOfType(array, "not")) >-1) {
			midString = "!";
		}
		else if ((i = indexOfType(array, "macro")) >-1) {
			midString = 'Macros.run("' + array[i].name + '",' + compile(array[i].children) + ')';
		}
		else if ((i = indexOfType(array, "grouping")) >-1) {
			midString = "(" + compile(array[i].children) + ")";
		}
		
		/*
			Recursive case
		*/
		if (i >- 1) {
			right = right || array.splice(i + 1);
			left  = left  || array.slice (0,  i);
			
			compiledLeft = compile(left);
			
			/*
				The compiler should implicitly insert the "it" keyword when the 
				left-hand-side of a comparison operator was omitted.
			*/
			if (implicitLeftIt && !(compiledLeft.trim())) {
				compiledLeft = " Identifiers.it ";
			}
			if (midString) {
				return compiledLeft + midString + compile(right);
			}
			else if (operation) {
				return " Operation." + operation + "(" + compiledLeft + "," + compile(right) + ") ";
			}
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else if (array.length === 1) {
			return (token.value || token.text);
		}
		else {
			return array.reduce(function(a, token) { return a + compile(token); }, "");
		}
		return "";
	}
	
	/**
		Creates a new script execution environment, in which "top"
		is bound to a certain value.
		@method environ
		@param {jQuery} top The DOM context for WordArray.create
		@return {Object} An environ object with eval methods.
	*/
	function environ(top) {		
		return {
			eval: function(/* variadic */) {
				// This specifically has to be a "direct eval()" - calling eval() "indirectly"
				// makes it run in global scope.
				try {
					// This specifically has to be a "direct eval()" - calling eval() "indirectly"
					// makes it run in global scope.
					return eval(
						[].join.call(arguments, '')
					);
				} catch(e) {
					Utils.impossible("TwineScript.environ().eval",
						"Javascript error:\n\t" + [].join.call(arguments, '')
						+ "\n" + e.message);
				}
			}
		};
	}
	
	var TwineScript = Object.freeze({
		compile: compile,
		environ: environ
	});
	
	Utils.log("TwineScript module ready!");
	return TwineScript;
	/*jshint unused:true */
});