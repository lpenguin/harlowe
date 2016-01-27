describe("primitive value macros", function() {
	'use strict';
	describe("the (number:) macro", function() {
		it("accepts exactly 1 string argument", function() {
			expect("(number:)").markupToError();
			expect("(number:'1')").markupToPrint('1');
			expect("(number:'1','1')").markupToError();
		});
		it("converts string arguments to a number", function() {
			expect("(number: '2.' + '5')").markupToPrint("2.5");
		});
		it("shows an error if it does not succeed", function() {
			expect("(number: 'Dogs')").markupToError();
		});
		it("is aliased as (num:)", function() {
			expect("(num: '2')").markupToPrint("2");
		});
	});
	describe("the (text:) macro", function() {
		it("accepts 0 or more arguments of any primitive type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expect("(text:" + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("converts number arguments to a string", function() {
			expect("(text: 2)").markupToPrint("2");
		});
		it("converts boolean arguments to a string", function() {
			expect("(text: 3 is 4)").markupToPrint("false");
		});
		it("joins string arguments", function() {
			expect("(text: 'gar', 'ply')").markupToPrint("garply");
		});
		it("refuses object arguments", function() {
			expect("(text: (text-style:'shadow'))").markupToError();
			expect("(text: (datamap:))").markupToError();
		});
		it("is aliased as (string:)", function() {
			expect("(string: 2)").markupToPrint("2");
		});
	});
	describe("the (random:) macro", function() {
		it("accepts 1 or 2 whole numbers", function() {
			expect("(random:)").markupToError();
			["0.1", "'X'", "true"].forEach(function(e) {
				expect("(random:" + e + ")").markupToError();
				expect("(random:" + e + ",1)").markupToError();
				expect("(random:1," + e + ")").markupToError();
			});
			expect("(random:1,1,1)").markupToError();
			expect("(random:1,1)").not.markupToError();
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
			expect("(substring:)").markupToError();
			expect("(substring: '1')").markupToError();
			expect("(substring: 'red', 1, 2)").markupToPrint('re');
		});
		it("returns the substring specified by the two 1-indexed start and end indices", function() {
			expect("(substring: 'garply', 2, 4)").markupToPrint("arp");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expect("(substring: 'garply', 4, 2)").markupToPrint("arp");
		});
		it("accepts negative indices", function() {
			expect("(substring: 'garply', 2, -1)").markupToPrint("arply");
			expect("(substring: 'garply', -2, 1)").markupToPrint("garpl");
			expect("(substring: 'garply', -1, -3)").markupToPrint("ply");
		});
		it("refuses zero and NaN indices", function() {
			expect("(substring: 'garply', 0, 2)").markupToError();
			expect("(substring: 'garply', 2, NaN)").markupToError();
		});
	});
});
