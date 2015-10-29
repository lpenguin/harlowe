describe("twinescript temporary variables", function() {
	'use strict';
	it("can be set and printed, when using the _ sigil", function() {
		expectMarkupToPrint("(set: _a to 1)(print: _a)","1");
	});
	it("cannot be printed undeclared, and do not default to 0", function() {
		expectMarkupToError("(print: _a)");
		expectMarkupToError("(set: _a to _a + 1)");
	});
	it("forgets temporary variables when changing passages", function() {
		runPassage("(set: _a to 1)");
		expectMarkupToError("(print: _a)");
	});
	it("forgets temporary variables when leaving hooks passages", function() {
		expectMarkupToError("|a>[(set: _a to 1)(print:_a)] (print:_a)");
	});
	it("are correctly shadowed when using hooks", function() {
		expectMarkupToPrint("(set: _a to 2)|a>[(set: _a to 1)(print:_a)] (print:_a)","1 2");
	});
	it("are correctly shadowed when using (display:)", function() {
		createPassage("(set: _a to 1)(print:_a)", "grault");
		expectMarkupToPrint("(set: _a to 2)(display:'grault') (print:_a)","1 2");
	});
	/*
	it("can be used bare in passage text", function() {
		expectMarkupToPrint("(set: _a to 1)_a", "1");
		expectMarkupToPrint("(set: _a to 2)|a>[(set: _a to 1)_a] _a","1 2");
	});
	*/
});
