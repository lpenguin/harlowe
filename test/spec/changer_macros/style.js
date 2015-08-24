describe("style changer macros", function() {
	'use strict';
	describe("the (css:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expectMarkupToError("(css:)");
			expectMarkupToError("(css:1)");
			expectMarkupToError("(css:'A','B')");
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
			expectMarkupToPrint("(print: (css:'display:inline-block') + (css:'clear:both')"
				+ " is (css:'display:inline-block') + (css:'clear:both'))", "true");
			expectMarkupToPrint("(print: (css:'display:inline-block') + (css:'clear:both')"
				+ " is (css:'display:flex') + (css:'clear:both'))", "false");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(css:'color:red')");
			expectMarkupToNotError("(css:'color:red')[]");
		});
	});
	describe("the (textstyle:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expectMarkupToError("(print:(textstyle:))");
			expectMarkupToError("(print:(textstyle:1))");
			expectMarkupToError("(print:(textstyle:'A','B'))");
		});
		it("errors unless given a valid textstyle name", function() {
			expectMarkupToError("(print:(textstyle:''))");
			expectMarkupToError("(print:(textstyle:'garply corge'))");
			['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'blink', 'shudder',
			'mark', 'condense', 'expand', 'outline', 'shadow', 'emboss', 'smear', 'blur', 'blurrier',
			'mirror', 'upsidedown', 'fadeinout', 'rumble'].forEach(function(e) {
				expectMarkupToNotError("(print:(textstyle:'" + e + "'))");
			});
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(textstyle:'bold')");
			expectMarkupToNotError("(textstyle:'bold')[]");
		});
		// TODO: Add .css() tests of output.
	});
	describe("the (transition:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expectMarkupToError("(print:(transition:))");
			expectMarkupToError("(print:(transition:1))");
			expectMarkupToError("(print:(transition:'A','B'))");
		});
		it("errors unless given a valid transition name", function() {
			expectMarkupToError("(print:(transition:''))");
			expectMarkupToError("(print:(transition:'garply corge'))");
			["dissolve", "shudder", "pulse"].forEach(function(e) {
				expectMarkupToNotError("(print:(transition:'" + e + "'))");
			});
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(transition:'dissolve')");
			expectMarkupToNotError("(transition:'dissolve')[]");
		});
		it("has structural equality", function() {
			expectMarkupToPrint("(print: (transition:'dissolve') is (transition:'dissolve'))","true");
			expectMarkupToPrint("(print: (transition:'dissolve') is (transition:'pulse'))","false");
		});
		// TODO: Add .css() tests of output.
	});
	describe("the (background:) macro", function() {
		it("requires 1 string argument or 1 colour argument", function() {
			expectMarkupToError("(print:(background:))");
			expectMarkupToError("(print:(background:1))");
			expectMarkupToError("(print:(background:'A','B'))");
			expectMarkupToNotError("(print:(background:'A'))");
			expectMarkupToNotError("(print:(background:red + white))");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(background:'A')");
			expectMarkupToNotError("(background:'A')[]");
		});
		it("given a string, applies it as the background-image property", function(done) {
			var p = runPassage("(background:'garply')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-image:\s+url\(['"]?.*?garply['"]?\)/);
				done();
			});
		});
		it("given a string with a hex colour, applies it as the background-color property", function(done) {
			var p = runPassage("(background:'#601040')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-color:\s+(?:#601040|rgb\(\s*96,\s*16,\s*64\s*\))/);
				done();
			});
		});
		it("given a colour, applies it as the background-color property", function(done) {
			var p = runPassage("(background:black)[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-color:\s+(?:#000000|rgb\(\s*0,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("can compose with itself", function(done) {
			var p = runPassage("(set: $x to (background:black)+(background:'garply'))$x[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-image:\s+url\(['"]?.*?garply['"]?\)/);
				expect(p.attr('style')).toMatch(/background-color:\s+(?:#000000|rgb\(\s*0,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("compositions have structural equality", function() {
			expectMarkupToPrint("(print: (background:black)+(background:'garply') is (background:black)+(background:'garply'))","true");
			expectMarkupToPrint("(print: (background:black)+(background:'garply') is (background:black)+(background:'grault'))","false");
		});
	});
	describe("the (align:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expectMarkupToError("(print:(align:))");
			expectMarkupToError("(print:(align:1))");
			expectMarkupToError("(print:(align:'A','B'))");
		});
		it("errors if not given an valid arrow", function() {
			expectMarkupToError("(align:'')[]");
			expectMarkupToError("(align:'===')[]");
			expectMarkupToError("(align:'<<==')[]");
			expectMarkupToError("(align:'===><==>')[]");
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expectMarkupToError("(align:'==>')");
			expectMarkupToNotError("(align:'==>')[]");
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
			expectMarkupToPrint("(print: (align:'<==') is (align:'<=='))","true");
			expectMarkupToPrint("(print: (align:'<==') is (align:'=><=='))","false");
		});
	});
});
