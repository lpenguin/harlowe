describe("restricted syntax", function() {
	'use strict';
	describe("Twine 1 macro syntax", function() {
		it("will simply print an error", function() {
			expectMarkupToError("<<set $red to 1>>");
		});
	});
});
