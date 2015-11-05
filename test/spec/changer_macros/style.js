describe("style changer macros", function() {
	'use strict';
	describe("the (css:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(css:)").markupToError();
			expect("(css:1)").markupToError();
			expect("(css:'A','B')").markupToError();
		});
		it("applies the passed CSS to the hook as an inline style property", function() {
			expect(runPassage("(css:'display:inline-block')[Hey]").find('tw-hook').css('display'))
				.toBe('inline-block');
			expect(runPassage("(css:'clear:both;')[Hey]").find('tw-hook').css('clear'))
				.toBe('both');
		});
		it("can be (set:) in a variable", function() {
			runPassage("(set: $s to (css:'display:inline-block;'))");
			var hook = runPassage("$s[Hey]").find('tw-hook');
			expect(hook.css('display')).toBe('inline-block');
		});
		it("can compose with itself", function() {
			runPassage("(set: $s to (css:'display:inline-block') + (css:'clear:both'))");
			var hook = runPassage("$s[Hey]").find('tw-hook');
			expect(hook.css('display')).toBe('inline-block');
			expect(hook.css('clear')).toBe('both');
		});
		it("compositions have structural equality", function() {
			expect("(print: (css:'display:inline-block') + (css:'clear:both')"
				+ " is (css:'display:inline-block') + (css:'clear:both'))").markupToPrint("true");
			expect("(print: (css:'display:inline-block') + (css:'clear:both')"
				+ " is (css:'display:flex') + (css:'clear:both'))").markupToPrint("false");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(css:'color:red')").markupToError();
			expect("(css:'color:red')[]").not.markupToError();
		});
	});
	describe("the (textstyle:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(print:(textstyle:))").markupToError();
			expect("(print:(textstyle:1))").markupToError();
			expect("(print:(textstyle:'A','B'))").markupToError();
		});
		it("errors unless given a valid textstyle name", function() {
			expect("(print:(textstyle:''))").markupToError();
			expect("(print:(textstyle:'garply corge'))").markupToError();
			['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'blink', 'shudder',
			'mark', 'condense', 'expand', 'outline', 'shadow', 'emboss', 'smear', 'blur', 'blurrier',
			'mirror', 'upsidedown', 'fadeinout', 'rumble'].forEach(function(e) {
				expect("(print:(textstyle:'" + e + "'))").not.markupToError();
			});
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(textstyle:'bold')").markupToError();
			expect("(textstyle:'bold')[]").not.markupToError();
		});
		// TODO: Add .css() tests of output.
	});
	describe("the (transition:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(print:(transition:))").markupToError();
			expect("(print:(transition:1))").markupToError();
			expect("(print:(transition:'A','B'))").markupToError();
		});
		it("errors unless given a valid transition name", function() {
			expect("(print:(transition:''))").markupToError();
			expect("(print:(transition:'garply corge'))").markupToError();
			["dissolve", "shudder", "pulse"].forEach(function(e) {
				expect("(print:(transition:'" + e + "'))").not.markupToError();
			});
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(transition:'dissolve')").markupToError();
			expect("(transition:'dissolve')[]").not.markupToError();
		});
		it("has structural equality", function() {
			expect("(print: (transition:'dissolve') is (transition:'dissolve'))").markupToPrint("true");
			expect("(print: (transition:'dissolve') is (transition:'pulse'))").markupToPrint("false");
		});
		// TODO: Add .css() tests of output.
	});
	describe("the (transition-time:) macro", function() {
		it("requires exactly 1 number argument", function() {
			expect("(print:(transition:))").markupToError();
			expect("(print:(transition:'A'))").markupToError();
			expect("(print:(transition:2,2))").markupToError();
		});
		it("errors unless given a positive number", function() {
			expect("(print:(transition-time:0s))").markupToError();
			expect("(print:(transition-time:-50ms))").markupToError();
			expect("(print:(transition-time:50ms))").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(transition-time:2s)").markupToError();
			expect("(transition-time:2s)[]").not.markupToError();
		});
		it("has structural equality", function() {
			expect("(print: (transition-time:2s) is (transition-time:2s))").markupToPrint("true");
			expect("(print: (transition-time:2s) is (transition-time:2ms))").markupToPrint("false");
		});
		// TODO: Add .css() tests of output.
	});
	describe("the (background:) macro", function() {
		it("requires 1 string argument or 1 colour argument", function() {
			expect("(print:(background:))").markupToError();
			expect("(print:(background:1))").markupToError();
			expect("(print:(background:'A','B'))").markupToError();
			expect("(print:(background:'A'))").not.markupToError();
			expect("(print:(background:red + white))").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(background:'A')").markupToError();
			expect("(background:'A')[]").not.markupToError();
		});
		it("given a string, applies it as the background-image property", function(done) {
			var p = runPassage("(background:'garply')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-image:\s*url\(['"]?.*?garply['"]?\)/);
				done();
			});
		});
		it("given a string with a hex colour, applies it as the background-color property", function(done) {
			var p = runPassage("(background:'#601040')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-color:\s*(?:#601040|rgb\(\s*96,\s*16,\s*64\s*\))/);
				done();
			});
		});
		it("given a colour, applies it as the background-color property", function(done) {
			var p = runPassage("(background:black)[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-color:\s*(?:#000000|rgb\(\s*0,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("can compose with itself", function(done) {
			var p = runPassage("(set: $x to (background:black)+(background:'garply'))$x[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-image:\s*url\(['"]?.*?garply['"]?\)/);
				expect(p.attr('style')).toMatch(/background-color:\s*(?:#000000|rgb\(\s*0,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("compositions have structural equality", function() {
			expect("(print: (background:black)+(background:'garply') is (background:black)+(background:'garply'))").markupToPrint("true");
			expect("(print: (background:black)+(background:'garply') is (background:black)+(background:'grault'))").markupToPrint("false");
		});
	});
	describe("the (align:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(print:(align:))").markupToError();
			expect("(print:(align:1))").markupToError();
			expect("(print:(align:'A','B'))").markupToError();
		});
		it("errors if not given an valid arrow", function() {
			expect("(align:'')[]").markupToError();
			expect("(align:'===')[]").markupToError();
			expect("(align:'<<==')[]").markupToError();
			expect("(align:'===><==>')[]").markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(align:'==>')").markupToError();
			expect("(align:'==>')[]").not.markupToError();
		});
		it("right-aligns text when given '==>'", function(done) {
			var align = runPassage("(align:'==>')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('right');
				expect(align.text()).toBe('garply');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
				done();
			});
		});
		it("ignores the number of, and imbalance of, = signs used", function(done) {
			[2,3,4,5,6,7,8,9,10].forEach(function(number) {
				var align = runPassage("(align:'" + "=".repeat(number) + ">')[garply]").find('tw-hook');
				setTimeout(function() {
					expect(align.css('text-align')).toBe('right');
					expect(align.text()).toBe('garply');
					expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
					done();
				});
			});
		});
		it("centres text with a balanced '=><='", function(done) {
			var align = runPassage("(align:'=><=')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('center');
				expect(align.text()).toBe('garply');
				expect(align.attr('style')).toMatch(/max-width:\s*50%/);
				expect(align.attr('style')).toMatch(/margin-left:\s*auto/);
				expect(align.attr('style')).toMatch(/margin-right:\s*auto/);
				done();
			});
		});
		it("justifies text with '<==>'", function(done) {
			var align = runPassage("(align:'<==>')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('justify');
				expect(align.text()).toBe('garply');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
				done();
			});
		});
		it("left-aligns text when given '<=='", function(done) {
			var align = runPassage("(align:'==>')[(align:'<==')[garply]]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('right');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
				align = align.find('tw-hook');
				expect(align.css('text-align')).toBe('left');
				expect(align.css('margin-right')).toMatch(/^(?:0px)?$/);
				done();
			});
		});
		it("aligns text with unbalanced '==><='", function(done) {
			var align = runPassage("(align:'==><====')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('center');
				expect(align.attr('style')).toMatch(/margin-left:\s*17%/);
			
				align = runPassage("(align:'=====><=')[garply]").find('tw-hook');
				setTimeout(function() {
					expect(align.css('text-align')).toBe('center');
					expect(align.attr('style')).toMatch(/margin-left:\s*42%/);
					done();
				});
			});
		});
		it("has structural equality", function() {
			expect("(print: (align:'<==') is (align:'<=='))").markupToPrint("true");
			expect("(print: (align:'<==') is (align:'=><=='))").markupToPrint("false");
		});
	});
});
