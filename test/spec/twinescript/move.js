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
});
