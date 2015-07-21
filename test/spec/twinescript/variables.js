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
		it("runs on evaluation, and evaluates to the empty string", function() {
			expectMarkupToPrint("(print: (set: $a to 1) is '')", "true");
			expectMarkupToPrint("(print: (a:(set: $a to 1), $a))", ",1");
		});
	});
});
