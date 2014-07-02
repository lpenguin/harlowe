/*jshint unused:false */
define(['utils', 'macros', 'wordarray'], function(Utils, Macros, WordArray) {
	"use strict";
	
	// JShint's "unused" variables accessible to eval()
	Macros; WordArray;
	
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
	function doNotCoerce(left, right, fn) {
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
	
	var Operation = {
	
		add: doNotCoerce(function(left, right) {
			return left + right;
		}),
		
		subtract: doNotCoerce(function(left, right) {
			return left - right;
		})
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
				Setting to either of these
				determines the code to emit: for midString, a plain
				JS infix operation between left and right; for callString, an
				Operation method call with left and right as arguments.
			*/
			midString, callString;
		
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
		else if ((i = indexOfType(array, "multiply", "divide", "modulo")) >-1) {
			type = array[i].type;
			midString =
				( type === "multiply" ? "*"
				: type === "divide"   ? "/"
				: "%");
		}
		else if ((i = indexOfType(array, "add", "subtract")) >-1) {
			callString =
				( array[i].type === "add" ? "add" : "subtract" );
		}
		else if ((i = indexOfType(array, "lt", "lte", "gt", "gte")) >-1) {
			type = array[i].type;
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
		if (i >-1) {
			right = array.splice(i + 1);
			left  = array.slice (0,  i);
			if (midString) {
				return compile(left) + midString + compile(right);
			}
			else if (callString) {
				return " Operation." + callString + "(" + left + "," + right + ") ";
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
				console.log([].join.call(arguments, ''));
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