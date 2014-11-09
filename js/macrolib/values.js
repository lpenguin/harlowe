define(['macros', 'utils', 'state', 'story', 'engine', 'datatypes/assignmentRequest'],
function(Macros, Utils, State, Story, Engine, AssignmentRequest) {
	"use strict";
	/*
		Built-in value macros.
		This module modifies the Macros module only, and exports nothing.
		
			State mutation:
		set
		put
		move
		
			Type coercion:
		text / print
		num / number
		a / array
		
			Mathematics:
		min
		max
		abs
		sign
		sin
		cos
		tan
		floor
		round
		ceil
		pow
		exp
		sqrt
		log
		log10
		log2
		
			Randomness:
		random
		either
		anyof
		
			Stateful boolean:
		if
		unless
		elseif
		else
		
			System time querying:
		weekday
		monthday
		currenttime
		currentdate
		
			State querying:
		visited
		previous

			Window querying:
		pageURL
		
			User input:
		prompt
		confirm
		
			Statements:
		goto
		alert
		openURL
		reload
		gotoURL
	*/
	
	var
		rest = Macros.TypeSignature.rest,
		optional = Macros.TypeSignature.optional,
		zeroOrMore = Macros.TypeSignature.zeroOrMore,
		Any = Macros.TypeSignature.Any;
	
	Macros.addValue
		/*
			(set:) Set Twine variables.
			Evaluates to nothing.
		*/
		("set", function set(_, assignmentRequests /*variadic*/) {
			var i, ar;
			
			assignmentRequests = Array.prototype.slice.call(arguments, 1);
			
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(i = 0; i < assignmentRequests.length; i+=1) {
				ar = assignmentRequests[i];
				
				if (ar.operator === "into") {
					return new SyntaxError("Please say 'to' when using the (set:) macro.");
				}
				ar.dest.set(ar.src);
			}
			return "";
		},
		[rest(AssignmentRequest)])
		
		/*
			(put:) A left-to-right version of (set:) that requires the "into" operator.
			Evaluates to nothing if no error occured.
			TODO: mix this into the (set:) definition.
		*/
		("put", function put(_, assignmentRequests) {
			var i, ar;
			
			assignmentRequests = Array.prototype.slice.call(arguments, 1);
			
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(i = 0; i < assignmentRequests.length; i+=1) {
				ar = assignmentRequests[i];
				
				if (ar.operator === "to") {
					return new SyntaxError("Please say 'into' when using the (put:) macro.");
				}
				ar.dest.set(ar.src);
			}
			return "";
		},
		[rest(AssignmentRequest)])
		
		/*
			(move:) A variant of (put:) that deletes the source's binding after
			performing the operation. Ideally used as an equivalent
			to Javascript's "x = arr.pop();"
		*/
		("move", function move(_, ar) {
			var get, error;
			
			if (ar.src && ar.src.varref) {
				get = ar.src.get();
				if ((error = Utils.containsError(get))) {
					return error;
				}
				ar.dest.set(get);
				ar.src.delete();
			}
			else {
				/*
					Fallback behaviour: when phrased as
					(move: 2 into $red)
				*/
				ar.dest.set(ar.src);
			}
			return "";
		},
		// (put: is variadic)
		[rest(AssignmentRequest)])

		/*
			(print:), (text:): convert the expression to text.
			This provides explicit coercion to String for TwineScript values.
			Evaluates to a text string.
		*/
		(["print", "text"], function print(_, expr) {
			return expr+"";
		},
		// (print: accepts 1 anything)
		[Any])

		/*
			(num:), (number:)
			This provides explicit coercion to Number.
		*/
		(["num", "number"], function number(_, expr) {
			return +expr;
		},
		// (num: accepts 1 anything)
		[Any])
		
		/*
			(if:) converts the expression to boolean, affecting subsequent
			else() and elseif() calls. Evaluates to a boolean.
		
			The (if:) macro family currently determines (else:) and (elseif:)
			by remembering the previous if() result. By "remembering", I
			mean it puts a fresh expando property, "lastIf", on the section's
			expression stack.
			
			TODO: Should this actually be a Changer?? For instance:
			(set: $robotAdvice to (font:Consolas) + (if: $choseTheRobot))
		*/
		("if", function _if(section, expr) {
			/*
				This and unless() both set the lastIf expando
				property. Whatever was there last is no longer
				relevant, just as consecutive if()s have no
				bearing on one another.
			*/
			return !!(section.stack[0].lastIf = !!expr);
		},
		// (if: accepts 1 anything)
		[Any])
		
		/*
			(unless:) the negated form of if().
			Evaluates to a boolean.
		*/
		("unless", function unless(section, expr) {
			return !!(section.stack[0].lastIf = !expr);
		},
		[Any])
		
		/*
			(elseif:) only true if the previous if() was false,
			and its own expression is true.
			Evaluates to a boolean.
		*/
		("elseif", function elseif(section, expr) {
			/*
				This and else() check the lastIf expando
				property, if present.
			*/
			return (!section.stack[0].lastIf && (section.stack[0].lastIf = !!expr));
		},
		[Any])
		
		/*
			(else:) only true if the previous if() was false.
			Evaluates to a boolean.
		*/
		("else", function _else(section) {
			return !section.stack[0].lastIf;
		},
		[Any]);

	/*
		JS library wrapper macros
	*/
	
	/*
		Filter out NaN and Infinities, throwing an error instead.
		This is only applied to functions that can create non-numerics,
		namely log, sqrt, etc.
	*/
	function mathFilter (fn) {
		return function () {
			var result = fn.apply(this, arguments);
			if (typeof result !== "number" || isNaN(result)) {
				throw new RangeError("math result is " + result);
			}
			return result;
		};
	}
	
	/*
		Choose one argument, up to 16. Can be used as such: (either: "pantry", "larder", "cupboard" )
	*/
	function either() {
		return arguments[~~(Math.random() * arguments.length)];
	}
	
	({
		/*
			Wrappers for Date
		*/

		// The current weekday, in full
		weekday: [function () {
			return ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day";
		},
		// 0 args
		null],

		// The current day number
		monthday: [function () {
			return new Date().getDate();
		},
		null],

		// The current time in 12-hour hours:minutes format.
		currenttime: [function () {
			var d = new Date(),
				am = d.getHours() < 12;

			return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
		},
		null],

		// The current date in DateString format (eg. "Thu Jan 01 1970").
		currentdate: [function () {
			return new Date().toDateString();
		},
		null],

		/*
			Wrappers for basic Math
			(includes ES6 polyfills)
		*/

		min: [Math.min, rest(Number)],
		max: [Math.max, rest(Number)],
		abs: [Math.abs, Number],
		sign: [Math.sign || function (val) {
			return (typeof val !== "number" || isNaN(val)) ? val : Math.max(-1, Math.min(1, Math.ceil(val)));
		}, Number],
		sin:    [Math.sin, Number],
		cos:    [Math.cos, Number],
		tan:    [Math.tan, Number],
		floor:  [Math.floor, Number],
		round:  [Math.round, Number],
		ceil:   [Math.ceil, Number],
		pow:    [Math.pow, Number],
		exp:    [Math.exp, Number],
		sqrt:   [mathFilter(Math.sqrt), Number],
		log:    [mathFilter(Math.log), Number],
		log10:  [mathFilter(Math.log10 || function (value) {
			return Math.log(value) * (1 / Math.LN10);
		}), Number],
		log2:   [mathFilter(Math.log2 || function (value) {
			return Math.log(value) * (1 / Math.LN2);
		}), Number],

		/*
			Basic randomness
		*/

		/*
			A random integer function
			1 argument: random int from 0 to a inclusive
			2 arguments: random int from a to b inclusive (order irrelevant)
			Identical to Twine 1's version.
		*/
		random: [function random(a, b) {
			var from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = Math.min(a, b);
				to = Math.max(a, b);
			}
			to += 1;
			return ~~((Math.random() * (to - from))) + from;
		}, [Number, Number]],
		
		either: [either, rest(Any)],
		
		/*
			Array/Sequence macros
		*/
		
		/*
			(a:), (array:)
			Used for creating Array literals.
			TODO: Make it "concat-spread" arrays passed into it??
		*/
		a:     [Array.of, zeroOrMore(Any)],
		array: [Array.of, zeroOrMore(Any)],
		
		/*
			(any-of:)
			Similar to (either:), but flattens arrays to retrieve a random value.
			(either:) originally implicitly did this in Twine 1, but now it's 
			more explicit, to enable better-sounding expressions,
			like (print: (any-of: $bag))
		*/
		anyof: [function any_of() {
			if(arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return either.apply(this, arguments[0]);
				}
				return arguments[0];
			}
			return any_of(either.apply(this, arguments));
		},
		Array],

		/*
			Wrappers for state
		*/

		// Return the number of times the named passage was visited.
		// For multiple arguments, return the smallest visited value.
		visited: [function visited(name) {
			var ret, i;
			if (arguments.length > 1) {
				for (i = 0, ret = State.pastLength; i < arguments.length; i++) {
					ret = Math.min(ret, visited(arguments[i]));
				}
				return ret;
			}
			return name ? State.passageNameVisited(name) : State.passageIDVisited(State.passage);
		},
		// TODO: Ugh, why is this the only macro with 0-1 arity?
		optional(String)],
		
		// Return the name of the previous visited passage.
		previous: [function previous() {
			return Story.getPassageName(State.previousPassage() || Story.startPassage);
		},
		null],

		/*
			Wrappers for engine.
			I kinda want to make this lazily return a "GotoCommand" or something.
		*/

		goto: [function (name) {
			name = Story.passageNamed(name);
			if (!name) {
				return new RangeError("There's no passage named '" + name + "'.");
			}
			return Engine.goToPassage(name);
		},
		String],

		/*
			Wrappers for Window
		*/

		// Keep "undefined" from being the default text.
		alert: [function (text) {
			return window.alert(text || "");
		},
		String],
		prompt: [function (text, value) {
			return window.prompt(text || "", value || "") || "";
		},
		String, String],
		confirm: [function (text) {
			return window.confirm(text || "");
		},
		String],
		openURL: [window.open, String],
		reload: [window.location.reload, null],
		gotoURL: [window.location.assign, String],
		pageURL: [function () {
			return window.location.href;
		}, null],
		
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		"": function() {
			Object.keys(this).forEach(function(key) {
				var fn, typeSignature;
				
				if (key) {
					fn = this[key][0],
					typeSignature = this[key][1];
					
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					Macros.addValue(key, function(/* variadic */) {
						/*
							As none of the above actually need or use section,
							we can safely discard it.
							
							Aside: in ES6 this function would be:
							(section, ...rest) => this[key](...rest)
						*/
						return fn.apply(0, Array.from(arguments).slice(1));
					}.bind(this), typeSignature);
				}
			}.bind(this));
		}
	}[""]());
	
});
