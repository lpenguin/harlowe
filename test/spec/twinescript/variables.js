describe("twinescript variables", function() {
	'use strict';
	describe("the (set:) macro", function() {
		it("requires one or more assignment requests", function() {
			expectMarkupToError("(set: 1)");
			expectMarkupToError("(set: 'A')");
			expectMarkupToError("(set: false)");
			expectMarkupToError("(set: $a)");
			expectMarkupToError("(set:)");
			expectMarkupToNotError("(set: $a to 1)");
			expectMarkupToNotError("(set: $a to 1, $b to 2)");
			expectMarkupToError("(set: $a to 1, 2)");
		});
		it("runs on evaluation, but can't be assigned or used as a value", function() {
			expectMarkupToError("(print: (set: $a to 1))", "true");
			expectMarkupToError("(print: (a:(set: $b to 2)))", ",1");
			expectMarkupToPrint("(print: $a + $b)","3");
		});
		it("when given a variable assignment request, sets the variable to a value", function() {
			expectMarkupToPrint("(set: $a to 1)(print: $a)","1");
		});
		it("when given a hook assignment request, fills the hook with the contents, as twinemarkup", function() {
			expectMarkupToPrint("|a>[Gee](set: ?a to '//Golly//')","Golly");
			expectMarkupToPrint("|a>[Gee](set: ?a to false)","");
			expectMarkupToPrint("|a>[Gee](set: ?a to (a:1,2,3))","1,2,3");
		});
		it("assignment requests can't be assigned", function() {
			expectMarkupToError("(set: $wordy to ($wordy to 2)) ");
			expectMarkupToError("(set: $wordy to (a: $wordy to 2)) ");
		});
	});
	describe("bare variables in passage text", function() {
		it("for numbers, prints the number", function() {
			runPassage("(set:$x to 0.125)");
			expectMarkupToPrint("$x", "0.125");
			runPassage("(set:$y to 0)");
			expectMarkupToPrint("$y", "0");
		});
		it("for strings, renders the string", function() {
			runPassage("(set:$x to '//italic//')");
			expectMarkupToPrint("$x", "italic");
			runPassage("(set:$y to '')");
			expectMarkupToPrint("$y", "");
		});
		it("for booleans, renders nothing", function() {
			runPassage("(set:$x to true)");
			expectMarkupToPrint("$x", "");
			runPassage("(set:$y to false)");
			expectMarkupToPrint("$y", "");
		});
		it("for arrays, prints the array", function() {
			runPassage("(set:$x to (a:1,2))");
			expectMarkupToPrint("$x", "1,2");
			runPassage("(set:$y to (a:))");
			expectMarkupToPrint("$y", "");
		});
	});
});
