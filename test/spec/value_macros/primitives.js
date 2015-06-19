describe("primitive value macros", function() {
	'use strict';
	describe("the (number:) macro", function() {
		it("accepts exactly 1 string argument", function() {
			expectMarkupToError("(number:)");
			expectMarkupToPrint("(number:'1')", '1');
			expectMarkupToError("(number:'1','1')");
		});
		it("converts string arguments to a number", function() {
			expectMarkupToPrint("(number: '2.' + '5')", "2.5");
		});
		it("shows an error if it does not succeed", function() {
			expectMarkupToError("(number: 'Dogs')");
		});
		it("is aliased as (num:)", function() {
			expectMarkupToPrint("(num: '2')", "2");
		});
	});
	describe("the (text:) macro", function() {
		it("accepts 0 or more arguments of any primitive type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expectMarkupToNotError("(text:" + (e + ",").repeat(i) + ")");
				}
			});
		});
		it("converts number arguments to a string", function() {
			expectMarkupToPrint("(text: 2)", "2");
		});
		it("converts boolean arguments to a string", function() {
			expectMarkupToPrint("(text: 3 is 4)", "false");
		});
		it("joins string arguments", function() {
			expectMarkupToPrint("(text: 'gar', 'ply')","garply");
		});
		it("refuses object arguments", function() {
			expectMarkupToError("(text: (text-style:'shadow'))");
			expectMarkupToError("(text: (datamap:))");
		});
		it("is aliased as (string:)", function() {
			expectMarkupToPrint("(string: 2)", "2");
		});
	});
	describe("the (random:) macro", function() {
		it("accepts 1 or 2 whole numbers", function() {
			expectMarkupToError("(random:)");
			["0.1", "'X'", "true"].forEach(function(e) {
				expectMarkupToError("(random:" + e + ")");
				expectMarkupToError("(random:" + e + ",1)");
				expectMarkupToError("(random:1," + e + ")");
			});
			expectMarkupToError("(random:1,1,1)");
			expectMarkupToNotError("(random:1,1)");
		});
		it("returns a random number between each value, inclusive", function() {
			for(var j = 0; j < 5; j += 1) {
				for(var k = 1; k < 6; k += 1) {
					var val = +runPassage("(random:" + j + "," + k + ")").text();
					expect(val).not.toBeLessThan(Math.min(j,k));
					expect(val).not.toBeGreaterThan(Math.max(j,k));
				}
			}
		});
	});
	describe("the (substring:) macro", function() {
		it("accepts 1 string argument, then two number arguments", function() {
			expectMarkupToError("(substring:)");
			expectMarkupToError("(substring: '1')");
			expectMarkupToPrint("(substring: 'red', 1, 2)", 're');
		});
		it("returns the substring specified by the two 1-indexed start and end indices", function() {
			expectMarkupToPrint("(substring: 'garply', 2, 4)", "arp");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expectMarkupToPrint("(substring: 'garply', 4, 2)", "arp");
		});
		it("accepts negative indices", function() {
			expectMarkupToPrint("(substring: 'garply', 2, -1)", "arply");
			expectMarkupToPrint("(substring: 'garply', -2, 1)", "garpl");
			expectMarkupToPrint("(substring: 'garply', -1, -3)", "ply");
		});
		it("refuses zero and NaN indices", function() {
			expectMarkupToError("(substring: 'garply', 0, 2)");
			expectMarkupToError("(substring: 'garply', 2, NaN)");
		});
	});
});
