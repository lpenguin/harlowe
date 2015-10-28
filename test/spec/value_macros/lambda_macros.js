describe("lambdas", function() {
	'use strict';
	it("consist of params, '==>', and a deferred computation, all in parentheses", function() {
		expectMarkupToNotError("(print: (_a ==> 2))");
	});
	it("can have many params separated by commas", function() {
		expectMarkupToNotError("(print: (_a,_b,_c,_d,_e,_f,_g,_h,_i,_j,_k ==> _a+_b+_c+_d+_e+_f+_g+h+i+j+k))");
	});
	it("can have one trailing comma in the params list", function() {
		expectMarkupToNotError("(print: (_a,_b, ==> _a+_b))");
	});
	it("can be nested", function() {
		expectMarkupToNotError("(print: (_a ==> (_b ==> _a+_b)))");
	});
	it("cannot have duplicate params", function() {
		expectMarkupToError("(print: (_a,_a, ==> _a+_b))");
	});
	/*
	it("cannot have unused params", function() {
		expectMarkupToError("(print: (a,b ==> a*2))");
	});
	*/
});
describe("lambda macros", function() {
	'use strict';
	describe("the (converted:) macro", function() {
		it("accepts a one-parameter lambda, plus one or more other values", function() {
			expectMarkupToError("(converted:)");
			expectMarkupToError("(converted:1)");
			expectMarkupToError("(converted:(_a ==> _a*2))");
			for(var i = 2; i < 10; i += 1) {
				expectMarkupToNotError("(converted:(_a ==> _a*2)," + "2,".repeat(i) + ")");
			}
			expectMarkupToError("(converted:(_a,_b ==> _a*_b*2),2)");
			expectMarkupToError("(converted:(_a,_b,_c ==> _a*_b*_c*2),2)");
		});
		it("applies the lambda to each of its additional arguments, producing an array", function() {
			expectMarkupToPrint("(print: (converted:(_a ==> _a*2), 1)'s 1st + 1)","3");
			expectMarkupToPrint("(converted:(_a ==> _a*2), 1,2,3)","2,4,6");
			expectMarkupToPrint("(set: $a to 3)(converted:(_a ==> _a*$a), 1,2,3)","3,6,9");
		});
		it("if one iteration errors, the result is an error", function() {
			expectMarkupToError("(converted:(_a ==> _a*2), 1, 2, true, 4)");
		});
	});
	describe("the (filtered:) macro", function() {
		it("accepts a one-parameter lambda returning a boolean, plus one or more other values", function() {
			expectMarkupToError("(filtered:)");
			expectMarkupToError("(filtered:1)");
			expectMarkupToError("(filtered:(_a ==> _a*2))");
			for(var i = 2; i < 10; i += 1) {
				expectMarkupToNotError("(filtered:(_a ==> true)," + "2,".repeat(i) + ")");
			}
			expectMarkupToError("(filtered:(_a,_b ==> _a is _b),2)");
			expectMarkupToError("(filtered:(_a,_b,_c ==> _a is _b and _b is _c),2)");
			expectMarkupToError("(filtered:(_a ==> 2),2)");
		});
		it("applies the lambda to each of its additional arguments, producing an array of those which produced true", function() {
			expectMarkupToPrint("(print: (filtered:(_a ==> _a>2), 1,3)'s 1st + 1)","4");
			expectMarkupToPrint("(filtered:(_a ==> _a>2), 1,2,3,4,5)","3,4,5");
			expectMarkupToPrint("(set: $a to 3)(filtered:(_a ==> _a < $a), 1,2,3)","1,2");
		});
		it("if one iteration errors, the result is an error", function() {
			expectMarkupToError("(filtered:(_a ==> not _a), true, true, 6, true)");
		});
	});
});
