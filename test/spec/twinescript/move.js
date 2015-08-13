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
});
