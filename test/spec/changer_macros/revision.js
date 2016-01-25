describe("revision macros", function() {
	'use strict';
	['append','prepend'].forEach(function(name,index) {
		var append=!index;
		describe("("+name+":)", function() {
			it("accepts multiple hooksets and/or strings", function() {
				expect("(print:("+name+":?foo))").not.markupToError();
				expect("(print:("+name+":'baz'))").not.markupToError();
				expect("(print:("+name+":?foo, ?bar))").not.markupToError();
				expect("(print:("+name+":?foo, 'baz'))").not.markupToError();
				expect("(print:("+name+":'baz', 'baz'))").not.markupToError();
				expect("(print:("+name+":?foo, ?bar, ?baz))").not.markupToError();
				expect("(print:("+name+":'baz', 'baz', 'baz'))").not.markupToError();
			});
			describe("given a single hook", function() {
				it(name+"s the attached hook's contents with that of the target hook", function() {
					var p = runPassage("[cool]<foo|("+name+":?foo)[hot]");
					expect(p.find('tw-hook[name=foo]').length).toBe(1);
					expect(p.text()).toBe(append?'coolhot':'hotcool');
				});
				xit("does not require the target hook to occur earlier than it", function() {
					var p = runPassage("("+name+":?foo)[hot][cool]<foo|");
					expect(p.find('tw-hook[name=foo]').length).toBe(1);
					expect(p.text()).toBe(append?'coolhot':'hotcool');
				});
				it("sequential "+name+"s occur in order", function() {
					var p = runPassage("[1]<foo|("+name+":?foo)[2]("+name+":?foo)[3]");
					expect(p.text()).toBe(append?'123':'321');
				});
				it("nested "+name+"s are triggered one by one", function() {
					var p = runPassage("[1]<foo|("+name+":?foo)[2("+name+":?foo)[3]]("+name+":?foo)[4]");
					expect(p.text()).toBe(append?'1234':'4321');
				});
				it("can be composed with other ("+name+":)s", function() {
					var p = runPassage("(set:$s to ("+name+":?foo) + ("+name+":?bar))|foo>[1][2]<bar|$s[0]");
					expect(p.text()).toBe(append?'1020':'0102');
				});
				xit("when stored, can work across passages", function() {
					runPassage("(set:$s to ("+name+":?bar))");
					var p = runPassage("[2]<bar|$s[0]");
					expect(p.text()).toBe(append?'20':'02');
				});
			});
			describe("given multiple same-named hooks", function() {
				it(name+"s to each selected hook", function() {
					var p = runPassage("[bu]<foo|[los]<foo|("+name+":?foo)[s]");
					expect(p.find('tw-hook[name=foo]').length).toBe(2);
					expect(p.text()).toBe(append?'busloss':'sbuslos');
				});
				it("recomputes the source within each target", function() {
					var p = runPassage("(set:$a to 0)|foo>[A][B]<foo|[C]<foo|("+name+":?foo)[(set:$a to it + 1)$a]");
					expect(p.text()).toBe(append?'A1B2C3':'1A2B3C');
				});
			});
			describe("given multiple different-named hooks", function() {
				it(name+"s to each selected hook", function() {
					var p = runPassage("[bu]<foo|[los]<bar|("+name+":?bar,?foo)[s]");
					expect(p.find('tw-hook[name=foo], tw-hook[name=bar]').length).toBe(2);
					expect(p.text()).toBe(append?'busloss':'sbuslos');
				});
				it("recomputes the source within each target, in document position order", function() {
					var p = runPassage("(set:$a to 0)|foo>[A][B]<bar|[C]<baz|("+name+":?foo,?baz,?bar)[(set:$a to it + 1)$a]");
					expect(p.text()).toBe(append?'A1B2C3':'1A2B3C');
				});
				xit("can be composed with other ("+name+":)s", function() {
					var p = runPassage("(set:$s to ("+name+":?foo, ?bar) + ("+name+":?bar, ?baz))|foo>[1][2]<bar|[3]<baz|$s[0]");
					expect(p.text()).toBe(append?'102030':'010203');
				});
			});
			describe("given a string", function() {
				it(name+"s to every found string in the passage", function() {
					var p = runPassage("good good("+name+":'good')[lands]");
					expect(p.text()).toBe(append?'goodlands goodlands':'landsgood landsgood');
				});
				it("only affects occurrences in a single pass", function() {
					var p = runPassage("reded("+name+":'red')[ r]");
					expect(p.text()).toBe(append?'red red':' rreded');
				});
				it("affects occurrences after the macro instance", function() {
					var p = runPassage("("+name+":'red')[blue]red");
					expect(p.text()).toBe(append?'redblue':'bluered');
				});
				it("sequential "+name+"s occur one by one", function() {
					var p = runPassage("red("+name+":'red')[blue]("+name+": 'blue')[green]");
					expect(p.text()).toBe(append?'redbluegreen':'greenbluered');
				});
				it("recomputes the source within each target", function() {
					var p = runPassage("(set:$a to 0)AAA("+name+":'A')[(set:$a to it + 1)$a]");
					expect(p.text()).toBe(append?'A1A2A3':'1A2A3A');
				});
				it("can be composed with other ("+name+":)s", function() {
					runPassage("(set:$s to ("+name+":'1') + ("+name+":'2'))");
					var p = runPassage("12$s[0]");
					expect(p.text()).toBe(append?'1020':'0102');
				});
			});
			describe("given multiple strings", function() {
				it(name+"s to every found string in the passage", function() {
					var p = runPassage("good bad("+name+":'good','bad')[lands]");
					expect(p.text()).toBe(append?'goodlands badlands':'landsgood landsbad');
				});
				xit("only affects occurrences in a single pass", function() {
					var p = runPassage("reded("+name+":'red','blue')[blue r]");
					expect(p.text()).toBe(append?'redblue red':' blue rreded');
				});
				it("recomputes the source within each target, in document position order", function() {
					var p = runPassage("(set:$a to 0)ABC("+name+":'A','C','B')[(set:$a to it + 1)$a]");
					expect(p.text()).toBe(append?'A1B2C3':'1A2B3C');
				});
				xit("can be composed with other ("+name+":)s", function() {
					runPassage("(set:$s to ("+name+":'1','2') + ("+name+":'2','3'))");
					var p = runPassage("123$s[0]");
					expect(p.text()).toBe(append?'102030':'010203');
				});
			});
		});
	});
	describe("(replace:)", function() {
		it("accepts multiple hooksets and/or strings", function() {
			expect("(print:(replace:?foo))").not.markupToError();
			expect("(print:(replace:'baz'))").not.markupToError();
			expect("(print:(replace:?foo, ?bar))").not.markupToError();
			expect("(print:(replace:?foo, 'baz'))").not.markupToError();
			expect("(print:(replace:'baz', 'baz'))").not.markupToError();
			expect("(print:(replace:?foo, ?bar, ?baz))").not.markupToError();
			expect("(print:(replace:'baz', 'baz', 'baz'))").not.markupToError();
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
		describe("given multiple same-named hooks", function() {
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
		describe("given multiple different-named hooks", function() {
			it("replaces each selected hook", function() {
				var p = runPassage("[a]<foo|[b]<bar|(replace:?foo,?bar)[c]");
				expect(p.find('tw-hook[name=foo],tw-hook[name=bar]').length).toBe(2);
				expect(p.text()).toBe('cc');
			});
			it("recomputes the source within each target, in document position order", function() {
				var p = runPassage("(set:$a to 0)|foo>[A][B]<bar|[C]<baz|(replace:?foo,?baz,?bar)[(set:$a to it + 1)$a]");
				expect(p.text()).toBe('123');
			});
		});
		describe("given a string", function() {
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
		describe("given multiple strings", function() {
			it("replaces every found string in the passage", function() {
				var p = runPassage("good bad(replace:'good','bad')[lands]");
				expect(p.text()).toBe('lands lands');
			});
			xit("only affects occurrences in a single pass", function() {
				var p = runPassage("reded(replace:'red','blue')[blue r]");
				expect(p.text()).toBe('blue red');
			});
			it("recomputes the source within each target, in document position order", function() {
				var p = runPassage("(set:$a to 0)ABC(replace:'A','C','B')[(set:$a to it + 1)$a]");
				expect(p.text()).toBe('123');
			});
			xit("can be composed with other (replace:)s", function() {
				runPassage("(set:$a to 0)(set:$s to (replace:'A','B') + (replace:'2','B',C'))");
				var p = runPassage("ABC$s[(set:$a to it + 1)$a]");
				expect(p.text()).toBe('123');
			});
		});
	});
	xit("can be composed with each other", function() {
		runPassage("(set:$s to (append:'1') + (prepend:'2'))");
		var p = runPassage("12$s[0]");
		expect(p.text()).toBe('1002');
	});
});
