describe("data structure macros", function () {
	'use strict';
	describe("the (array:) macro", function() {
		it("accepts 0 or more arguments of any type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expectMarkupToPrint("(array:" + (e + ",").repeat(i) + ")", Array(i).fill(eval(e)) + '');
				}
			});
		});
		it("returns an array containing the arguments", function() {
			runPassage("(set: $a to (array:1,2,3,4,5))");
			expectMarkupToPrint("(print: $a's 1st > 0 and $a's 1st < 6)","true");
			expectMarkupToPrint(
				"(print: 2 is in $a and 3 is in $a and 4 is in $a and 5 is in $a and 1 is in $a)",
				"true"
			);
		});
		it("is aliased as (a:)", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expectMarkupToPrint("(a:" + (e + ",").repeat(i) + ")", Array(i).fill(eval(e))+'');
				}
			});
		});
	});
	describe("the (subarray:) macro", function() {
		it("accepts 1 array argument, then two number arguments", function() {
			expectMarkupToError("(subarray:)");
			expectMarkupToError("(subarray: (a:'1'))");
			expectMarkupToPrint("(subarray: (a:6,7), 1, 2)", '6,7');
		});
		it("returns the subarray specified by the two 1-indexed start and end indices", function() {
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), 2, 4)", "7,6,5");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), 4, 2)", "7,6,5");
		});
		it("accepts negative indices", function() {
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), 2, -1)", "7,6,5,4");
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), -2, 1)", "8,7,6,5");
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), -1, -3)", "6,5,4");
		});
		it("refuses zero and NaN indices", function() {
			expectMarkupToError("(subarray: (a:8,7,6,5,4), 0, 2)");
			expectMarkupToError("(subarray: (a:8,7,6,5,4), 2, NaN)");
		});
	});
	describe("the (shuffled:) macro", function() {
		it("accepts 2 or more arguments of any type", function() {
			expectMarkupToError("(shuffled:)");
			expectMarkupToError("(shuffled:1)");
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expectMarkupToNotError("(shuffled:" + (e + ",").repeat(i) + ")");
				}
			});
		});
		it("returns an array containing the arguments", function() {
			runPassage("(set: $a to (shuffled:1,2,3,4,5))");
			expectMarkupToPrint("(print: $a's 1st > 0 and $a's 1st < 6)","true");
			expectMarkupToPrint(
				"(print: 2 is in $a and 3 is in $a and 4 is in $a and 5 is in $a and 1 is in $a)",
				"true"
			);
		});
		it("shuffles the positions of the elements in the returned array", function() {
			expectMarkupToPrint("(print: (range:1,99) is (range:1,99))","true");
			for(var i = 0; i < 10; i += 1) {
				expectMarkupToPrint("(print: (shuffled:(range:1,99)) is not (shuffled:(range:1,99)))", "true");
			}
		});
	});
	describe("the (datanames:) macro", function() {
		it("accepts 1 datamap", function() {
			expectMarkupToError("(datanames:)");
			expectMarkupToNotError("(datanames: (datamap:'1','1'))");
			expectMarkupToError("(datanames: (datamap:'1','1'), (datamap:'2','1'))");
		});
		it("returns an array containing the names in the datamap", function() {
			runPassage("(set: $a to (datamap:'A',1,'B',2,'C',3))");
			expectMarkupToPrint("(print: (datanames:$a))","A,B,C");
			expectMarkupToPrint("(print: (datanames:(datamap:)))","");
		});
		it("returns the names in natural-sort order", function() {
			runPassage("(set: $a to (datamap:'D1',1,'F',2,'E',3,'D11',4,'D2',5))");
			expectMarkupToPrint("(print: (datanames:$a))","D1,D2,D11,E,F");
		});
	});
	describe("the (datavalues:) macro", function() {
		it("accepts 1 datamap", function() {
			expectMarkupToError("(datavalues:)");
			expectMarkupToNotError("(datavalues: (datamap:'1','1'))");
			expectMarkupToError("(datavalues: (datamap:'1','1'), (datamap:'2','1'))");
		});
		it("returns an array containing the values in the datamap", function() {
			runPassage("(set: $a to (datamap:'A', 'Food', 'B', 7, 'C', (a:1, 2, 'Hey')))");
			expectMarkupToPrint("(print: (datavalues:$a))","Food,7,1,2,Hey");
			expectMarkupToPrint("(print: (datavalues:(datamap:)))","");
		});
		it("returns the values in their names's natural-sort order", function() {
			runPassage("(set: $a to (datamap:'D1',1,'F',2,'E',3,'D11',4,'D2',5))");
			expectMarkupToPrint("(print: (datavalues:$a))","1,5,4,3,2");
		});
	});
});

