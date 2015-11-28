describe("the (move:) macro", function() {
	'use strict';
	it("requires an 'into' assignment request", function() {
		expectMarkupToError("(move: 1)");
		expectMarkupToError("(move: 'A')");
		expectMarkupToError("(move: false)");
		expectMarkupToError("(move: $a)");
		expectMarkupToError("(move:)");
		expectMarkupToNotError("(move: $b into $a)");
		expectMarkupToNotError("(move: $b into $a, $c into $b)");
		expectMarkupToError("(move: $a to 1)");
		expectMarkupToError("(move: $a to $b)");
	});
	it("when given a variable assignment request, moves one variable's value into the other", function() {
		expectMarkupToPrint("(set: $a to 1)(move: $a into $b)$b $a","1 0");
	});
	it("runs on evaluation, but can't be assigned or used as a value", function() {
		runPassage("(set: $a to 3)");
		expectMarkupToError("(print: (move: $a into $b))");
		expectMarkupToError("(print: (a:(move: $b into $c)))");
		expectMarkupToPrint("(print: $c)","3");
	});
	it("when given a hook assignment request, fills the hook with the contents, as twinemarkup", function() {
		expectMarkupToPrint("|a>[Gee] |b>[Wow](move: ?a into ?b)"," Gee");
	});
	it("can replace array properties", function() {
		runPassage("(set: $a to (a:3,1))(set: $b to 2)(move: $b into $a's last)");
		expectMarkupToPrint("$b", "0");
		expectMarkupToPrint("(print:$a)","3,2");
	});
	it("can remove array properties", function() {
		runPassage("(set: $a to (a:3,2))(move: $a's last into $b)");
		expectMarkupToPrint("$b", "2");
		expectMarkupToPrint("(print:$a's last)","3");
	});
	it("can insert datamap properties", function() {
		runPassage("(set: $d to (datamap:))(set: $b to 3)(move: $b into $d's A)");
		expectMarkupToPrint("$b", "0");
		expectMarkupToPrint("(print:$d's A)","3");
	});
	it("can replace datamap properties", function() {
		runPassage("(set: $d to (datamap:'B',2))(set: $b to 3)(move: $b into $d's B)");
		expectMarkupToPrint("$b", "0");
		expectMarkupToPrint("(print:$d's B)","3");
	});
	it("can remove datamap properties", function() {
		runPassage("(set: $d to (datamap:'A',2,'B',3))(move: $d's A into $b)");
		expectMarkupToPrint("$b", "2");
		expectMarkupToError("(print:$d's A)");
	});
	describe("doesn't pollute past turns", function() {
		it("when replacing array properties", function() {
			runPassage("(set: $a to (a:0,1))(set: $b to 2)","one");
			runPassage("(move: $b into $a's last)(set: $b to 3)","two");
			runPassage("(move: $b into $a's last)(set: $b to 4)","three");
			Engine.goBack();
			expectMarkupToPrint("$b","3");
			expectMarkupToPrint("(print:$a)","0,2");
		});
		it("when removing array properties", function() {
			runPassage("(set: $a to (a:0,1,2))","one");
			runPassage("(move: $a's last into $b)","two");
			runPassage("(move: $a's last into $b)","three");
			Engine.goBack();
			expectMarkupToPrint("$b","2");
			expectMarkupToPrint("(print:$a)","0,1");
		});
		it("when inserting datamap properties", function() {
			runPassage("(set: $d to (datamap:))(set: $b to 3)","one");
			runPassage("(move: $b into $d's A)(set: $b to 2)","two");
			runPassage("(move: $b into $d's B)(set: $b to 1)","three");
			Engine.goBack();
			expectMarkupToPrint("$b","2");
			expectMarkupToPrint("(print:$d's A)","3");
			expectMarkupToError("(print:$d's B)");
		});
		it("when replacing datamap properties", function() {
			runPassage("(set: $d to (datamap:'A',3))(set: $b to 2)","one");
			runPassage("(move: $b into $d's B)(set: $b to 1)","two");
			runPassage("(move: $b into $d's C)","three");
			Engine.goBack();
			expectMarkupToPrint("$b","1");
			expectMarkupToPrint("(print:$d's B)","2");
			expectMarkupToError("(print:$d's C)");
		});
		it("when removing datamap properties", function() {
			runPassage("(set: $d to (datamap:'A',2,'B',3))","one");
			runPassage("(move: $d's A into $b)","two");
			runPassage("(move: $d's B into $b)","three");
			Engine.goBack();
			expectMarkupToPrint("$b","2");
			expectMarkupToError("(print:$d's A)");
			expectMarkupToPrint("(print:$d's B)","3");
		});
	});
});
