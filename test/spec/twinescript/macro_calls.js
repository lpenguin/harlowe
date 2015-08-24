describe("macro calls", function() {
	'use strict';
	it("consist of a (, the name, a :, arguments, and )", function() {
		expectMarkupToPrint("(a:)", "");
		expectMarkupToPrint("(a:1)", "1");
		expectMarkupToPrint("(a:1,1)", "1,1");

		expectMarkupToPrint("(a 1,1)", "(a 1,1)");
		expectMarkupToPrint("(a:1,1", "(a:1,1");
	});
	it("can have whitespace between the :, each argument, and )", function() {
		expectMarkupToPrint("(a: \n )", "");
		expectMarkupToPrint("(a:\n1 )", "1");
		expectMarkupToPrint("(a:\n 1\n ,\n 1\n )", "1,1");
	});
	it("cannot have whitespace between the name and :", function() {
		expectMarkupToPrint("(a : )", "(a : )");
	});
	it("cannot have whitespace between the ( and name", function() {
		expectMarkupToPrint("( a: )", "( a: )");
	});
	it("can have a trailing , after the final argument", function() {
		expectMarkupToPrint("(a:\n 1\n ,\n 1\n, )", "1,1");
	});
});
