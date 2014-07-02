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
	
	function isRuntimeError(/*variadic*/) {
		return [].some.call(arguments,function(e) { return e instanceof Error; });
	}
	
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
		This is a list of operations which TwineScript proxies for JavaScript.
		Most of these have implicit type coercion or silent errors which must
		be dealt with.
	*/
	var Operation = {
	
		add:      doNotCoerce(function(l, r) { return l + r; }),
		subtract: doNotCoerce(function(l, r) { return l - r; }),
		multiply: doNotCoerce(function(l, r) { return l * r; }),
		divide:   doNotCoerce(function(l, r) { return l / r; }),
		modulo:   doNotCoerce(function(l, r) { return l % r; }),
		
	};
	
	/*
		A helper function for compile()
	*/
	function indexOfType(array /* variadic */) {
		var i,
			types = array.slice.call(arguments, 1);
		
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
			compiledLeft,
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
		*/
		if ((i = indexOfType(array, "grouping")) >-1) {
			midString = "(" + compile(array[i].children) + ")";
		}
		else if ((i = indexOfType(array, "macro")) >-1) {
			midString = "Macros.run(\"" + array[i].name + "\"," + compile(array[i].children) + ")";
		}
		else if ((i = indexOfType(array, "comma")) >-1) {
			midString = ",";
		}
		else if ((i = indexOfType(array, "not")) >-1) {
			midString = "!";
		}
		else if ((i = indexOfType(array, "add", "subtract", "multiply", "divide", "modulo")) >-1) {
			operation = array[i].type;
		}
		else if ((i = indexOfType(array, "lt", "lte", "gt", "gte")) >-1) {
			type = array[i].type;
			implicitLeftIt = true;
			midString =
				( type === "lt"   ? " < "
				: type === "lte"  ? " <= "
				: type === "gt"   ? " > "
				: " >= " );
		}
		else if ((i = indexOfType(array, "is", "isNot")) >-1) {
			midString = ( array[i].type === "is" ? "===" : "!==" );
		}
		else if ((i = indexOfType(array, "and", "or")) >-1) {
			midString =
				( array[i].type === "and" ? " && " : " || " );
		}
		else if ((i = indexOfType(array, "to")) >-1) {
			midString = " = ";
		}
		else if ((i = indexOfType(array, "variable")) >-1) {
			// TODO: Defaulting to 0
			midString = " State.variables." + array[i].name + " ";
		}
		else if ((i = indexOfType(array, "hookRef")) >-1) {
			midString = " WordArray.create('?" + array[i].name + "') ";
		}
		
		/*
			Recursive case
		*/
		if (i >- 1) {
			right = right || array.splice(i + 1);
			left  = left  || array.slice (0,  i);
			
			compiledLeft = compile(left);
			if (implicitLeftIt && !(compiledLeft.trim())) {
				compiledLeft = " it ";
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
		else {
			return array.reduce(function(a, token) { return a + (token.value || token.text); }, "");
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