describe("game state macros", function() {
	'use strict';
	describe("the (passage:) macro", function() {
		it("accepts 0 or 1 string arguments", function() {
			createPassage("Red","The Kitchen");
			expect("(passage:)").not.markupToError();
			expect("(passage:'The Kitchen')").not.markupToError();
			expect("(passage:'The Kitchen','The Kitchen')").markupToError();
		});
		it("when given nothing, returns the current passage as a datamap", function (){
			expect(runPassage("(print: (passage:)'s name)",'Gold').text() || '').toBe('Gold');
		});
		it("when given a string, returns the given story passage as a datamap", function (){
			createPassage("Red","The Kitchen");
			expect("(print: (passage: 'The Kitchen')'s source)").markupToPrint("Red");
		});
		it("errors if the passage is not present in the story", function (){
			expect("(print: (passage: 'The Kitchen'))").markupToError();
		});
		it("passage datamaps have tags", function (){
			createPassage("Red","The Kitchen", ["area"]);
			expect("(print: (passage: 'The Kitchen')'s tags contains 'area')").markupToPrint("true");
		});
	});
});
