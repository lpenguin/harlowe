define(['macros', 'utils/operationutils', 'internaltypes/twineerror'],
(Macros, {subset, objectName}, TwineError) => {
	"use strict";
	/*
		Built-in value macros.
		These macros manipulate the primitive values - boolean, string, number.
	*/
	
	const
		{rest, zeroOrMore,
		/* Any is a value, not a method. */
		Any} = Macros.TypeSignature;
	
	Macros.add
		/*d:
			String data
			
			A string is just a block of text - a bunch of text characters strung together.
			
			When making a story, you'll mostly work with strings that you intend to insert into
			the passage source. If a string contains markup, then the markup will be processed when it's
			inserted. For instance, `"The ''biiiiig'' bellyblob"` will print as "The <b>biiiiig</b> bellyblob".
			Even macro calls inside strings will be processed: printing `"The (print:2+3) bears"` will print "The 6 bears".
			If you wish to avoid this, simply include the verbatim markup inside the string:``"`It's (exactly: as planned)`"`` will
			print "It's (exactly: as planned)".
			
			You can add strings together to join them: `"The" + ' former ' + "Prime Minister's"`
			pushes the strings together, and evaluates to "The former Prime Minister's". Notice
			that spaces had to be added between the words in order to produce a properly spaced final string.
			Also, notice that you can only add strings together. You can't subtract them, much less multiply or divide them.
			
			Strings are similar to arrays, in that their individual characters can be accessed: `"ABC"'s 1st` evaluates to "A",
			and `"Exeunt"'s last` evaluates to "t". They, too, have a "length": `"Marathon"'s length` is 8. Also, you can use
			the `contains` and `is in` operators to see if a certain string is contained within another.

			To summarise, here are the operations you can perform on strings.

			| Operator | Function | Example
			|---
			| `+` | Joining. | `"A" + "Z"` (is "AZ")
			| `is` | Evaluates to boolean `true` if both sides are equal, otherwise `false`. | `$name is "Frederika"`
			| `is not` | Evaluates to boolean `true` if both sides are not equal, otherwise `false`. | `$friends is not $enemies`
			| `contains` | Evaluates to boolean `true` if the left side contains the right side, otherwise `false`. | `"Fear" contains "ear"`
			| `is in` | Checking if the right string contains the left string, otherwise `false`. | `"ugh" is in "Through"`
			| `'s` | Obtaining the character at the right numeric position. | `"YO"'s 1st` (is "Y")<br>`"PS"'s (2)` (is "S")
			| `of` | Obtaining the character at the left numeric position. | `1st of "YO"` (is "Y")<br>`(2) of "PS"` (is "S")
		*/
		/*d:
			(text: [Number or String or Boolean or Array]...) -> String
			Also known as: (string:)
			
			(text:) accepts any amount of expressions and tries to convert them all
			to a single String.
			
			Example usages:
			* `(text: $cash + 200)`
			* `(if: (text: $cash)'s length > 3)[Phew! Over four digits!]`
			
			Rationale:
			Unlike in Twine 1, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to. This extra carefulness decreases
			the likelihood of unusual bugs creeping into stories (such as adding 1 and "22"
			and getting "122"). The (text:) macro (along with (num:)) is how you can convert
			non-string values to a string.
			
			Details:
			This macro can also be used much like the (print:) macro - as it evaluates to a
			string, and strings can be placed in the story source freely,
			
			If you give an array to (text:), it will attempt to convert every element
			contained in the array to a String, and then join them up with commas. So,
			`(text: (a: 2, "Hot", 4, "U"))` will result in the string "2,Hot,4,U".
			
			See also:
			(num:)
		*/
		(["text", "string"],
			/*
				Since only primitives (and arrays) are passed into this, and we use
				JS's default toString() for primitives, we don't need
				to do anything more than join() the array.
			*/
			(_, ...args) => args.join(''),
		// (text: accepts a lot of any primitive)
		[zeroOrMore(Macros.TypeSignature.either(String, Number, Boolean, Array))])

		/*d:
			(substring: String, Number, Number) -> String
			
			This macro produces a substring of the given string, cut from two *inclusive* number positions.
			
			Example usage:
			`(substring: "growl", 3, 5)` (results in the string "owl").
			
			Rationale:
			If you need to examine a portion of a string between certain character positions, or
			wanted to strip off a known number of characters from either end of a string,
			this macro can be used. Simply provide it with the string itself, then the number position
			of the leftmost character of the substring, then the position of the rightmost character.
			
			Details:
			If you provide negative numbers, they will be treated as being offset from the end
			of the string - `-2` will specify the `2ndlast` character, just as 2 will specify
			the `2nd` character.
			
			If the last number given is larger than the first (for instance, in `(substring: "hewed", 4, 2)`)
			then the macro will still work - in that case returning "ewe" as if the numbers were in
			the correct order.
			
			See also:
			(subarray:)
		*/
		("substring", (_, string, a, b) => subset(string, a, b),
		[String, Number, Number])
		
		/*d:
			Number data
			
			Number data is just numbers, which you can perform basic mathematical calculations with.
			You'll generally use numbers to keep track of statistics for characters, count how many times
			an event has occurred, and numerous other uses.
			
			You can do all the basic mathematical operations you'd expect to numbers:
			`(1 + 2) / 0.25 + (3 + 2) * 0.2` evaluates to the number 13. The computer follows the normal order of
			operations in mathematics: first multiplying and dividing, then adding and subtracting. You can group
			subexpressions together and force them to be evaluated first with parentheses.
			
			If you're not familiar with some of those symbols, here's a review, along with various other operations you can perform.
			
			| Operator | Function | Example
			|---
			| `+` | Addition. | `5 + 5` (is 10)
			| `-` | Subtraction.  Can also be used to negate a number. | `5 - -5` (is 10)
			| `*` | Multiplication. | `5 * 5` (is 25)
			| `/` | Division. | `5 / 5` (is 1)
			| `%` | Modulo (remainder of a division). | `5 % 26` (is 1)
			| `>` | Evaluates to boolean `true` if the left side is greater than the right side, otherwise `false`. | `$money > 3.75`
			| `>=` | Evaluates to boolean `true` if the left side is greater than or equal to the right side, otherwise `false`. | `$apples >= $carrots + 5`
			| `<` | Evaluates to boolean `true` if the left side is less than the right side, otherwise `false`. | `$shoes < $people * 2`
			| `<=` | Evaluates to boolean `true` if the left side is less than or equal to the right side, otherwise `false`. | `65 <= $age`
			
			You can only perform these operations (apart from `is`) on two pieces of data if they're both numbers. Adding the
			string "5" to the number 2 would produce an error, and not the number 7 nor the string "52". You must
			convert one side or the other using the (num:) or (text:) macros.
		*/
		/*d:
			(num: String) -> Number
			Also known as: (number:)
			
			This macro converts strings to numbers by reading the digits in the entire
			string. It can handle decimal fractions and negative numbers.
			If any letters or other unusual characters appear in the number, it will
			result in an error.
			
			Example usage:
			`(num: "25")` results in the number `25`.
			
			Rationale:
			Unlike in Twine 1, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to using macros such as this. This extra
			carefulness decreases the likelihood of unusual bugs creeping into stories
			(such as performing `"Eggs: " + 2 + 1` and getting `"Eggs: 21"`).
			
			Usually, you will only work with numbers and strings of your own creation, but
			if you're receiving user input and need to perform arithmetic on it,
			this macro will be necessary.
			
			See also:
			(text:)
		*/
		(["num", "number"], (_, expr) => {
			/*
				This simply uses JS's toNumber conversion, meaning that
				decimals and leading spaces are handled, but leading letters etc. are not.
			*/
			if (Number.isNaN(+expr)) {
				return TwineError.create("macrocall", "I couldn't convert " + objectName(expr)
					+ " to a number.");
			}
			return +expr;
		},
		[String])
		;
		/*d:
			Boolean data
			
			Computers can perform more than just mathematical tasks - they are also virtuosos in classical logic. Much as how
			arithmetic involves manipulating numbers with addition, multiplication and such, logic involves manipulating the
			values `true` and `false` using its own operators. Those are not text strings - they are values as fundamental as
			the natural numbers. In computer science, they are both called **Booleans**, after the 19th century mathematician
			George Boole.
			
			`is` is a logical operator. Just as + adds the two numbers on each side of it, `is` compares two values on each
			side and evaluates to `true` or `false` depending on whether they're identical. It works equally well with strings,
			numbers, arrays, and anything else, but beware - the string `"2"` is not equal to the number 2.
			
			There are several other logical operators available.
			
			| Operator | Purpose | Example
			|---
			| `is` | Evaluates to `true` if both sides are equal, otherwise `false`. | `$bullets is 5`
			| `is not` | Evaluates to `true` if both sides are not equal. | `$friends is not $enemies`
			| `contains` | Evaluates to `true` if the left side contains the right side. | `"Fear" contains "ear"`
			| `is in` | Evaluates to `true` if the right side contains the left side. | `"ugh" is in "Through"`
			| `>` | Evaluates to `true` if the left side is greater than the right side. | `$money > 3.75`
			| `>=` | Evaluates to `true` if the left side is greater than or equal to the right side. | `$apples >= $carrots + 5`
			| `<` | Evaluates to `true` if the left side is less than the right side. | `$shoes < $people * 2`
			| `<=` | Evaluates to `true` if the left side is less than or equal to the right side. | `65 <= $age`
			| `and` | Evaluates to `true` if both sides evaluates to `true`. | `$hasFriends and $hasFamily`
			| `or` | Evaluates to `true` if either side is `true`. | `$fruit or $vegetable`
			| `not` | Flips a `true` value to a `false` value, and vice versa. | `not $stabbed`
			
			Conditions can quickly become complicated. The best way to keep things straight is to use parentheses to
			group things.
		*/

	/*
		JS library wrapper macros
	*/
	
	/*
		Filter out NaN and Infinities, throwing an error instead.
		This is only applied to functions that can create non-numerics,
		namely log, sqrt, etc.
	*/
	function mathFilter (fn) {
		return (args) => {
			const result = fn(...args);
			if (typeof result !== "number" || isNaN(result)) {
				return TwineError.create("macrocall", "This mathematical expression doesn't compute!");
			}
			return result;
		};
	}
	
	/*
		Choose one argument. Can be used as such: (either: "pantry", "larder", "cupboard" )
	*/
	function either(...args) {
		return args[~~(Math.random() * args.length)];
	}
	
	({
		/*
			Wrappers for Date
		*/

		// The current weekday, in full
		weekday: [() => ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day",
		// 0 args
		null],

		// The current day number
		monthday: [() => new Date().getDate(),
		null],

		// The current time in 12-hour hours:minutes format.
		currenttime: [() => {
			const d = new Date(),
				am = d.getHours() < 12;

			return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
		},
		null],

		// The current date in DateString format (eg. "Thu Jan 01 1970").
		currentdate: [() => {
			return new Date().toDateString();
		},
		null],

		/*
			Wrappers for basic Math
			(includes ES6 polyfills)
		*/

		/*d:
			(min: ...Number) -> Number

			This maths macro accepts numbers, and evaluates to the lowest valued number.

			Example usage:
			`(min: 2, -5, 2, 7, 0.1)` produces -5.
		*/
		min: [Math.min, rest(Number)],
		/*d:
			(max: ...Number) -> Number

			This maths macro accepts numbers, and evaluates to the highest valued number.

			Example usage:
			`(max: 2, -5, 2, 7, 0.1)` produces 7.
		*/
		max: [Math.max, rest(Number)],
		/*d:
			(abs: Number) -> Number

			This maths macro finds the absolute value of a number (without the sign).

			Example usage:
			`(abs: -4)` produces 4.
		*/
		abs: [Math.abs, Number],
		/*d:
			(sign: Number) -> Number

			This maths macro produces -1 when given a negative number, 0 when given 0, and 1
			when given a positive number.

			Example usage:
			`(sign: -4)` produces -1.
		*/
		sign: [Math.sign, Number],
		/*d:
			(sin: Number) -> Number

			This maths macro computes the sine of the given number of radians.

			Example usage:
			`(sin: 3.14159265 / 2)` produces 1.
		*/
		sin:    [Math.sin, Number],
		/*d:
			(cos: Number) -> Number

			This maths macro computes the cosine of the given number of radians.

			Example usage:
			`(cos: 3.14159265)` produces -1.
		*/
		cos:    [Math.cos, Number],
		/*d:
			(tan: Number) -> Number

			This maths macro computes the tangent of the given number of radians.

			Example usage:
			`(tan: 3.14159265 / 4)` produces approximately 1.
		*/
		tan:    [Math.tan, Number],
		/*d:
			(floor: Number) -> Number

			This maths macro rounds the given number downward.

			Example usage:
			`(floor: 1.99)` produces 1.
		*/
		floor:  [Math.floor, Number],
		/*d:
			(round: Number) -> Number

			This maths macro rounds the given number - downward if its decimals are smaller
			than 0.5, and upward otherwise.

			Example usage:
			`(round: 1.5)` produces 2.
		*/
		round:  [Math.round, Number],
		/*d:
			(ceil: Number) -> Number

			This maths macro rounds the given number upward.

			Example usage:
			`(ceil: 1.1)` produces 2.
		*/
		ceil:   [Math.ceil, Number],
		pow:    [Math.pow, Number],
		exp:    [Math.exp, Number],
		sqrt:   [mathFilter(Math.sqrt), Number],
		log:    [mathFilter(Math.log), Number],
		log10:  [mathFilter(Math.log10), Number],
		log2:   [mathFilter(Math.log2), Number],
		
		/*
			Basic randomness
		*/

		/*
			This function returns a random integer from a to b inclusive.
		*/
		random: [(a, b) => {
			/*
				First, throw an error if either of the numbers is not a whole number.
			*/
			if (a !== (a|0) || b !== (b|0)) {
				return TwineError.create("macrocall",
					"(random:) only accepts whole numbers, not " + objectName(a !== (a|0) ? a : b));
			}
			let from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = Math.min(a, b);
				to = Math.max(a, b);
			}
			to += 1;
			return ~~((Math.random() * (to - from))) + from;
		}, [Number, Macros.TypeSignature.optional(Number)]],
		
		either: [either, rest(Any)],

		/*
			Wrappers for Window
		*/

		// Keep "undefined" from being the default text.
		alert: [(text) => window.alert(text),
			String],
		prompt: [(text, value) => window.prompt(text, value) || "",
			String, String],
		confirm: [(text) => window.confirm(text),
			String],
		openURL: [(text) => window.open(text, ""), String],
		reload: [window.location.reload.bind(window.location), null],
		gotoURL: [window.location.assign.bind(window.location), String],
		pageURL: [() => window.location.href, null],
		
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		""() {
			Object.keys(this).forEach((key) => {
				if (key) {
					let fn = this[key][0];
					let typeSignature = this[key][1];
					
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					Macros.add(key, (_, ...rest) => fn(...rest), typeSignature);
				}
			});
		}
	}[""]());
	
});
