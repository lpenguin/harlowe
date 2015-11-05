describe("basic command macros", function() {
	'use strict';
	
	describe("the (print:) macro", function() {
		it("requires exactly 1 argument of any type", function() {
			expect("(print:)").markupToError();
			expect("(print:1,2)").markupToError();
		});
		it("prints the text equivalent of number expressions", function() {
			expect("(print:2+0)").markupToPrint("2");
		});
		it("prints the text equivalent of string expressions", function() {
			expect("(print: 'gar' + 'ply')").markupToPrint("garply");
		});
		it("prints twinemarkup in strings", function() {
			var expr = runPassage("(print: '//gar' + 'ply//')").find('tw-expression');

			expect(expr.text()).toBe("garply");
			expect(expr.children().is('i')).toBe(true);
		});
		it("prints the text equivalent of boolean expressions", function() {
			expect("(print: true)").markupToPrint("true");
		});
		it("prints the text equivalent of arrays", function() {
			expect("(print: (a: 2))").markupToPrint("2");
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (print:1) + (print:1))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			var expr = runPassage("(set: $x to (print:'//grault//'))$x").find('tw-expression:last-child');

			expect(expr.text()).toBe("grault");
			expect(expr.children().is('i')).toBe(true);
		});
		it("stores its expression in its PrintCommand", function() {
			expect('(set: $name to "Dracula")'
				+ '(set: $p to (print: "Count " + $name))'
				+ '(set: $name to "Alucard")'
				+ '$p'
			).markupToPrint("Count Dracula");
		});
		it("will error if an infinite regress is created", function() {
			expect("(set: $x to '$x')(print: $x)").markupToError();
		});
	});
	describe("the (display:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(display:)").markupToError();
			expect("(display: 1)").markupToError();
			expect("(display:'A','B')").markupToError();
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
			expect("(print: (display:'grault') + (display:'grault'))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			createPassage("''Red''", "grault");
			var expr = runPassage("(set: $x to (display:'grault'))$x").find('tw-expression:last-child');

			expect(expr.text()).toBe("Red");
			expect(expr.children().is('b')).toBe(true);
		});
		it("produces an error if the passage doesn't exist", function() {
			expect("(display: 'grault')").markupToError();
		});
		it("will error if an infinite regress is created", function() {
			createPassage("(display: 'grault')", "grault");
			expect("(display: 'grault')").markupToError();
		});
	});
	describe("the (go-to:) macro", function() {
		
		function waitForGoto(callback) {
			setTimeout(function f() {
				if($('tw-passage:last-of-type tw-expression[name=go-to]').length > 0) {
					return setTimeout(f, 20);
				}
				callback();
			}, 20);
		}
		
		it("requires exactly 1 string argument", function() {
			expect("(go-to:)").markupToError();
			expect("(go-to: 1)").markupToError();
			expect("(go-to:'A','B')").markupToError();
		});
		it("when placed in a passage, navigates the player to another passage", function(done) {
			createPassage("''Red''", "croak");
			runPassage("(go-to: 'croak')");
			waitForGoto(function() {
				var expr = $('tw-passage:last-child').find('b');
				expect(expr.text()).toBe("Red");
				done();
			});
		});
		it("will count as a new turn in the session history", function(done) {
			createPassage("", "grault");
			runPassage("(go-to: 'grault')","garply");
			waitForGoto(function() {
				expect('(print:(history:))').markupToPrint('garply,grault');
				done();
			});
		});
		it("prevents macros after it from running", function(done) {
			createPassage("", "flunk");
			runPassage("(set:$a to 1)(go-to:'flunk')(set:$a to 2)");
			expect("$a").markupToPrint("1");
			waitForGoto(done);
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (go-to:'crepax') + (go-to:'crepax'))").markupToError();
		});
		it("can be (set:) into a variable", function(done) {
			createPassage("''Red''", "waldo");
			runPassage("(set: $x to (go-to:'waldo'))$x");
			waitForGoto(function() {
				var expr = $('tw-passage:last-child').find('b');
				expect(expr.text()).toBe("Red");
				done();
			});
		});
		it("produces an error if the passage doesn't exist", function() {
			expect("(go-to: 'freek')").markupToError();
		});
		it("transitions out the preceding <tw-passage> when stretchtext is off", function(done) {
			createPassage("''Red''", "waldo");
			runPassage("(set: $x to (go-to:'waldo'))$x");
			waitForGoto(function() {
				expect($('tw-passage').length).toBe(1);
				done();
			});
		});
	});
});
