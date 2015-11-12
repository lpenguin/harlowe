define([
	'jquery',
	'utils/naturalsort',
	'macros',
	'utils/operationutils',
	'state',
	'engine',
	'passages',
	'datatypes/lambda',
	'internaltypes/assignmentrequest',
	'internaltypes/twineerror',
	'internaltypes/twinenotifier'],
($, NaturalSort, Macros, {objectName, subset, collectionType, isValidDatamapName}, State, Engine, Passages, Lambda, AssignmentRequest, TwineError, TwineNotifier) => {
	"use strict";
	
	const {optional, rest, zeroOrMore, Any}   = Macros.TypeSignature;
	
	Macros.add
		/*d:
			VariableToValue data
			
			This is a special value that only (set:) and (put:) make use of.
			It's created by joining a variable and a value with the `to` or `into` keywords:
			`$emotion to 'flustered'` is an example of a VariableToValue. It exists primarily to
			make (set:) and (put:) more readable.
		*/
		/*d:
			(set: VariableToValue, [...VariableToValue]) -> String
			
			Stores data values in variables.
			
			Example usage:
			```
			(set: $battlecry to "Save a " + $favouritefood + " for me!")
			```
			
			Rationale:
			
			Variables are data storage for your game. You can store data values under special names
			of your choosing, and refer to them later. They persist between passages, and can be
			used throughout the entire game in other macros, such as (if:).
			
			Variables have many purposes: keeping track of what the player has accomplished,
			managing some other state of the story, storing hook styles and changers, and
			other such things. You can display variables by putting them in passage text,
			attach them to hooks, and create and change them using the (set:) and (put:) macros.
			
			Details:
			
			In its basic form, a variable is created or changed using `(set: ` variable `to` value `)`.
			You can also set multiple variables in a single (set:) by separating each VariableToValue
			with commas: `(set: $weapon to 'hands', $armour to 'naked')`, etc.
			
			You can also use `it` in expressions on the right-side of `to`. Much as in other
			expressions, it's a shorthand for what's on the left side: `(set: $vases to it + 1)`
			is a shorthand for `(set: $vases to $vases + 1)`.
			
			If the variable you're setting cannot be changed - for instance, if it's the $Design
			variable - then an error will be printed.
			
			If you use (set:) as an expression, it just evaluates to an empty string.
			
			See also:
			(push:)
		*/
		("set", (_, ...assignmentRequests) => {
			let debugMessage = "";
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(let i = 0; i < assignmentRequests.length; i+=1) {
				const ar = assignmentRequests[i];
				
				if (ar.operator === "into") {
					return TwineError.create("macrocall", "Please say 'to' when using the (set:) macro.");
				}
				const result = ar.dest.set(ar.src);
				/*
					If the setting caused an error to occur, abruptly return the error.
				*/
				if (TwineError.isPrototypeOf(result)) {
					return result;
				}
				if (Engine.options.debug) {
					// Add a semicolon only if a previous iteration appended a message.
					debugMessage += (debugMessage ? "; " : "")
						+ objectName(ar.dest)
						+ " is now "
						+ objectName(ar.src);
				}
			}

			/*
				There's nothing that can be done with the results of (set:) or (put:)
				operations, except to display nothing when they're in bare passage text.
				Return a plain unobservable value that prints out as "".
			*/
			return {
				TwineScript_TypeName:     "a (set:) operation",
				TwineScript_ObjectName:   "a (set:) operation",
				TwineScript_Unobservable: true,
				TwineScript_Print:        () => debugMessage && TwineNotifier.create(debugMessage).render(),
			};
		},
		[rest(AssignmentRequest)])
		
		/*d:
			(put: VariableToValue, [...VariableToValue]) -> String
			
			A left-to-right version of (set:) that requires the word `into` rather than `to`.
			
			Rationale:
			
			This macro has an identical purpose to (set:) - it creates and changes variables.
			For a basic explanation, see the rationale for (set:).
			
			Almost every programming language has a (set:) construct, and most of these place the
			variable on the left-hand-side. However, a minority, such as HyperTalk, place the variable
			on the right. Harlowe allows both to be used, depending on personal preference. (set:) reads
			as `(set: ` variable `to` value `)`, and (put:) reads as `(put: ` value `into` variable `)`.
			
			Details:
			
			Just as with (set:), a variable is changed using `(put: ` value `into` variable `)`. You can
			also set multiple variables in a single (put:) by separating each VariableToValue
			with commas: `(put: 2 into $batteries, 4 into $bottles)`, etc.
			
			`it` can also be used with (put:), but, interestingly, it's used on the right-hand side of
			the expression: `(put: $eggs + 2 into it)`.
			
			Once again, this evaluates to an empty string.
		*/
		("put", (_, ...assignmentRequests) => {
			let debugMessage = "";
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(let i = 0; i < assignmentRequests.length; i+=1) {
				const ar = assignmentRequests[i];
				
				if (ar.operator !== "into") {
					return TwineError.create("macrocall", "Please say 'into' when using the (put:) macro.");
				}
				let result = ar.dest.set(ar.src);
				/*
					If the setting caused an error to occur, abruptly return the error.
				*/
				if (TwineError.isPrototypeOf(result)) {
					return result;
				}
				if (Engine.options.debug) {
					// Add a semicolon only if a previous iteration appended a message.
					debugMessage += (debugMessage ? "; " : "")
						+ objectName(ar.dest)
						+ " is now "
						+ objectName(ar.src);
				}
			}
			return {
				TwineScript_TypeName:     "a (put:) operation",
				TwineScript_ObjectName:   "a (put:) operation",
				TwineScript_Unobservable: true,
				TwineScript_Print:        () => debugMessage && TwineNotifier.create(debugMessage).render(),
			};
		},
		[rest(AssignmentRequest)])
		
		/*d:
			(move: [VariableToValue]) -> String
			
			A variant of (put:) that deletes the source value after copying it - in effect
			moving the value from the source to the destination.
			
			Rationale:
			You'll often use data structures such as arrays or datamaps as storage for values
			that you'll only use once, such as a list of names to print out. When it comes time
			to use them, you can remove it from the structure and retrieve it in one go.
		*/
		("move", (_, ar) => {
			if (ar.operator !== "into") {
				return TwineError.create("macrocall", "Please say 'into' when using the (move:) macro.");
			}
			/*
				If ar.src is a VarRef, then it's a variable, and its value
				should be deleted when the assignment is completed.
			*/
			if (ar.src && ar.src.varref) {
				const get = ar.src.get();
				let error;
				if ((error = TwineError.containsError(get))) {
					return error;
				}
				ar.dest.set(get);
				ar.src.delete();
			}
			else {
				/*
					Otherwise, it's either a plain value (such as seen in
					(move: 2 into $red)) or something which has a TwineScript_DeleteValue
					method that should be called.
				*/
				ar.dest.set(ar.src);
				if (ar.src.TwineScript_DeleteValue) {
					ar.src.TwineScript_DeleteValue();
				}
			}
			return {
				TwineScript_TypeName:     "a (move:) operation",
				TwineScript_ObjectName:   "a (move:) operation",
				TwineScript_Unobservable: true,
				TwineScript_Print:        "",
			};
		},
		[rest(AssignmentRequest)])

		/*
			ARRAY MACROS
		*/
		
		/*d:
			Array data
			
			There are occasions when you may need to work with a sequence of values of unknown length.
			For example, a sequence of adjectives (describing the player) that should be printed depending
			on what a numeric variable (such as a health point variable) currently is.
			You could create many, many variables to hold each value, but it is preferable to
			use an array containing these values.
			
			Arrays are one of the two major "data structures" you can use in Harlowe. The other, datamaps,
			are created with (datamap:). Generally, you want to use arrays when you're dealing with values that
			directly correspond to *numbers*, and whose *order* and *position* relative to each other matter.
			If you instead need to refer to values by a name, and don't care about their order, a datamap is best used.
			
			Array data is referenced much like string characters are. You can refer to data positions using `1st`,
			`2nd`, `3rd`, and so forth: `$array's 1st` refers to the value in the first position. Additionally, you can
			use `last` to refer to the last position, `2ndlast` to refer to the second-last, and so forth. Arrays also
			have a `length` number: `$array's length` tells you how many values are in it.
			
			Arrays may be joined by adding them together: `(a: 1, 2) + (a: 3, 4)` is the same as `(a: 1, 2, 3, 4)`.
			You can only join arrays to other arrays. To add a bare value to the front or back of an array, you must
			put it into an otherwise empty array using the (a:) macro: `$myArray + (a:5)` will make an array that's just
			$myArray with 5 added on the end, and `(a:0) + $myArray` is $myArray with 0 at the start.
			
			You may note that certain macros, like (either:), accept sequences of values. A special operator, `...`, exists which
			can "spread out" the values inside an array, as if they were individually placed inside the macro call.
			`(either: ...$array)` is a shorthand for `(either: $array's 1st, $array's 2nd, $array's 3rd)`, and so forth for as many
			values as there are inside the $array. Note that you can still include values after the spread: `(either: 1, ...$array, 5)`
			is valid and works as expected.
		*/
		/*d:
			(a: [...Any]) -> Array
			Also known as: (array:)
			
			Creates an array, which is an ordered collection of values.
			
			Example usage:
			`(a:)` creates an empty array, which could be filled with other values later.
			`(a: "gold", "frankincense", "myrrh")` creates an array with three strings.
			This is also a valid array, but with its elements spaced in a way that makes them more readable:
			```
			(a:
				"You didn't sleep in the tiniest bed",
				"You never ate the just-right porridge",
				"You never sat in the smallest chair",
			)
			```
			
			Rationale:
			For an explanation of what arrays are, see the Array article. This macro is the primary
			means of creating arrays - simply supply the values to it, in order.
			
			Details:
			Note that due to the way the spread `...` operator works, spreading an array into
			the (a:) macro will accomplish nothing: `(a: ...$array)` is the same as just the `$array`.
			
			See also:
			(datamap:), (dataset:)
		*/
		(["a", "array"], (_, ...args) => args, zeroOrMore(Any))
		
		/*d:
			(range: Number, Number) -> Array
			
			Produces an array containing an inclusive range of whole numbers from a to b,
			in ascending order.
			
			Example usage:
			`(range:1,14)` is equivalent to `(a:1,2,3,4,5,6,7,8,9,10,11,12,13,14)`
			`(range:2,-2)` is equivalent to `(a:-2,-1,0,1,2)`
			
			Rationale:
			This macro is a shorthand for defining an array that contains a sequence of
			integer values. Rather than writing out all of the numbers, you can simply provide
			the first and last numbers.
			
			Details:
			Certain kinds of macros, like (either:), accept sequences of values. You can
			use (range:) with these in conjunction with the `...` spreading operator:
			`(dataset: ...(range:2,6))` is equivalent to `(dataset: 2,4,5,6,7)`, and
			`(either: ...(range:1,5))` is equivalent to `(random: 1,5)`.
			
			See also:
			(a:), (subarray:)
		*/
		("range", function range(_, a, b) {
			/*
				For now, let's assume descending ranges are intended,
				and support them.
			*/
			if (a > b) {
				return range(_, b, a);
			}
			/*
				This differs from Python: the base case returns just [a],
				instead of an empty array. The rationale is that since it is
				inclusive, a can serve as both start and end term just fine.
			*/
			const ret = [a];
			b -= a;
			while(b-- > 0) {
				ret.push(++a);
			}
			return ret;
		},
		[Number, Number])
		
		/*d:
			(subarray: Array, Number, Number) -> Array
			
			When given an array, this returns a new array containing only the elements
			whose positions are between the two numbers, inclusively.
			
			Example usage:
			```
			(set: $a to (a: "Red","Gold","Blue","White"))
			(print: (subarray: $a, 3, 4))
			```
			
			Rationale:
			
			One of the most basic things you can do with an array is split it into smaller
			arrays. For instance, you may have a 'deck' of random string values that you wish
			to divide into two decks and use independently of each other. This macro provides
			a means of doing this - just specify the two positions in which to take values from.
			
			Details:
			
			You can, of course, obtain an array with just one value in it by supplying the same
			position to (subarray:) - `(subarray: $a, 3,3)` produces an array containing just
			the third value.
			
			See also:
			(substring:), (rotated:)
		*/
		("subarray", (_, array, a, b) => subset(array, a, b),
		[Array, Number, Number])
		
		/*d:
			(shuffled: Any, Any, [...Any]) -> Array
			
			Identical to (array:), except that it randomly rearranges the elements
			instead of placing them in the given order.
			
			Example usage:
			```
			(set: $a to (a: 1,2,3,4,5,6))
			(print: (shuffled: ...$a))
			```
			
			Rationale:
			If you're making a particularly random story, you'll often want to create a 'deck'
			of random descriptions, elements, etc. that are only used once. That is to say, you'll want
			to put them in an array, then randomise the array's order, preserving that random order
			for the duration of a game.
			
			The (either:) macro is useful for selecting an element from an array randomly
			(if you use the spread `...` syntax), but isn't very helpful for this particular problem.
			The (shuffled:) macro is the solution: it takes elements and returns a randomly-ordered array that
			can be used as you please.
			
			Details:
			To ensure that it's being used correctly, this macro requires two or more items -
			providing just one (or none) will cause an error to be presented.
			
			See also:
			(array:), (either:), (rotated:)
		*/
		("shuffled", (_, ...args) =>
			// The following is an in-place Fisher–Yates shuffle.
			args.reduce((a,e,ind) => {
				// Obtain a random number from 0 to ind inclusive.
				const j = (Math.random()*(ind+1)) | 0;
				if (j === ind) {
					a.push(e);
				}
				else {
					a.push(a[j]);
					a[j] = e;
				}
				return a;
			},[]),
		[Any, rest(Any)])
		
		/*d:
			(sorted: String, String, [...String]) -> Array
			
			Similar to (array:), except that it requires string elements, and orders the
			strings in English alphanumeric sort order, rather than the order in which they were provided.
			
			Example usage:
			```
			(set: $a to (a: 'A','C','E','G'))
			(print: (sorted: ...$a))
			```
			
			Rationale:
			Often, you'll be using arrays as 'decks' that will provide string values to other parts of
			your story in a specific order. If you want, for instance, these strings to appear in
			alphabetical order, this macro can be used to create a sorted array, or (by using the
			spread `...` syntax) convert an existing array into a sorted one.
			
			Details:
			Unlike other programming languages, this does not strictly use ASCII sort order, but alphanumeric sorting:
			the string "A2" will be sorted after "A1" and before "A11". Moreover, if the player's web browser
			supports internationalisation (that is, every current browser except Safari and IE 10), then
			the strings will be sorted using English language rules (for instance, "é" comes after "e" and before
			"f", and regardless of the player's computer's language settings. Otherwise, it will sort
			using ASCII comparison (whereby "é" comes after "z").
			
			Currently there is no way to specify an alternative language locale to sort by, but this is likely to
			be made available in a future version of Harlowe.
			
			To ensure that it's being used correctly, this macro requires two or more items -
			providing just one (or none) will cause an error to be presented.
			
			See also:
			(array:), (shuffled:), (rotated:)
		*/
		("sorted", (_, ...args) => args.sort(NaturalSort("en")),
		[String, rest(String)])
		
		/*d:
			(rotated: Number, [...Any]) -> Array
			
			Identical to the typical array constructor macro, but it also takes a number at
			the start, and moves each item forward by that number, wrapping back to the start
			if they pass the end of the array.
			
			Example usage:
			`(rotated: 1, 'A','B','C','D')` is equal to `(a: 'D','A','B','C')`.
			`(rotated: -2, 'A','B','C','D')` is equal to `(a: 'C','D','A','B')`.
			
			Rationale:
			Sometimes, you may want to cycle through a number of values, without
			repeating any until you reach the end. For instance, you may have a rotating set
			of flavour-text descriptions for a thing in your story, which you'd like displayed
			in their entirety without the whim of a random picker. The (rotated:) macro
			allows you to apply this "rotation" to a sequence of data, changing their positions
			by a certain number without discarding any values.
			
			Remember that, as with all macros, you can insert all the values in an existing
			array using the `...` syntax: `(set: $a to (rotated: 1, ...$a))` is a common means of
			replacing an array with a rotation of itself.
			
			Think of the number as being an addition to each position in the original sequence -
			if it's 1, then the value in position 1 moves to 2, the value in position 2 moves to 3,
			and so forth.
			
			Details:
			To ensure that it's being used correctly, this macro requires three or more items -
			providing just two, one or none will cause an error to be presented.
			
			See also:
			(subarray:), (sorted:)
		*/
		("rotated", (_, number, ...array) => {
			/*
				The number is thought of as an offset that's added to every index.
				So, to produce this behaviour, it must be negated.
			*/
			number *= -1;
			/*
				These error checks are maybe a bit strict, but ensure that this behaviour
				could (maybe) be freed up in later versions.
			*/
			if (number === 0) {
				return TwineError.create("macrocall",
					"I can't rotate these values by 0 positions.");
			}
			else if (Math.abs(number) >= array.length) {
				return TwineError.create("macrocall",
					"I can't rotate these " + array.length + " values by " + number + " positions.");
			}
			return array.slice(number).concat(array.slice(0, number));
		},
		[Number, Any, rest(Any)])
		;

	/*
		This convenience function is used to run reduce() on macro args using a passed-in lambda,
		which is an operation common to (filtered:), (all-pass:) and (some-pass:).
	*/
	function lambdaBooleanReduce(section, lambda, args) {
		return args.reduce((result, arg) => {
			/*
				If an earlier iteration produced an error, don't run any more
				computations and just return.
			*/
			let error;
			if ((error = TwineError.containsError(result))) {
				return error;
			}
			/*
				Run the lambda, to determine whether to filter out this element.
			*/
			const passedFilter = lambda.apply(section, arg);
			/*
				As an additional type-check, compare the result of the lambda to boolean.
			*/
			if ((error = TwineError.containsError(lambda.checkResult(arg, passedFilter, Boolean)))) {
				return error;
			}
			return result.concat(passedFilter ? [arg] : []);
		}, []);
	}

	Macros.add
		/*
			(converted: Lambda, Any, [...Any])
		*/
		("converted", (section, lambda, ...args) => args.map(e => lambda.apply(section, e),[]),
		[Lambda.ArityType(1), rest(Any)])
		/*
			(find: Lambda, Any, [...Any])
		*/
		("find", (section, lambda, ...args) => lambdaBooleanReduce(section, lambda, args),
		[Lambda.ArityType(1), rest(Any)])
		/*
			(all-pass: Lambda, Any, [...Any])
		*/
		("all-pass", (section, lambda, ...args) => {
			const ret = lambdaBooleanReduce(section, lambda, args);
			return TwineError.containsError(ret) || ret.length === args.length;
		},
		[Lambda.ArityType(1), rest(Any)])
		/*
			(some-pass: Lambda, Any, [...Any])
		*/
		("some-pass", (section, lambda, ...args) => {
			const ret = lambdaBooleanReduce(section, lambda, args);
			return TwineError.containsError(ret) || ret.length > 0;
		},
		[Lambda.ArityType(1), rest(Any)])
		/*
			(none-pass: Lambda, Any, [...Any])
		*/
		("none-pass", (section, lambda, ...args) => {
			const ret = lambdaBooleanReduce(section, lambda, args);
			return TwineError.containsError(ret) || ret.length === 0;
		},
		[Lambda.ArityType(1), rest(Any)])
		;
		
	Macros.add
		/*d:
			(datanames: Datamap) -> Array
			
			This takes a datamap, and returns a sorted array of its data names, sorted
			alphabetically.
			
			Example usage:
			`(datanames: (datamap:'B','Y', 'A','X'))` produces the array `(a: 'A','B')`
			
			Rationale:
			Sometimes, you may wish to obtain some information about a datamap. You may want
			to list all of its data names, or determine how many entries it has. You can use
			the (datanames:) macro to do these things: if you give it a datamap, it produces
			a sorted array of all of its names. You can then (print:) them, check the length
			of the array, obtain a subarray, and other things you can do to arrays.
			
			See also:
			(datavalues:)
		*/
		("datanames", (_, map) =>  Array.from(map.keys()).sort(NaturalSort("en")),
		[Map])
		/*
			(datavalues:)
			This takes a datamap, and returns an array of its values, sorted
			alphabetically by their name.
			
			Example usage:
			`(datavalues: (datamap:'B',24, 'A',25))` produces the array `(a: 25,24)`
			
			Rationale:
			Sometimes, you may wish to examine the values stored in a datamap without
			referencing every name - for instance, determining if 0 is one of the values.
			(This can't be determined using the `contains` keyword, because that only checks
			the map's data names.) You can extract all of the datamap's values into an array
			to compare and analyse them using (datavalues:). The values will be sorted by
			their associated names.
			
			See also:
			(datanames:)
		*/
		("datavalues", (_, map) =>
			Array.from(map.entries()).sort(
				(a,b) => ([a[0],b[0]].sort(NaturalSort("en"))[0] === a[0] ? -1 : 1)
			).map(
				e => e[1]
			),
		[Map])
		
		/*
			(history:)
			Returns the array of past passage names, directly from State.
			(It should be changed to return Passage datamaps, but, it is what it is.)
			This is used to implement the visited() function from Twine 1.
		*/
		("history", () => State.pastPassageNames(),
		[])
		
		/*
			(passage:)
			Returns a passage datamap for the given name (or, if none is present, the current passage)
		*/
		("passage", (_, passageName) =>
			Passages.get(passageName || State.passage)
				|| TwineError.create('macrocall', "There's no passage named '" + passageName + "' in this story."),
		[optional(String)])
		
		/*
			(savedgames:)
			Returns a datamap of currently saved games.
		*/
		("savedgames", () => {
			/*
				This should be identical to the internal function in macrolib/commands.js.
				TODO: Add this to Engine itself, maybe.
			*/
			function storagePrefix(text) {
				return "(" + text + " " + Engine.options.ifid + ") ";
			}
			/*
				This reads all of the localStorage keys with save slot-related names.
			*/
			let
				i = 0, key;
			const
				savesMap = new Map();
			/*
				Iterate over all the localStorage keys using this somewhat clunky do-loop.
			*/
			do {
				key = localStorage.key(i);
				i += 1;
				const prefix = storagePrefix("Saved Game");
				if (key && key.startsWith(prefix)) {
					// Trim off the prefix
					key = key.slice(prefix.length);
					// Populate the saves map with the save slot name.
					savesMap.set(key, localStorage.getItem(storagePrefix("Saved Game Filename") + key));
				}
			}
			while(key);
			return savesMap;
		},
		[])
		
		/*
			DATAMAP MACROS
		*/
		/*
			(datamap:)
			Similar to (a:), these create standard JS Maps and Sets.
			But, instead of supplying an iterator, you supply keys and values
			interleaved: (datamap: key, value, key, value).

			Example usage:
			```
			(datamap:
				"Susan", "A petite human in a yellow dress",
				"Tina", "A ten-foot lizardoid in a three-piece suit",
				"Gertie", "A griffin draped in a flowing cape",
			)
			```
			
			One concern about maps: even though they are a Map,
			inserting a non-primitive in key position is problematic because
			retrieving the key uses compare-by-reference, and most
			of Twine 2's unique object types are immutable (hence, can't be
			used in by-reference comparisons).
		*/
		("datamap", (_, ...args) => {
			let key;
			const map = new Map();
			/*
				This takes the flat arguments "array" and runs
				map.set() with every two values.
				During each odd iteration, the element is the key.
				Then, the element is the value.
			*/
			/*
				Note that, as is with most macro functions in this file,
				the slice(1) eliminates the implicit first Section argument.
			*/
			const status = args.reduce((status, element) => {
				let error;
				/*
					Propagate earlier iterations' errors.
				*/
				if (TwineError.containsError(status)) {
					return status;
				}
				if (key === undefined) {
					key = element;
				}
				/*
					Key type-checking must be done here.
				*/
				else if ((error = TwineError.containsError(isValidDatamapName(map, key)))) {
					return error;
				}
				/*
					This syntax has a special restriction: you can't use the same key twice.
				*/
				else if (map.has(key)) {
					return TwineError.create("macrocall",
						"You used the same data name ("
						+ objectName(key)
						+ ") twice in the same (datamap:) call."
					);
				}
				else {
					map.set(key, element);
					key = undefined;
				}
				return status;
			}, true);
			/*
				Return an error if one was raised during iteration.
			*/
			if (TwineError.containsError(status)) {
				return status;
			}
			/*
				One error can result: if there's an odd number of arguments, that
				means a key has not been given a value.
			*/
			if (key !== undefined) {
				return TwineError.create("macrocall", "This datamap has a data name without a value.");
			}
			return map;
		},
		zeroOrMore(Any))
		
		/*
			DATASET MACROS
		*/
		/*
			(dataset:)
			Sets are more straightforward - their JS constructors can accept
			arrays straight off.
		*/
		("dataset", (_, ...args) => new Set(args), zeroOrMore(Any))
		
		/*
			COLLECTION OPERATIONS
		*/
		/*
			(count:)
			Accepts 2 arguments - a collection and a value - and returns the number
			of occurrences of the value in the collection, using the same semantics
			as the "contains" operator.
		*/
		("count", (_, collection, value) => {
			switch(collectionType(collection)) {
				case "dataset":
				case "datamap": {
					return +collection.has(name);
				}
				case "string": {
					if (typeof value !== "string") {
						return new TypeError(
							objectName(collection)
							+ " can't contain  "
							+ objectName(value)
							+ " because it isn't a string."
						);
					}
					return collection.split(value).length-1;
				}
				case "array": {
					return collection.reduce((count, e) => count + (e === value), 0);
				}
			}
		},
		[Any, Any])
		
		// End of macros
		;
});
