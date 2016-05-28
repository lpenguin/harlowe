define(['utils'], ({toJSLiteral, impossible}) => {
	"use strict";
	
	/*
		A module that handles the JIT compilation of TwineScript syntax tokens
		(received from TwineMarkup) into Javascript code that calls Operations methods.
	*/
	
	/*
		Before I continue, I'd like to explain the API for "TwineScript datatype" objects.
		This is an otherwise plain object that may implement any of the following:
		
		{Function|String} TwineScript_ObjectName:
			returns a string that's used when TwineScript needs to
			name the object in error messages or the debug menu.
		
		{Function} TwineScript_Clone:
			a function which clones the value, even if it's an oddly-shaped object.
			Should be used exclusively by VarRef.set().
		
		{Function} TwineScript_+:
			a function which is used to overload the + operator. Note that TwineScript
			automatically forces both sides of + to be of identical type.
		
		{Function} TwineScript_Print:
			a function which is used when the given object is printed into the passage.
		
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
		Everything preceding was concerned with runtime TwineScript operations.
		From here on are functions concerned with compile-time TwineScript -
		that is, compiling TwineScript into JS.
	*/

	/*
		A helper function for compile(). When given a token array, and a
		bunch of token type strings, it returns the index in the array of the
		first token that has one of those types. Very useful.
		
		@param {Array} array The tokens array.
		@param {Array} types The token type(s).
		@return {Number} The array index, or NaN.
	*/
	function indexOfType(array, types) {
		for (let i = 0; i < array.length; i+=1) {
			if (types.indexOf(array[i].type) > -1) {
				return i;
			}
		}
		return NaN;
	}
	
	function rightAssociativeIndexOfType(array, types) {
		/*
			What this does is tricky: it reverses the passed-in array,
			calls the normal indexOfType, then inverts the returned index
			(converting, say, 3/10 on the reversed array into 7/10 on
			the original array).
		*/
		return (array.length - 1) - indexOfType(...[
			/*
				Regrettably, .reverse() is an in-place method, so a copy must be
				manually made.
			*/
			[...array].reverse(), types
		]);
	}

	/*
		When given an array of tokens, this finds the token with the highest or lowest precedence
		among them, and returns it with its index.
	*/
	function precedentToken(tokens, order) {
		/*
			If none is found, this empty array is returned.
		*/
		let ret = [];
		if (!tokens.length) {
			return ret;
		}
		/*
			The following is the precedence table for Harlowe tokens,
			in ascending order of tightness. Each row has identical precedence.
			Absent token types have the least precedence.
		*/
		[
			["comma"],
			["spread"],
			["to"],
			["into"],
			{rightAssociative: ["where", "via"]},
			{rightAssociative: ["with", "making"]},
			["augmentedAssign"],
			["and", "or"],
			["is", "isNot"],
			["contains", "isIn"],
			["inequality"],
			["addition", "subtraction"],
			["multiplication", "division"],
			["not"],
			["belongingProperty"],
			["belongingOperator", "belongingItOperator"],
			{rightAssociative: ["property"]},
			{rightAssociative: ["itsProperty"]},
			["belongingItProperty"],
			{rightAssociative: ["possessiveOperator", "itsOperator"]},
			["twineLink"],
			["macro"],
			["grouping"],
		][order === "most" ? "reverse" : "valueOf"]().some(types => {
			let index;
			/*
				Right-associative token types are wrapped especially.
			*/
			if (types.rightAssociative) {
				index = rightAssociativeIndexOfType(tokens, types.rightAssociative);
			}
			else {
				index = indexOfType(tokens, types);
			}
			/*
				Return the token once we find it.
			*/
			if (!Number.isNaN(index) && index > -1) {
				ret = [tokens[index], index];
				return true;
			}
		});
		return ret;
	}

	/*
		A helper for the comparison operators that computes
		which Operations method to call for them.
	*/
	function compileComparisonOperator(token) {
		if (token.type === "inequality") {
			let operation = token.operator;
			return (token.negate ? ({
					'>' :     '<=',
					'<' :     '>=',
					'>=':     '<',
					'<=':     '>',
				}[operation]) : operation);
		}
		else {
			return token.type;
		}
	}

	/*
		A helper which performs compileComparisonOperator(), then returns the inverse of
		the compiled operation. Used in the "and" and "or" operator compilation
		to flip child comparisons.
	*/
	function invertComparisonOperator(token) {
		const type = compileComparisonOperator(token);
		return ({
			'>' :     '<',
			'<' :     '>',
			'>=':     '<=',
			'<=':     '>=',
			contains: "isIn",
			isIn:     "contains",
			is:       "isNot",
			isNot:    "is",
		}[type]);
	}
	
	/*
		This takes an array from TwineMarkup, rooted at an expression,
		and returns raw Javascript code for the expression's execution.
		
		@param {Array} The tokens array.
		@param {Boolean} Whether the returned expression should be a VarRef.
		@return {String} String of Javascript code.
	*/
	function compile(tokens, isVarRef) {
		// Convert tokens to a 1-size array if it's just a single non-array.
		tokens = [].concat(tokens);
		/*
			Recursive base case: no tokens.
			Any behaviour that should be done in the event of no tokens
			must be performed elsewhere.
		*/
		if (!tokens.length) {
			return "";
		}
		/*
			Obtain the first token, which is used for several base-cases in this function,
			such as the one below.
		*/
		let token = tokens[0];
		/*
			Potential early return if we're at a leaf node.
		*/
		if (tokens.length === 1) {
			if (token.type === "identifier") {
				if (isVarRef) {
					return "VarRef.create(Operations.Identifiers," + toJSLiteral(token.text) + ")";
				}
				return " Operations.Identifiers." + token.text.toLowerCase() + " ";
			}
			else if (token.type === "variable") {
				return "VarRef.create(State.variables,"
					+ toJSLiteral(token.name)
					+ ")" + (isVarRef ? "" : ".get()");
			}
			else if (token.type === "tempVariable") {
				return "VarRef.create(section.stack[0].tempVariables,"
					+ toJSLiteral(token.name)
					+ ")" + (isVarRef ? "" : ".get()");
			}
			else if (token.type === "hookRef") {
				/*
					Some remarks:
					
					1. Note that the 'section' is that provided by the environ,
					and is not the Section prototype.
					2. The ? sigil is needed to distinguish the hook name
					from a pseudo-hook selector string.
				*/
				if (isVarRef) {
					/*
						Assignments to hookRefs assign text to all of their matching hooks.
						
						TwineScript_Assignee is a setter accessor used as a TwineScript
						assignment interface.
					*/
					return "VarRef.create(section.selectHook('?" + token.name + "'), 'TwineScript_Assignee')";
				}
				return " section.selectHook('?" + token.name + "') ";
			}
			else if (token.type === "string") {
				/*
					Note that this is entirely reliant on the fact that TwineScript string
					literals are currently exactly equal to JS string literals (minus template
					strings and newlines).
				*/
				return token.text.replace(/\n/g, "\\n");
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
			Obtain the least precedent token, its index i, and its type.
		*/
		let i;
		[token, i] = precedentToken(tokens, "least");
		const type = (token || {}).type;

		let
			/*
				These hold the returned compilations of the tokens
				surrounding a matched token, as part of this function's
				recursive descent.
			*/
			left, right,
			/*
				Setting values to either of these variables
				determines the code to emit:
				- for midString, a plain JS infix operation between left and right;
				- for operation, an Operations method call with left and right as arguments.
				- for assignment, an AssignmentRequest.
				- for possessive, a special VarRef.create() call.
			*/
			midString, operation, assignment, possessive,
			/*
				Some operators should present a simple error when one of their sides is missing.
			*/
			needsLeft = true, needsRight = true,
			/*
				Some JS operators, like >, don't automatically work when the other side
				is absent, even when people expect them to. e.g. $var > 3 and < 5 (which is
				legal in Inform 6). To cope, I implicitly convert a blank left side to
				"it", which is the nearest previous left-hand operand.
			*/
			implicitLeftIt = false;

		if (!type) {
			/*
				If no token was found, skip the rest of these checks.
			*/
		}
		/*
			I'll admit it: I'm not yet sure what place the JS comma will have in
			TwineScript. As of right now, let's just pass it through
			at the correct precedence, and require both sides.
		*/
		else if (type === "comma") {
			midString = ",";
			/*
				Unlike Javascript, Harlowe allows trailing commas in calls.
			*/
			needsRight = false;
		}
		else if (type === "spread") {
			/*
				Whether or not this actually makes sense as a "mid"string
				is probably easily disputed.
			*/
			midString = "Operations.makeSpreader(";
			right =
				compile(tokens.slice(i + 1))
				+ ")";
			needsLeft = false;
		}
		else if (type === "to") {
			assignment = "to";
			right = compile(tokens.slice(i + 1), "varRef");
			left  = "Operations.setIt(" + compile(tokens.slice(0,  i), "varRef") + ")";
		}
		else if (type === "into") {
			assignment = "into";
			right = compile(tokens.slice(0,  i), "varRef");
			left  = "Operations.setIt(" + compile(tokens.slice(i + 1), "varRef") + ")";
		}
		else if (type === "where" || type === "via") {
			left = "Lambda.create("
				+ compile(tokens.slice(0, i), "varRef")
				+ ",";
			midString = toJSLiteral(token.type)
				+ ",";
			right = toJSLiteral(compile(tokens.slice(i + 1)))
				+ ")";
		}
		else if (type === "with" || type === "making") {
			/*
				This token requires that whitespace + a temp variable be to the right of it.
			*/
			const rightTokens = tokens.slice(i + 1);
			if ([2,3].indexOf(rightTokens.length) === -1 || rightTokens[0].type !== "whitespace" || rightTokens[1].type !== "tempVariable"
					|| (rightTokens[2] && rightTokens[2].type !== "whitespace")) {
				left = "TwineError.create('operation','I need a temporary variable to the right of \\'";
				midString = token.type;
				right = "\\'.')";
			}
			else {
				left = "Lambda.create("
					+ compile(tokens.slice(0, i), "varRef")
					+ ",";
				midString = toJSLiteral(token.type)
					+ ",";
				right = toJSLiteral(rightTokens[1].name)
					+ ")";
			}
		}
		/*
			I'm also not sure if augmented assignment is strictly necessary given that
			one can do (set: $x to it+1), and += is sort of an overly abstract token.
		*/
		else if (type === "augmentedAssign") {
			assignment = token.operator;
			left  = compile(tokens.slice(0,  i), "varRef");
			/*
				This line converts the "b" in "a += b" into "a + b" (for instance),
				thus partially de-sugaring the augmented assignment.
				
				Note that the left tokens must be compiled again, as a non-varRef this time.
				
				Note also that this assumes the token's assignment property corresponds to
				a binary-arity Operation method name.
			*/
			right = "Operations['" + assignment + "']("
				+ (compile(tokens.slice(0,  i)) + ","
				+  compile(tokens.slice(i + 1))) + ")";
		}
		/*
			The following are the logical arithmetic operators.
		*/
		else if (type === "and" || type === "or") {
			const
				[leftSide]              = precedentToken(tokens.slice(0,  i), "least"),
				[rightSide, ri]         = precedentToken(tokens.slice(i + 1), "least"),
				comparisonOperator = ['inequality','is','isNot','isIn','contains'],
				leftIsComparison = comparisonOperator.indexOf(leftSide && leftSide.type) > -1,
				rightIsComparison = comparisonOperator.indexOf(rightSide && rightSide.type) > -1;
			/*
				Since the index passed by mostPrecedentToken() is relative to the passed-in slice,
				use ri to produce an index into the full tokens array.
			*/
			const rightIndex = ri + i + 1;
			/*
				If the left side is a comparison operator, and the right side is not,
				wrap the right side in an elidedComparisonOperator call.
				This transforms statements like (if: $a > 2 and 3) into (if: $a > 2 and it > 3).
			*/
			if (leftIsComparison && !rightIsComparison) {
				right = "Operations.elidedComparisonOperator("
					+ toJSLiteral(compileComparisonOperator(leftSide)) + ","
					+ compile(tokens.slice(i + 1))
					+ ")";
			}
			/*
				If the right side is a comparsion operator, and the left side is not,
				swap the left and right sides, invert the right (left) side, then perform the above.
				This transforms statements like (if: $a and $b < 3) into (if: 3 >= $b and it >= $a).
			*/
			else if (!leftIsComparison && rightIsComparison) {
				right = "Operations.elidedComparisonOperator("
					+ toJSLiteral(invertComparisonOperator(rightSide)) + ","
					+ compile(tokens.slice(0, i))
					+ ")";
				/*
					The following additional action swaps the tokens to the right and left of rightSide,
					and changes rightSide's type into its inverse. This changes ($b < 3) into (3 > $b),
					and thus alters the It value of the expression from $b to 3.
					This could cause issues when "it" is used explicitly in the expression, but frankly such
					uses are already kinda nonsensical ("(if: $a is in it and $b)"?).
				*/
				left =
					compile([
						...tokens.slice(rightIndex + 1),
						// Create a copy of rightSide with the type changed, rather than mutate it in-place.
						Object.assign(Object.create(rightSide), {
							[rightSide.type === "inequality" ? "operator" : "type"]:
								invertComparisonOperator(rightSide),
						}),
						...tokens.slice(i + 1, rightIndex),
					]);
			}
			operation = token.type;
		}
		/*
			The following are the comparison operators.
		*/
		else if (type === "is" || type === "isNot" || type === "contains" || type === "isIn" || type === "inequality") {
			implicitLeftIt = true;
			operation = compileComparisonOperator(token);
		}
		else if (type === "addition" || type === "subtraction") {
			operation = token.text;
			/*
				Since +- arithmetic operators can also be unary,
				we must, in those cases, change the left token to 0 if
				it doesn't exist.
				This would ideally be an "implicitLeftZero", but, well...
			*/
			left  = compile(tokens.slice(0,  i));
			/*
				If only whitespace is to the left of this operator, then...
			*/
			if (!left.trim()) {
				left = "0";
			}
		}
		else if (type === "multiplication" || type === "division") {
			operation = token.text;
		}
		else if (type === "not") {
			midString = " ";
			right = "Operations.not("
				+ compile(tokens.slice(i + 1))
				+ ")";
			needsLeft = false;
		}
		else if (type === "belongingProperty") {
			/*
				As with the preceding case, we need to manually wrap the variable side
				inside the Operations.get() call, while leaving the other side as is.
			*/
			right = "VarRef.create("
				/*
					belongingProperties place the variable on the right.
				*/
				+ compile(tokens.slice (i + 1), "varref")
				+ ","
				/*
					Utils.toJSLiteral() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ toJSLiteral(token.name) + ")"
				+ (isVarRef ? "" : ".get()");
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if (type === "belongingOperator" || type === "belongingItOperator") {
			if (token.type.includes("It")) {
				right = "Operations.Identifiers.it";
				needsRight = false;
			}
			else {
				// Since, as with belonging properties, the variable is on the right,
				// we must compile the right side as a varref.
				right = compile(tokens.slice (i + 1), "varref");
			}
			possessive = "belonging";
		}
		/*
			Notice that this one is right-associative instead of left-associative.
			This must be so because, by branching on the rightmost token, it will compile to:
				VarRef.create(VarRef.create(a,1).get(),2).get()
			instead of the incorrect:
				VarRef.create(a,1).get() VarRef.create(,2).get()
		*/
		else if (type === "property") {
			/*
				This is somewhat tricky - we need to manually wrap the left side
				inside the Operations.get() call, while leaving the right side as is.
			*/
			left = "VarRef.create("
				+ compile(tokens.slice(0, i), "varref")
				+ ","
				/*
					Utils.toJSLiteral() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ toJSLiteral(token.name) + ")"
				+ (isVarRef ? "" : ".get()");
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if (type === "itsProperty" || type === "belongingItProperty") {
			/*
				This is actually identical to the above, but with the difference that
				there is no left subtoken (it is always Identifiers.it).
			*/
			left = "VarRef.create(Operations.Identifiers.it,"
				+ toJSLiteral(token.name) + ").get()";
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if (type === "possessiveOperator" || type === "itsOperator") {
			if (token.type.includes("it")) {
				left = "Operations.Identifiers.it";
				needsLeft = false;
			}
			possessive = "possessive";
		}
		else if (type === "twineLink") {
			/*
				This crudely desugars the twineLink token into a
				(link-goto:) token, in a manner similar to that in Renderer.
			*/
			midString = 'Macros.run("link-goto", [section,'
				+ toJSLiteral(token.innerText) + ","
				+ toJSLiteral(token.passage) + "])";
			needsLeft = needsRight = false;
		}
		else if (type === "macro") {
			/*
				The first child token in a macro is always the method name.
			*/
			const macroNameToken = token.children[0];
			if(macroNameToken.type !== "macroName") {
				impossible('Compiler.compile', 'macro token had no macroName child token');
			}
			
			midString = 'Macros.run('
				/*
					The macro name, if it constitutes a method call, contains a
					variable expression representing which function should be called.
					Operations.runMacro will, if given a function instead of a string
					identifier, run the function in place of a macro's fn.
				*/
				+ (macroNameToken.isMethodCall
					? compile(macroNameToken.children)
					: '"' + token.name + '"'
				)
				/*
					The arguments given to a macro instance are given in an array.
				*/
				+ ', ['
				/*
					The first argument to macros must be the current section,
					so as to give the macros' functions access to data
					about the runtime state (such as, whether this expression
					is nested within another one).
				*/
				+ "section,"
				/*
					You may notice here, unseen, is the assumption that Javascript array literals
					and TwineScript macro invocations use the same character to separate arguments/items.
					(That, of course, being the comma - (macro: 1,2,3) vs [1,2,3].)
					This is currently true, but it is nonetheless a fairly bold assumption.
				*/
				+ compile(token.children.slice(1))
				+ '])';
			needsLeft = needsRight = false;
		}
		else if (type === "grouping") {
			midString = "(" + compile(token.children, isVarRef) + ")";
			needsLeft = needsRight = false;
		}
		/*
			If a token was found, we can recursively
			compile those next to it.
		*/
		if (i > -1) {
			/*
				Any of the comparisons above could have provided specific
				values for left and right, but usually they will just be
				the tokens to the left and right of the matched one.
			*/
			left  = left  || (compile(tokens.slice(0,  i), isVarRef)).trim();
			right = right || (compile(tokens.slice(i + 1))).trim();
			/*
				The compiler should implicitly insert the "it" keyword when the
				left-hand-side of a comparison operator was omitted.
			*/
			if (implicitLeftIt && !(left)) {
				left = " Operations.Identifiers.it ";
			}
			/*
				If there is no implicitLeftIt, produce an error message.
			*/
			if ((needsLeft && !left) || (needsRight && !right)) {
				return "TwineError.create('operation','I need some code to be "
					+ (needsLeft ? "left " : "")
					+ (needsLeft && needsRight ? "and " : "")
					+ (needsRight ? "right " : "")
					+ "of "
					+ '"' + token.text + '"'
					+ "')";
			}

			if (midString) {
				return left + midString + right;
			}
			else if (assignment) {
				return "Operations.makeAssignmentRequest("
					+ [left, right, toJSLiteral(assignment)]
					+ ")";
			}
			else if (possessive) {
				return "VarRef.create("
					+ (possessive === "belonging" ? right : left)
					+ ",{computed:true,value:"
					+ (possessive === "belonging" ? left : right)
					+ "})"
					+ (isVarRef ? "" : ".get()");
			}
			else if (operation) {
				return " Operations[" + toJSLiteral(operation) + "](" + left + "," + right + ") ";
			}
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else if (tokens.length === 1) {
			/*
				This should default to a " " so that some separation lies between tokens.
				Otherwise, some tokens like "contains" will break in certain (rare) circumstances.
			*/
			return (('value' in tokens[0] ? tokens[0].value : tokens[0].text) + "").trim() || " ";
		}
		else {
			return tokens.reduce((a, token) => a + compile(token, isVarRef), "");
		}
		return "";
	}
	
	return compile;
});
