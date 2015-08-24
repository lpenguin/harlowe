describe("property indexing", function() {
	'use strict';
	describe("sequential indices", function() {
		describe("for strings", function() {
			it("'1st', '2nd', etc. access the indexed characters", function() {
				expectMarkupToPrint('(print: "𐌎ed"\'s 1st)', "𐌎");
				expectMarkupToPrint('(print: "𐌎ed"\'s 2nd)', "e");
				expectMarkupToPrint('(print: "𐌎ed"\'s 3rd)', "d");
			});
			it("are case-insensitive", function() {
				expectMarkupToPrint('(print: "𐌎ed"\'s 1sT)', "𐌎");
				expectMarkupToPrint('(print: "𐌎ed"\'s 2Nd)', "e");
				expectMarkupToPrint('(print: "𐌎ed"\'s 3RD)', "d");
			});
			it("ignores the exact ordinal used", function() {
				expectMarkupToPrint('(print: "𐌎ed"\'s 1th)', "𐌎");
				expectMarkupToPrint('(print: "𐌎ed"\'s 2rd)', "e");
				expectMarkupToPrint('(print: "𐌎ed"\'s 3st)', "d");
			});
			it("'last', '2ndlast', etc. accesses the right-indexed characters", function() {
				expectMarkupToPrint('(print: "𐌎ed"\'s 3rdlast)', "𐌎");
				expectMarkupToPrint('(print: "𐌎ed"\'s 2ndlast)', "e");
				expectMarkupToPrint('(print: "𐌎ed"\'s last)', "d");
			});
			it("'length' accesses the string's length", function() {
				expectMarkupToPrint('(print: "𐌎ed"\'s length)', "3");
				expectMarkupToPrint('(print: ""\'s length)', "0");
				expectMarkupToPrint('(print: "𐌎bcdefghijklmnopqrstuvwxyz"\'s length)', "26");
			});
			it("can be used as a right-hand-side of (set:)", function() {
				expectMarkupToPrint('(set: $a to "𐌎bc"\'s 1st)$a', "𐌎");
				expectMarkupToPrint('(set: $a to "𐌎bc"\'s last)$a', "c");
				expectMarkupToPrint('(set: $a to "𐌎bc"\'s length)$a', "3");
			});
			it("prints an error if the index is out of bounds", function() {
				expectMarkupToError('(print: "𐌎"\'s 2nd)');
				expectMarkupToError('(print: "𐌎ed"\'s 4th)');
			});
			it("can be used with 'it', as 'its'", function() {
				expectMarkupToPrint('(set:$s to "𐌎")(set: $s to its 1st)$s','𐌎');
				expectMarkupToPrint('(set:$s to "𐌎ed")(set: $s to its length)$s','3');
			});
			it("can be chained (worthlessly)", function() {
				expectMarkupToPrint('(print: "𐌎old"\'s last\'s 1st)','d');
			});
			it("can be assigned to", function() {
				expectMarkupToPrint('(set: $a to "𐌎old")(set: $a\'s last to "A")$a','𐌎olA');
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
			it("can be assigned to", function() {
				expectMarkupToPrint('(set:$a to (a:1,2))(set: $a\'s last to "A")$a','1,A');
			});
		});
		it("cannot be used with booleans", function() {
			expectMarkupToError('(print: false\'s 1st)');
			expectMarkupToError('(print: true\'s last)');
			expectMarkupToError('(set:$a to false)(set: $a\'s 1st to 1)');
			expectMarkupToError('(set:$a to true)(set: $a\'s last to 1)');
		});
		it("cannot be used with numbers", function() {
			expectMarkupToError('(print: 2\'s 1st)');
			expectMarkupToError('(print: -0.1\'s last)');
			expectMarkupToError('(set:$a to 2)(set: $a\'s 1st to 1)');
			expectMarkupToError('(set:$a to -0.1)(set: $a\'s last to 1)');
		});
		it("can be used as names in datamaps", function() {
			expectMarkupToError('(print: (datamap: "Sword", "Steel")\'s 1st)');
			expectMarkupToError('(print: (datamap: "Sword", "Steel")\'s last)');
			expectMarkupToNotError('(set:$a to (datamap: "Sword", "Steel"))(set: $a\'s 1st to 1)');
			expectMarkupToNotError('(set:$a to (datamap: "Sword", "Steel"))(set: $a\'s last to 1)');
		});
		it("cannot be used with datasets", function() {
			expectMarkupToError('(print: (dataset: 2,3)\'s 1st)');
			expectMarkupToError('(print: (dataset: 2,3)\'s last)');
			expectMarkupToError('(set:$a to (dataset: 2,3))(set: $a\'s 1st to 1)');
			expectMarkupToError('(set:$a to (dataset: 2,3))(set: $a\'s last to 1)');
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
			it("can include numbers", function() {
				runPassage("(set: $d to (datamap:1,5))(set: $d's 2 to 4)");
				expectMarkupToPrint('(print: $d\'s 2)', "4");
			});
			it("can't be used if the datamap already contains a different-typed similar key", function() {
				runPassage("(set: $d to (datamap:1,5,'2',4))");
				expectMarkupToError('(set: $d\'s 2 to 7)');
				expectMarkupToError('(set: $d\'s "1" to 6)');
			});
		});
		it("only 'length' can be used with arrays", function() {
			expectMarkupToPrint('(set: $s to (a: 2,3))(print: $s\'s length)', '2');
			expectMarkupToError('(set: $s to (a: 2,3))(set: $s\'s thing to 4)');
		});
		it("only 'length' can be used with datasets", function() {
			expectMarkupToPrint('(set: $s to (dataset: 2,3))(print: $s\'s length)', '2');
			expectMarkupToError('(set: $s to (dataset: 2,3))(set: $s\'s thing to 4)');
		});
		it("cannot be used with booleans", function() {
			expectMarkupToError('(print: false\'s "1")');
			expectMarkupToError('(print: true\'s "1")');
			expectMarkupToError('(set:$a to false)(set: $a\'s "1" to 1)');
			expectMarkupToError('(set:$a to true)(set: $a\'s "1" to 1)');
		});
		it("cannot be used with numbers", function() {
			expectMarkupToError('(print: 2\'s "1")');
			expectMarkupToError('(print: -0.1\'s "1")');
			expectMarkupToError('(set:$a to 2)(set: $a\'s "1" to 1)');
			expectMarkupToError('(set:$a to -0.1)(set: $a\'s "1" to 1)');
		});
	});
	describe("belonging indices", function() {
		it("can be used with strings", function() {
			expectMarkupToPrint('(print: 1st of "𐌎ed")', "𐌎");
			expectMarkupToPrint('(print: length of 1st of "𐌎ed")', "1");
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
	describe("the possessive operators", function() {
		it("perform property accesses with full expressions", function() {
			expectMarkupToPrint('(print: (a:7)\'s (2 - 1))','7');
			expectMarkupToPrint('(print: (a:7)\'s (either:1))','7');
		});
		it("can be chained", function (){
			expectMarkupToPrint("(print: (a:'Red')\'s (2 - 1)'s 1st)","R");
			expectMarkupToPrint("(print: (a:'Red')\'s (2 - 1)'s (2 - 1))","R");
		});
		it("can be used with 'it' and 'its'", function (){
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to its (2))$a","4");
		});
		it("does not require numbers to be bracketed", function (){
			expectMarkupToPrint("(print: (a:6,12)'s 1)","6");
		});
		it("has low precedence", function (){
			expectMarkupToPrint("(print: (a:6,12)'s (1) + 1)","7");
		});
		it("can have other 'it' accesses nested in it", function (){
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to (its (2)) of 'Blue')$a","e");
		});
		it("produces an error when given a boolean, datamap, or other invalid type", function (){
			expectMarkupToError("(print: (a:6,12)'s false)");
			expectMarkupToError("(print: (a:6,12)'s (datamap:'A','1'))");
			expectMarkupToError("(print: (a:6,12)'s (dataset:'A'))");
			expectMarkupToError("(print: (a:6,12)'s (text-style:'bold'))");
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
			it("allows numeric keys", function() {
				expectMarkupToPrint('(print: (datamap:1,7)\'s (1))', '7');
			});
			describe("with an array key", function() {
				it("evaluates to an array of keyed properties", function() {
					expectMarkupToPrint('(print: (datamap:"A",1,"B",2)\'s (a:"A","B"))','1,2');
				});
				it("can be chained", function() {
					expectMarkupToPrint('(print: (datamap:"A",1,"B",2)\'s (a:"A","B")\'s 1st)','1');
				});
				it("can be used in assignments", function() {
					expectMarkupToPrint('(set: $a to (datamap:"A",1,"B",2))(set: $a\'s (a:"A","B") to (a:"C","D"))(print:$a\'s "A" + $a\'s "B")','CD');
				});
			});
		});
		describe("for arrays", function() {
			it("can be used in assignments", function (){
				expectMarkupToPrint("(set: $a to (a:1,2))(set: $a\'s (1) to 2)$a","2,2");
				expectMarkupToPrint("(set: $a to (a:(a:1)))(set: $a\'s 1st\'s 1st to 2)$a","2");
			});
			it("must have numbers on the right side", function (){
				expectMarkupToError("(print: (a:'Red','Blue')\'s '1')");
				expectMarkupToError("(print: (a:'Red')\'s ('13'\'s 1st))");
			});
			describe("with an array key", function() {
				it("evaluates to an array of positional properties", function() {
					expectMarkupToPrint('(print: (a:"Red","Blue")\'s (a:1,2))','Red,Blue');
				});
				it("can be chained", function() {
					expectMarkupToPrint('(print: (a:"Red","Blue")\'s (a:1,2)\'s 1st)','Red');
					expectMarkupToPrint('(print: (a:"Red","Blue")\'s (a:1,2)\'s (a:1,2))','Red,Blue');
				});
				it("can be used in assignments", function() {
					expectMarkupToPrint('(set: $a to (a:7,8))(set: $a\'s (a:1,2) to (a:3,9))$a','3,9');
				});
				it("can also be chained in assignments", function() {
					expectMarkupToPrint('(set: $a to (a:7,8))(set: $a\'s (a:1,2)\'s (a:1,2) to (a:3,9))$a','3,9');
				});
			});
		});
		describe("for strings", function() {
			it("must have numbers on the right side, or 'length'", function (){
				expectMarkupToPrint("(print: \"𐌎ed\"'s (1))","𐌎");
				expectMarkupToPrint("(print: \"𐌎ed\"'s 'length')","3");
				expectMarkupToError("(print: '𐌎ed''s '1')");
				expectMarkupToError("(print: '𐌎lue''s ('13''s 1st))");
			});
			it("can be used with single-quoted strings", function (){
				expectMarkupToPrint("(print: '𐌎ed''s (1))","𐌎");
			});
			it("can be used in assignments", function (){
				expectMarkupToPrint("(set: $a to '𐌎ed''s (1))$a","𐌎");
			});
			describe("with an array key", function() {
				it("evaluates to a substring", function() {
					expectMarkupToPrint('(print: "𐌎ed"\'s (a:1,2))','𐌎e');
					expectMarkupToPrint('(print: "𐌎ed"\'s (a:3,1))','d𐌎');
				});
				it("can be chained", function() {
					expectMarkupToPrint('(print: "Red"\'s (a:1,2)\'s 1st)','R');
					expectMarkupToPrint('(print: "Red"\'s (a:1,2)\'s (a:1,2))','Re');
					expectMarkupToPrint('(print: "Gardyloo"\'s (a:6,5,4)\'s (a:3,1))','dl');
				});
				it("can be used in assignments", function() {
					expectMarkupToPrint('(set: $a to "𐌎old")(set: $a\'s (a:2,3) to "ar")$a','𐌎ard');
					expectMarkupToPrint('(set: $a to "𐌎old")(set: $a\'s (a:3,2) to "ar")$a','𐌎rad');
					expectMarkupToPrint('(set: $a to "o𐌎o")(set: $a\'s (a:3,1,3,1) to "abcd")$a','d𐌎c');
				});
				it("can also be chained in assignments", function() {
					expectMarkupToPrint('(set: $a to "𐌎old")(set: $a\'s (a:2,3)\'s (a:1,2) to "ar")$a','𐌎ard');
					expectMarkupToPrint('(set: $a to "𐌎old")(set: $a\'s (a:3,2)\'s (a:1,2) to "ar")$a','𐌎rad');
				});
			});
		});
	});
	describe("the belonging operator", function() {
		it("performs property accesses with full expressions", function() {
			expectMarkupToPrint('(print: (2 - 1) of (a:7))','7');
			expectMarkupToPrint('(print: ((either:1)) of (a:7))','7');
		});
		it("can be chained", function (){
			expectMarkupToPrint("(print: 1st of (a:'Red')\'s (2 - 1))","R");
			expectMarkupToPrint("(print: (2 - 1) of (a:'Red')\'s (2 - 1))","R");
		});
		it("has low precedence", function (){
			expectMarkupToPrint("(print: 1 + (1) of (a:6,12))","7");
		});
		it("does not require numbers to be bracketed", function (){
			expectMarkupToPrint("(print: 1 of (a:6,12))","6");
		});
		it("has lower precedence than the possessive operator", function (){
			expectMarkupToPrint("(print: (1) of (a:'Foo','Daa')'s 1st)","F");
		});
		it("can be used with 'it' and 'its'", function (){
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to (2) of it)$a","4");
		});
		it("can have other 'it' accesses nested in it", function (){
			expectMarkupToPrint("(set: $a to (a:3,4))(set: $a to ((2) of it) of 'Blue')$a","e");
		});
		describe("for datamaps", function() {
			it("accesses the keyed properties", function() {
				expectMarkupToPrint('(print: "A" of (datamap:"A",1))','1');
			});
			it("prints an error if the key is not present", function() {
				expectMarkupToError('(print: "B" of (datamap:"A",1))');
			});
			it("can be used in assignments", function (){
				expectMarkupToPrint("(set: $d to (datamap:'A',2))(set: 'A' of $d\ to 4)(print:$d's A)","4");
			});
			it("allows numeric keys", function() {
				expectMarkupToPrint('(print: 1 of (datamap:1,2))', '2');
			});
		});
		describe("for arrays", function() {
			it("can be used in assignments", function (){
				expectMarkupToPrint("(set: $a to (a:1,2))(set: (1) of $a\ to 2)$a","2,2");
				expectMarkupToPrint("(set: $a to (a:(a:1)))(set: (1) of (1) of $a\ to 2)$a","2");
			});
			it("must have numbers on the left side", function (){
				expectMarkupToError("(print: '1' of (a:'Red','Blue'))");
				expectMarkupToError("(print: ('13'\'s 1st) of (a:'Red'))");
			});
		});
		describe("for strings", function() {
			it("must have numbers on the left side, or 'length'", function (){
				expectMarkupToPrint("(print: (1) of '𐌎ed')","𐌎");
				expectMarkupToPrint("(print: 'length' of \"𐌎ed\")","3");
				expectMarkupToError("(print: '1' of '𐌎ed')");
				expectMarkupToError("(print: (1st of '13') of '𐌎lue')");
			});
		});
	});
});
