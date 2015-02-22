describe("system variables", function () {
	'use strict';
	describe("the $Design identifier", function () {
		it("can't be reassigned", function (){
			expectMarkupToError("(set:$Design to 3)");
		});
		it("can't be expanded with new properties", function (){
			expectMarkupToError("(set:$Design's foo to 3)");
		});
	});
});
