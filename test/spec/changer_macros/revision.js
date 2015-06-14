describe("revision macros", function() {
	'use strict';
	describe("(append:)", function() {
		it("accepts either 1 hookset or 1 string", function() {
			expectMarkupToNotError("(print:(append:?foo))");
			expectMarkupToNotError("(print:(append:'baz'))");

			expectMarkupToError("(print:(append:?foo, ?bar))");
			expectMarkupToError("(print:(append:?foo, 'baz'))");
			expectMarkupToError("(print:(append:'baz', 'baz'))");
		});
		describe("given a single hook", function() {
			it("appends the attached hook's contents with that of the target hook", function() {
				var p = runPassage("[cool]<foo|(append:?foo)[hot]");
				expect(p.find('tw-hook[name=foo]').length).toBe(1);
				expect(p.text()).toBe('coolhot');
			});
			it("does not require the target hook to occur earlier than it #broken", function() {
				var p = runPassage("(append:?foo)[hot][cool]<foo|");
				expect(p.find('tw-hook[name=foo]').length).toBe(1);
				expect(p.text()).toBe('hotcool'); // ????
			});
			it("sequential appends occur in order", function() {
				var p = runPassage("[1]<foo|(append:?foo)[2](append:?foo)[3]");
				expect(p.text()).toBe('123');
			});
			it("nested appends are triggered one by one", function() {
				var p = runPassage("[1]<foo|(append:?foo)[2(append:?foo)[3]](append:?foo)[4]");
				expect(p.text()).toBe('1234');
			});
		});
		describe("given multiple hooks", function() {
			it("appends to each selected hook", function() {
				var p = runPassage("[bu]<foo|[los]<foo|(append:?foo)[s]");
				expect(p.find('tw-hook[name=foo]').length).toBe(2);
				expect(p.text()).toBe('busloss');
			});
			it("recomputes the source within each target", function() {
				var p = runPassage("(set:$a to 0)|foo>[A][B]<foo|[C]<foo|(append:?foo)[(set:$a to it + 1)$a]");
				expect(p.text()).toBe('A1B2C3');
			});
		});
		describe("given strings", function() {
			it("appends to every found string in the passage", function() {
				var p = runPassage("good good(append:'good')[lands]");
				expect(p.text()).toBe('goodlands goodlands');
			});
			it("only affects occurrences in a single pass", function() {
				var p = runPassage("reded(append:'red')[ r]");
				expect(p.text()).toBe('red red');
			});
			it("affects occurrences after the macro instance", function() {
				var p = runPassage("(append:'red')[blue]red");
				expect(p.text()).toBe('redblue');
			});
			it("sequential appends occur one by one", function() {
				var p = runPassage("red(append:'red')[blue](append: 'blue')[green]");
				expect(p.text()).toBe('redbluegreen');
			});
		});
	});
	describe("(replace:)", function() {
		it("accepts either 1 hookset or 1 string", function() {
			expectMarkupToNotError("(print:(replace:?foo))");
			expectMarkupToNotError("(print:(replace:'baz'))");

			expectMarkupToError("(print:(replace:?foo, ?bar))");
			expectMarkupToError("(print:(replace:?foo, 'baz'))");
			expectMarkupToError("(print:(replace:'baz', 'baz'))");
		});
		describe("given a single hook", function() {
			it("replaces the attached hook's contents with that of the target hook", function() {
				var p = runPassage("[cool]<foo|(replace:?foo)[hot]");
				expect(p.find('tw-hook[name=foo]').length).toBe(1);
				expect(p.text()).toBe('hot');
			});
			it("does not require the target hook to occur earlier than it #broken", function() {
				var p = runPassage("(replace:?foo)[hot][cool]<foo|");
				expect(p.find('tw-hook[name=foo]').length).toBe(1);
				expect(p.text()).toBe('hotcool'); // ????
			});
			it("sequential replacements occur in order", function() {
				var p = runPassage("[1]<foo|(replace:?foo)[2](replace:?foo)[3]");
				expect(p.text()).toBe('3');
			});
			it("nested replacements are triggered one by one", function() {
				var p = runPassage("[1]<foo|(replace:?foo)[2(replace:?foo)[3]](replace:?foo)[4]");
				expect(p.text()).toBe('4');
			});
		});
		describe("given multiple hooks", function() {
			it("replaces each selected hook", function() {
				var p = runPassage("[a]<foo|[b]<foo|(replace:?foo)[c]");
				expect(p.find('tw-hook[name=foo]').length).toBe(2);
				expect(p.text()).toBe('cc');
			});
			it("recomputes the source within each target", function() {
				var p = runPassage("(set:$a to 0)|foo>[A][B]<foo|[C]<foo|(replace:?foo)[(set:$a to it + 1)$a]");
				expect(p.text()).toBe('123');
			});
		});
		describe("given strings", function() {
			it("replaces every found string in the passage", function() {
				var p = runPassage("goodlands goodminton(replace:'good')[bad]");
				expect(p.text()).toBe('badlands badminton');
			});
			it("only affects occurrences in a single pass", function() {
				var p = runPassage("reded(replace:'red')[blue r]");
				expect(p.text()).toBe('blue red');
			});
			it("sequential replacements occur one by one", function() {
				var p = runPassage("red(replace:'red')[blue](replace: 'blue')[green]");
				expect(p.text()).toBe('green');
			});
			it("affects occurrences after the macro instance", function() {
				var p = runPassage("(replace:'red')[blue]red");
				expect(p.text()).toBe('blue');
			});
		});
	});
});
