describe("property indexing", function() {
	'use strict';
	describe("sequential indices", function() {
		describe("for strings", function() {
			it("'1st', '2nd', etc. access the indexed characters", function() {
				expectMarkupToPrint('(print: "Red"\'s 1st)', "R");
				expectMarkupToPrint('(print: "Red"\'s 2nd)', "e");
				expectMarkupToPrint('(print: "Red"\'s 3rd)', "d");
			});
			it("ignores the exact ordinal used", function() {
				expectMarkupToPrint('(print: "Red"\'s 1th)', "R");
				expectMarkupToPrint('(print: "Red"\'s 2rd)', "e");
				expectMarkupToPrint('(print: "Red"\'s 3st)', "d");
			});
			it("'last', '2ndlast', etc. accesses the right-indexed characters", function() {
				expectMarkupToPrint('(print: "Red"\'s 3rdlast)', "R");
				expectMarkupToPrint('(print: "Red"\'s 2ndlast)', "e");
				expectMarkupToPrint('(print: "Red"\'s last)', "d");
			});
			it("'length' accesses the string's length", function() {
				expectMarkupToPrint('(print: "Red"\'s length)', "3");
				expectMarkupToPrint('(print: ""\'s length)', "0");
				expectMarkupToPrint('(print: "abcdefghijklmnopqrstuvwxyz"\'s length)', "26");
			});
			it("correctly indexes astral plane characters", function() {
				expectMarkupToPrint('(print: "a𐀠c"\'s 2nd)', "𐀠");
				expectMarkupToPrint('(print: "d𐀠f"\'s 2ndlast)', "𐀠");
				expectMarkupToPrint('(print: "g𐀠i"\'s length)', "3");
			});
			it("can be used as a right-hand-side of (set:)", function() {
				expectMarkupToPrint('(set: $a to "abc"\'s 1st)$a', "a");
				expectMarkupToPrint('(set: $a to "abc"\'s last)$a', "c");
				expectMarkupToPrint('(set: $a to "abc"\'s length)$a', "3");
			});
			it("prints an error if the index is out of bounds", function() {
				expectMarkupToError('(print: "A"\'s 2nd)');
				expectMarkupToError('(print: "Red"\'s 4th)');
			});
		});
		describe("for arrays", function() {
			it("'1st', '2nd', etc. access the indexed elements", function() {
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 1st)', "R");
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 2nd)', "e");
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 3rd)', "d");
			});
			it("ignores the exact ordinal used", function() {
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 1th)', "R");
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 2rd)', "e");
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 3st)', "d");
			});
			it("'last', '2ndlast', etc. accesses the right-indexed characters", function() {
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 3rdlast)', "R");
				expectMarkupToPrint('(print: (a:"R","e","d")\'s 2ndlast)', "e");
				expectMarkupToPrint('(print: (a:"R","e","d")\'s last)', "d");
			});
			it("'length' accesses the array's length", function() {
				expectMarkupToPrint('(print: (a:1,1,1)\'s length)', "3");
				expectMarkupToPrint('(print: (a:)\'s length)', "0");
				expectMarkupToPrint('(print: (a:6,5,4,6,5,6)\'s length)', "6");
			});
			it("can be used as a right-hand-side of (set:)", function() {
				expectMarkupToPrint('(set: $a to (a:"a")\'s 1st)$a', "a");
				expectMarkupToPrint('(set: $a to (a:"c")\'s last)$a', "c");
				expectMarkupToPrint('(set: $a to (a:1,2,3)\'s length)$a', "3");
			});
			it("can be used as a left-hand-side of (set:)", function() {
				runPassage("(set: $a to (a:1,2,3))");
				expectMarkupToPrint('(set: $a\'s 1st to 2)$a', "2,2,3");
				expectMarkupToPrint('(set: $a\'s last to 2)$a', "2,2,2");
			});
			it("can't (set:) the 'length', though", function() {
				expectMarkupToError('(set: $a to (a:1,2,3))(set: $a\'s length to 2)');
			});
			it("prints an error if the index is out of bounds", function() {
				expectMarkupToError('(print: (a:)\'s 1st)');
				expectMarkupToError('(print: (a:1,2,3)\'s 4th)');
			});
		});
	});
	describe("string indices", function() {
		describe("for datamaps", function() {
			it("access the keyed properties", function() {
				expectMarkupToPrint('(print: (datamap:"A",1)\'s A)','1');
			});
			it("prints an error if the key is not present", function() {
				expectMarkupToError('(print: (datamap:"A",1)\'s B)');
			});
		});
	});
	describe("computed indices", function() {
		it("can contain full expressions", function() {
			expectMarkupToNotError('(print: (a:1)\'s (2 - 1))');
		});
		describe("for datamaps", function() {
			it("access the keyed properties", function() {
				expectMarkupToPrint('(print: (datamap:"A",1)\'s ("A"))','1');
			});
			it("prints an error if the key is not present", function() {
				expectMarkupToError('(print: (datamap:"A",1)\'s ("B"))');
			});
		});
		describe("for arrays", function() {
			it("access the indexed elements", function() {
				expectMarkupToPrint('(print: (datamap:"A",1)\'s ("A"))','1');
			});
		});
	});
});
