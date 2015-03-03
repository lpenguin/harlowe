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
		it("passage datamaps can be added", function (){
			expectMarkupToPrint(
				"(set: $Passages's ('The Parlour') to (datamap:'code','Blue'))(display:'The Parlour')",
				"Blue"
			);
		});
		it("will error if an incomplete datamap is supplied", function (){
			expectMarkupToNotError(
				"(set: $Passages's ('The Attic') to (datamap:))"
			);
			expectMarkupToError("(display:'The Attic')");
			expectMarkupToError("[[The Attic]]");
			expectMarkupToError("(go-to:'The Attic')");
		});
		it("will error if a non-datamap is supplied", function (){
			expectMarkupToNotError(
				"(set: $Passages's ('The Porch') to 52)"
			);
			expectMarkupToError("(display:'The Porch')");
			expectMarkupToError("[[The Porch]]");
			expectMarkupToError("(go-to:'The Porch')");
		});
	});
});
