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
	describe("the $Passages variable", function () {
		it("can't be reassigned", function (){
			expectMarkupToError("(set:$Passages to 3)");
		});
		it("contains all the story's passages as datamaps", function (){
			createPassage("Red","The Kitchen");
			expectMarkupToPrint("(print:$Passages's ('The Kitchen')'s code)", "Red");
		});
		it("passage datamaps have tags", function (){
			createPassage("Red","The Kitchen", ["area"]);
			expectMarkupToPrint("(print:$Passages's ('The Kitchen')'s tags contains 'area')", "true");
		});
		it("passage datamaps can be edited", function (){
			createPassage("Red","The Kitchen");
			expectMarkupToPrint(
				"(set:$Passages's ('The Kitchen')'s code to 'Blue')(print: $Passages's ('The Kitchen')'s code)",
				"Blue"
			);
			expectMarkupToPrint(
				"(set:$Passages's ('The Kitchen')'s code to 'White')(display:'The Kitchen')",
				"White"
			);
		});
	});
});
