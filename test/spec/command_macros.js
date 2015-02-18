describe("basic command macros", function() {
	'use strict';
	describe("the (print:) macro", function() {
		it("requires exactly 1 argument of any type", function() {
			var error = runPassage("(print:)").find('tw-error');
			expect(error.length).toBe(1);

			error = runPassage("(print:1,2)").find('tw-error');
			expect(error.length).toBe(1);
		});
		it("prints the text equivalent of number expressions", function() {
			expectMarkupToPrint("(print:2+0)", "2");
		});
		it("prints the text equivalent of string expressions", function() {
			expectMarkupToPrint("(print: 'gar' + 'ply')", "garply");
		});
		it("prints twinemarkup in strings", function() {
			var expr = runPassage("(print: '//gar' + 'ply//')").find('tw-expression');

			expect(expr.text()).toBe("garply");
			expect(expr.children().is('i')).toBe(true);
		});
		it("prints the text equivalent of boolean expressions", function() {
			expectMarkupToPrint("(print: true)", "true");
		});
		it("prints the text equivalent of arrays", function() {
			expectMarkupToPrint("(print: (a: 2))", "2");
		});
		it("evaluates to a command object that can't be +'d", function() {
			var error = runPassage("(print: (print:1) + (print:1))").find('tw-error');

			expect(error.length).toBe(1);
		});
		it("can be (set:) into a variable", function() {
			var expr = runPassage("(set: $x to (print:'//grault//'))$x").find('tw-expression:last-child');

			expect(expr.text()).toBe("grault");
			expect(expr.children().is('i')).toBe(true);
		});
		it("stores its expression in its PrintCommand", function() {
			expectMarkupToPrint('(set: $name to "Dracula")'
				+ '(set: $p to (print: "Count " + $name))'
				+ '(set: $name to "Alucard")'
				+ '$p',
				"Count Dracula");
		});
	});
	describe("the (display:) macro", function() {
		it("requires exactly 1 string argument", function() {
			var error = runPassage("(display:)").find('tw-error');
			expect(error.length).toBe(1);

			error = runPassage("(display: 1)").find('tw-error');
			expect(error.length).toBe(1);
			
			error = runPassage("(display:'A','B')").find('tw-error');
			expect(error.length).toBe(1);
		});
		it("when placed in a passage, prints out the markup of another passage", function() {
			createPassage("''Red''", "grault");
			var expr = runPassage("(display: 'grault')").find('tw-expression');

			expect(expr.text()).toBe("Red");
			expect(expr.children().is('b')).toBe(true);
		});
		it("macros in the displayed passage affect the host passage", function() {
			createPassage("(replace:'Big')[Small]", "grault");
			var expr = runPassage("Big(display: 'grault')");

			expect(expr.text()).toBe("Small");
		});
		it("evaluates to a command object that can't be +'d", function() {
			createPassage("''Red''", "grault");
			var error = runPassage("(print: (display:'grault') + (display:'grault'))").find('tw-error');

			expect(error.length).toBe(1);
		});
		it("can be (set:) into a variable", function() {
			createPassage("''Red''", "grault");
			var expr = runPassage("(set: $x to (display:'grault'))$x").find('tw-expression:last-child');

			expect(expr.text()).toBe("Red");
			expect(expr.children().is('b')).toBe(true);
		});
		it("produces an error if the passage doesn't exist", function() {
			var error = runPassage("(display: 'grault')").find('tw-error');
			expect(error.length).toBe(1);
		});
	});
});
