define([], function() {
	"use strict";
	
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
	
	/*
		This takes an array from TwineMarked, rooted at a macro,
		and returns raw Javascript code for the macro's execution.
	*/
	function twineParser(array) {
		var i, left, right, type, midString;
		
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
			midString = "(" + twineParser(array[i].children) + ")";
		}
		else if ((i = indexOfType(array, "macro")) >-1) {
			midString = "Macros.run(\"" + array[i].name + "\"," + twineParser(array[i].children) + ")";
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
			midString =
				( array[i].type === "add" ? "+" : "-" );
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
		else if ((i = indexOfType(array, "variable")) >-1) {
			// TODO: Defaulting to 0
			midString = " State.variables." + array[i].name + " ";
		}
		else if ((i = indexOfType(array, "hookRef")) >-1) {
			midString = " Hook('" + array[i].name + "') ";
		}
		
		/*
			Recursive case
		*/
		if (midString) {
			right = array.splice(i + 1);
			left  = array.slice (0,  i);
			return twineParser(left) + midString + twineParser(right);
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else {
			return array.reduce(function(a, token) { return a + (token.value || token.text); }, "");
		}
		return "";
	}
	
	return twineParser;
});