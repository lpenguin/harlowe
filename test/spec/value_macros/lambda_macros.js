describe("lambdas", function() {
	'use strict';
	it("consist of params, 'to', and a deferred computation, all in parentheses", function() {
		expectMarkupToNotError("(print: (a to 2))");
	});
	it("can have many params separated by commas", function() {
		expectMarkupToNotError("(print: (a,b,c,d,e,f,g,h,i,j,k to a+b+c+d+e+f+g+h+i+j+k))");
	});
	it("can have one trailing comma in the params list", function() {
		expectMarkupToNotError("(print: (a,b, to a+b))");
	});
	it("can be nested", function() {
		expectMarkupToNotError("(print: (a to (b to a+b)))");
	});
	it("cannot have duplicate params", function() {
		expectMarkupToError("(print: (a,a, to a+b))");
	});
	/*
	it("cannot have unused params", function() {
		expectMarkupToError("(print: (a,b to a*2))");
	});
	*/
	it("cannot have params shadowing keywords", function() {
		['it', 'its', 'time', 'and', 'or', 'not', 'contains', 'in', 'true', 'false', 'into', 'of', 'NaN'].forEach(function(e) {
			expectMarkupToError("(print: (" + e + " to " + e + " + 1))");
		});
	});
});
describe("lambda macros", function() {
	'use strict';
	describe("the (converted:) macro", function() {
		it("accepts a one-parameter lambda, plus one or more other values", function() {
			expectMarkupToError("(converted:)");
			expectMarkupToError("(converted:1)");
			expectMarkupToError("(converted:(a to a*2))");
			for(var i = 2; i < 10; i += 1) {
				expectMarkupToNotError("(converted:(a to a*2)," + "2,".repeat(i) + ")");
			}
			expectMarkupToError("(converted:(a,b to a*b*2),2)");
			expectMarkupToError("(converted:(a,b,c to a*b*c*2),2)");
		});
		it("applies the lambda to each of its additional arguments, producing an array", function() {
			expectMarkupToPrint("(print: (converted:(a to a*2), 1)'s 1st + 1)","3");
			expectMarkupToPrint("(converted:(a to a*2), 1,2,3)","2,4,6");
			expectMarkupToPrint("(set: $a to 3)(converted:(a to a*$a), 1,2,3)","3,6,9");
		});
		it("if one iteration errors, the result is an error", function() {
			expectMarkupToError("(converted:(a to a*2), 1, 2, true, 4)");
		});
	});
});
