describe("basic value macros", function() {
	'use strict';
	describe("the (text:) macro", function() {
		it("accepts 0 or more arguments of any primitive type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expect(runPassage("(text:" + (e + ",").repeat(i) + ")").find('tw-expression').length).toBe(1);
				}
			});
		});
		it("converts number arguments to a string", function() {
			expect(runPassage("(text: 2)").find('tw-expression').text()).toBe("2");
		});
		it("converts boolean arguments to a string", function() {
			expect(runPassage("(text: 3 is 4)").find('tw-expression').text()).toBe("false");
		});
		it("joins string arguments", function() {
			expect(runPassage("(text: 'gar', 'ply')").find('tw-expression').text()).toBe("garply");
		});
		it("refuses object arguments", function() {
			expect(runPassage("(text: (array:))").find('tw-error').length).toBe(1);
			expect(runPassage("(text: (datamap:))").find('tw-error').length).toBe(1);
		});
		it("is aliased as (string:)", function() {
			expect(runPassage("(string: 2)").find('tw-expression').text()).toBe("2");
		});
	});
	describe("the (number:) macro", function() {
		it("accepts exactly 1 string argument", function() {
			expect(runPassage("(number:)").find('tw-error').length).toBe(1);
			expect(runPassage("(number:'1')").find('tw-expression').length).toBe(1);
			expect(runPassage("(number:'1','1')").find('tw-error').length).toBe(1);
		});
		it("converts string arguments to a number", function() {
			expect(runPassage("(number: '2.' + '5')").find('tw-expression').text()).toBe("2.5");
		});
		it("is aliased as (num:)", function() {
			expect(runPassage("(num: '2')").find('tw-expression').text()).toBe("2");
		});
	});
	describe("the (substring:) macro", function() {
		it("accepts 1 string argument, then two number arguments", function() {
			expect(runPassage("(substring:)").find('tw-error').length).toBe(1);
			expect(runPassage("(substring:'1')").find('tw-error').length).toBe(1);
			expect(runPassage("(substring: 'red', 1, 2)").find('tw-expression').length).toBe(1);
		});
		it("returns the substring specified by the two 1-indexed start and end indices", function() {
			expect(runPassage("(substring: 'garply', 2, 4)").find('tw-expression').text()).toBe("arp");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expect(runPassage("(substring: 'garply', 4, 2)").find('tw-expression').text()).toBe("arp");
		});
		it("accepts negative indices", function() {
			expect(runPassage("(substring: 'garply', 2, -1)").find('tw-expression').text()).toBe("arply");
			expect(runPassage("(substring: 'garply', -2, 1)").find('tw-expression').text()).toBe("garpl");
			expect(runPassage("(substring: 'garply', -1, -3)").find('tw-expression').text()).toBe("ply");
		});
		it("refuses zero and NaN indices", function() {
			expect(runPassage("(substring: 'garply', 0, 2)").find('tw-error').length).toBe(1);
			expect(runPassage("(substring: 'garply', 2, NaN)").find('tw-error').length).toBe(1);
		});
	});
});
