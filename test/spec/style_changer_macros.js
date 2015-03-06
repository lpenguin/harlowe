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
	});
});
