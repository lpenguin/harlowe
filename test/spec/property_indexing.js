describe("property indexing", function() {
	'use strict';
	describe("sequential indices", function() {
		describe("for strings", function() {
			it("'1st', '2nd', etc. access the indexed characters", function() {
				expectMarkupToPrint('(print: "Red"\'s 1st)', "R");
				expectMarkupToPrint('(print: "Red"\'s 2nd)', "e");
				expectMarkupToPrint('(print: "Red"\'s 3rd)', "d");
			});
			it("are case-insensitive", function() {
				expectMarkupToPrint('(print: "Red"\'s 1sT)', "R");
				expectMarkupToPrint('(print: "Red"\'s 2Nd)', "e");
				expectMarkupToPrint('(print: "Red"\'s 3RD)', "d");
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
			it("can be used with 'it', as 'its'", function() {
				expectMarkupToPrint('(set:$s to "R")(set: $s to its 1st)$s','R');
				expectMarkupToPrint('(set:$s to "Red")(set: $s to its length)$s','3');
			});
			it("can be chained (worthlessly)", function() {
				expectMarkupToPrint('(print: "Gold"\'s last\'s 1st)','d');
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
				expectMarkupToPrint('(set: $a\'s last to 2)$a', "2,2,2");
			});
			it("can't (set:) the 'length', though", function() {
				expectMarkupToError('(set: $a to (a:1,2,3))(set: $a\'s length to 2)');
			});
			it("prints an error if the index is out of bounds", function() {
				expectMarkupToError('(print: (a:)\'s 1st)');
				expectMarkupToError('(print: (a:1,2,3)\'s 4th)');
			});
			it("can be used with 'it', as 'its'", function() {
				expectMarkupToPrint('(set:$a to (a:7,8))(set: $a to its 1st)$a','7');
				expectMarkupToPrint('(set:$a to (a:1,1,1))(set: $a to its length)$a','3');
			});
			it("can be chained", function() {
				expectMarkupToPrint('(print: (a:(a:"W"))\'s 1st\'s 1st)', "W");
			});
		});
		it("cannot be used with datamaps", function() {
			expectMarkupToError('(print: (datamap: "Sword", "Steel")\'s 1st)');
			expectMarkupToError('(print: (datamap: "Sword", "Steel")\'s last)');
		});
		it("cannot be used with datasets", function() {
			expectMarkupToError('(print: (dataset: 2,3)\'s 1st)');
			expectMarkupToError('(print: (dataset: 2,3)\'s last)');
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
			it("can be used as a right-hand-side of (set:)", function() {
				expectMarkupToPrint('(set: $a to (datamap:"A",1)\'s A)$a', "1");
				expectMarkupToPrint('(set: $a to (datamap:"C",2)\'s C)$a', "2");
			});
			it("can be used as a left-hand-side of (set:)", function() {
				runPassage("(set: $d to (datamap:'A',1))");
				expectMarkupToPrint('(set: $d\'s A to 2)(print:$d\'s A)', "2");
				runPassage('(set: $d\'s A to (datamap:"B",2))');
				expectMarkupToPrint('(set: $d\'s A\'s B to 4)(print:$d\'s A\'s B)', "4");
			});
			it("can be used with 'it', as 'its'", function() {
				expectMarkupToPrint('(set:$d to (datamap:"A",7))(set: $d to its A)$d','7');
			});
			it("can be chained", function() {
				expectMarkupToPrint('(print: (datamap:"W",(datamap:"W",1))\'s W\'s W)', "1");
			});
		});
		it("cannot be used with arrays", function() {
			expectMarkupToError('(set: $a to (a: 2,3))(set: $a\'s thing to 4)');
		});
		it("cannot be used with datasets", function() {
			expectMarkupToError('(set: $s to (dataset: 2,3))(set: $s\'s thing to 4)');
		});
	});
	describe("belonging indices", function() {
		it("can be used with strings", function() {
			expectMarkupToPrint('(print: 1st of "Red")', "R");
			expectMarkupToPrint('(print: length of 1st of "Red")', "1");
		});
		it("can be used with arrays", function() {
			expectMarkupToPrint('(print: 1st of (a:"R",2))', "R");
			expectMarkupToPrint('(print: 1st of 1st of (a:(a:"R")))', "R");
		});
		it("can be used with datamaps", function() {
			expectMarkupToPrint('(print: A of (datamap:"A",7))', "7");
		});
		it("can be used with 'it'", function() {
			expectMarkupToPrint('(set:$a to (a:7,8))(set: $a to 1st of it)$a','7');
		});
		it("won't conflict with possessive indices", function() {
			expectMarkupToPrint('(print: length of "Red"\'s 1st)', "1");
			expectMarkupToPrint('(print: 1st of 1st of (a:(a:"Red"),(a:"Blue"))\'s last)', "B");
		});
		it("won't conflict with 'its' indices", function() {
			expectMarkupToPrint('(set:$a to (a:(a:7,8),(a:9,0)))(set: $a to 2nd of its 1st)$a', "8");
		});
	});
	describe("computed indices", function() {
		it("can contain full expressions", function() {
			expectMarkupToNotError('(print: (a:1)\'s (2 - 1))');
			expectMarkupToNotError('(print: (2 - 1) of (a:1))');
			expectMarkupToNotError('(print: (a:1)\'s ((either:1))');
			expectMarkupToNotError('(print: ((either:1)) of (a:1))');
		});
		it("can be chained", function (){
			expectMarkupToPrint("(print: (a:'Red')\'s (2 - 1)'s 1st)","R");
			expectMarkupToPrint("(print: (a:'Red')\'s (2 - 1)'s (2 - 1))","R");
			expectMarkupToPrint("(print: 1st of (a:'Red')\'s (2 - 1))","R");
			expectMarkupToPrint("(print: (2 - 1) of (a:'Red')\'s (2 - 1))","R");
		});
		it("can be used with 'it' and 'its'", function (){
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to its (2))$a","4");
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to (2) of it)$a","4");
		});
		it("can have other 'it' accesses nested in it", function (){
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to (its (2)) of 'Blue')$a","e");
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to ((2) of it) of 'Blue')$a","e");
		});
		describe("for datamaps", function() {
			it("access the keyed properties", function() {
				expectMarkupToPrint('(print: (datamap:"A",1)\'s ("A"))','1');
			});
			it("prints an error if the key is not present", function() {
				expectMarkupToError('(print: (datamap:"A",1)\'s ("B"))');
			});
			it("can be used in assignments", function (){
				expectMarkupToPrint("(set: $d to (datamap:'A',2))(set: $d\'s ('A') to 4)(print:$d's A)","4");
			});
			it("prints an error if the key is numeric", function() {
				expectMarkupToError('(print: (datamap:1,1)\'s (1))');
			});
		});
		describe("for arrays", function() {
			it("can be used in assignments", function (){
				expectMarkupToPrint("(set: $a to (a:1,2))(set: $a\'s (1) to 2)$a","2,2");
				expectMarkupToPrint("(set: $a to (a:1,2))(set: (1) of $a\ to 2)$a","2,2");
				expectMarkupToPrint("(set: $a to (a:(a:1)))(set: $a\'s 1st\'s 1st to 2)$a","2");
				expectMarkupToPrint("(set: $a to (a:(a:1)))(set: (1) of (1) of $a\ to 2)$a","2");
			});
			it("must be numbers", function (){
				expectMarkupToError("(print: (a:'Red','Blue')\'s ('1'))");
				expectMarkupToError("(print: (a:'Red')\'s ('13'\'s 1st))");
			});
		});
	});
});

