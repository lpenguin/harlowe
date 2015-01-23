define(['macros', 'utils', 'utils/operationutils', 'state', 'datatypes/assignmentrequest'],
function(Macros, Utils, OperationUtils, State, AssignmentRequest) {
	"use strict";
	
	var
		rest = Macros.TypeSignature.rest,
		zeroOrMore = Macros.TypeSignature.zeroOrMore,
		Any = Macros.TypeSignature.Any;
	
	Macros.add
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
		("put", function put(_, assignmentRequests /*variadic*/) {
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
		[rest(AssignmentRequest)])

		
		/*
			ARRAY MACROS
		*/
		
		/*
			(a:), (array:)
			Used for creating plain JS arrays, which are a standard
			Harlowe data type.
		*/
		(["a", "array"], function() {
			return Array.from(arguments).slice(1);
		}, zeroOrMore(Any))
		
		/*
			(range:)
			Produces an *inclusive* range of integers from a to b.
		*/
		("range", function range(_, a, b) {
			/*
				For now, let's assume descending ranges are intended,
				and support them.
			*/
			if (a > b) {
				return range(_, b, a).reverse();
			}
			/*
				This differs from Python: the base case returns just [a],
				instead of an empty array. The rationale is that since it is
				inclusive, a can serve as both start and end term just fine.
			*/
			var ret = [a];
			b -= a;
			while(b-- > 0) {
				ret.push(++a);
			}
			return ret;
		},
		[Number, Number])
		
		/*
			(subarray:)
			Produces a slice of the given array, cut from
			the *inclusive* indices a and b.
			A match of (substring:).
		*/
		("subarray", function subarray(_, array, a, b) {
			return OperationUtils.subset(array, a, b);
		},
		[Array, Number, Number])
		
		/*
			(history:)
			Returns the array of past passage names, directly from State.
			This is used to implement the visited() function from Twine 1.
		*/
		("history", function history() {
			return State.pastPassageNames();
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
			
			One concern about maps: even though they are a Map,
			inserting a non-primitive in key position is problematic because
			retrieving the key uses compare-by-reference, and most
			of Twine 2's unique object types are immutable (hence, can't be
			used in by-reference comparisons).
		*/
		("datamap", function() {
			var key, ret;
			/*
				This converts the flat arguments "array" into an array of
				key-value pairs [[key, value],[key, value]].
				During each odd iteration, the element is the key.
				Then, the element is the value.
			*/
			/*
				Note that, as is with most macro functions in this file,
				the slice(1) eliminates the implicit first Section argument.
			*/
			ret = new Map(Array.from(arguments).slice(1).reduce(function(array, element) {
				if (key === undefined) {
					key = element;
				}
				else {
					array.push([key, element]);
					key = undefined;
				}
				return array;
			}, []));
			
			/*
				One error can result: if there's an odd number of arguments, that
				means a key has not been given a value.
			*/
			if (key !== undefined) {
				return new TypeError("This datamap has a key without a value.");
			}
			return ret;
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
		("dataset", function() {
			return new Set(Array.from(arguments).slice(1));
		},
		zeroOrMore(Any))
		
		/*
			COLLECTION OPERATIONS
		*/
		/*
			(count:)
			Accepts 2 arguments - a collection and a value - and returns the number
			of occurrences of the value in the collection, using the same semantics
			as the "contains" operator.
		*/
		("count", function(_, collection, value) {
			switch(OperationUtils.collectionType(collection)) {
				case "dataset":
				case "datamap": {
					return +collection.has(name);
				}
				case "string": {
					if (typeof value !== "string") {
						return new TypeError(
							OperationUtils.objectName(collection)
							+ " can't contain  "
							+ OperationUtils.objectName(value)
							+ " because it isn't a string."
						);
					}
					return collection.split(value).length-1;
				}
				case "array": {
					return collection.reduce(function(count, e) {
						return count + (e === value);
					}, 0);
				}
			}
		},
		[Any, Any])
		
		// End of macros
		;
});
