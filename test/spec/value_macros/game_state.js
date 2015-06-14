describe("game state macros", function() {
	describe("the (passage:) macro", function() {
		it("accepts 0 or 1 string arguments", function() {
			createPassage("Red","The Kitchen");
			expectMarkupToNotError("(passage:)");
			expectMarkupToNotError("(passage:'The Kitchen')");
			expectMarkupToError("(passage:'The Kitchen','The Kitchen')");
		});
		it("when given nothing, returns the current passage as a datamap", function (){
			expect(runPassage("(print: (passage:)'s name)",'Gold').text() || '').toBe('Gold');
		});
		it("when given a string, returns the given story passage as a datamap", function (){
			createPassage("Red","The Kitchen");
			expectMarkupToPrint("(print: (passage: 'The Kitchen')'s source)", "Red");
		});
		it("errors if the passage is not present in the story", function (){
			expectMarkupToError("(print: (passage: 'The Kitchen'))");
		});
		it("passage datamaps have tags", function (){
			createPassage("Red","The Kitchen", ["area"]);
			expectMarkupToPrint("(print: (passage: 'The Kitchen')'s tags contains 'area')", "true");
		});
	});
});
