describe("collapsing whitespace syntax", function() {
	'use strict';
	
	it("eliminates runs of whitespace between { and }", function() {
		expectMarkupToPrint(
			"A{   \n   }B",
			"AB"
		);
	});
	it("works on whitespace enclosed in elements", function() {
		expectMarkupToPrint(
			"A{ '' '' // // }B",
			"AB"
		);
	});
	it("reduces whitespace between non-whitespace to single spaces", function() {
		expectMarkupToPrint(
			"A { A  \n  B } B",
			"A A B B"
		);
		expectMarkupToPrint(
			"A{ C }B",
			"ACB"
		);
	});
	it("leaves other syntax as is", function() {
		var p = runPassage("{   ''A ''   } B");
		expect(p.text()).toBe("A B");
		expect(p.find('b').length).toBe(1);
		
		expectMarkupToPrint(
			"{A '' B''}",
			"A B"
		);
		expectMarkupToPrint(
			"{''B '' C}",
			"B C"
		);
	});
	it("leaves raw HTML <br> tags as is", function() {
		var p = runPassage("{\nA<br>\n<br>B\n}");
		expect(p.find('br').length).toBe(2);
	});
	it("collapses runs of whitespace between non-whitespace down to a single space", function() {
		expectMarkupToPrint(
			"{   A   B   }",
			"A B"
		);
		expectMarkupToPrint(
			"{   A B   }",
			"A B"
		);
		expectMarkupToPrint(
			"X{   A   B   }Y",
			"XA BY"
		);
		expectMarkupToPrint(
			"G{   A  }{ B   }H",
			"GA BH"
		);
	});
	it("can be nested", function() {
		expectMarkupToPrint(
			"{{   ''A''   }}  B  C",
			"A  B  C"
		);
		expectMarkupToPrint(
			"{  A {   ''B''   }} C",
			"A B C"
		);
	});
	it("can collapse spaces in empty elements", function() {
		expectMarkupToPrint(
			"{A '' '' B}",
			"A B"
		);
	});
	it("collapses through invisible expressions", function() {
		expectMarkupToPrint(
			"{ (set: $r to 1)\n(set: $r to 2) }",
			""
		);
		expectMarkupToPrint(
			"{A(set: $r to 1)B}",
			"AB"
		);
	});
	it("works with expressions", function() {
		expectMarkupToPrint("(set: $a to '')(set: $b to 'B'){A  $a $b $a C}", "A B C");
		expectMarkupToPrint("(set: $a to '')(set: $b to 'B')A{ $a $b $a }C", "ABC");
		expectMarkupToPrint("A{ (print:'') (print:'B') (print:'') }C", "ABC");
	});
	it("works inside (display:)", function() {
		createPassage("{B\nC}", "grault");
		expect(runPassage("A\n(display:'grault')").find('tw-expression br').length).toBe(0);
	});
	it("won't affect text inside HTML tags", function() {
		var p = runPassage("{<span title='   '> </span>}");
		expect(p.find('span').attr('title')).toBe("   ");
		expect(p.text()).toBe("");
	});
	it("won't affect text inside macros", function() {
		expectMarkupToPrint("{(print:'Red   Blue''s length)}", "10");
	});
	it("won't affect text outputted by expressions", function() {
		expectMarkupToPrint("{(set: $a to 'Red   Blue')(print:$a)}", "Red   Blue");
	});
	it("won't affect text outputted by (display:)", function() {
		createPassage("B\nC", "grault");
		expect(runPassage("A\n{(display:'grault')}").find('tw-expression br').length).toBe(1);
	});
	it("...unless the (display:)ed text itself contains the syntax", function() {
		createPassage("{B\nC}", "grault");
		expect(runPassage("A\n{(display:'grault')}").find('tw-expression br').length).toBe(0);
	});
	it("won't affect text inside verbatim guards", function() {
		var p = runPassage("{   `   `   }");
		expect(p.text()).toBe("   ");
		p = runPassage("{   `  A C  `   }");
		expect(p.text()).toBe("  A C  ");
		p = runPassage("{A`   `B}");
		expect(p.text()).toBe("A   B");
		p = runPassage("{A `   ` B}");
		expect(p.text()).toBe("A     B");
	});
	it("will affect text inside nested hooks", function() {
		expectMarkupToPrint("{ A(if:true)[      ]B }", "A B");
		expectMarkupToPrint("{ X(if:false)[      ]Y }", "XY");
		expectMarkupToPrint("{ C (if:true)[    ] D }", "C D");
		expectMarkupToPrint("{ E (if:true)[  F  ] G }", "E F G");
		expectMarkupToPrint("{ H (if:true)[  I  J ] K }", "H I J K");
	});
	it("doesn't needlessly eliminate preceding and trailing spaces in nested hooks", function() {
		expectMarkupToPrint(
			"{A[ A]<1| [B ]<1|B}",
			"A A B B"
		);
		expectMarkupToPrint(
			"{E['' ''E]<1| [B'' '']<1|B}",
			"E E B B"
		);
		expectMarkupToPrint(
			"{''C''[ ''C'']<1| [''D'' ]<1|''D''}",
			"C C D D"
		);
		expectMarkupToPrint(
			"{E [ E]<1| [F ]<1| F}",
			"E E F F"
		);
		expectMarkupToPrint(
			"{''G'' [ ''G'']<1| [''H'' ]<1| ''H''}",
			"G G H H"
		);
		expectMarkupToPrint(
			"{I'' ''['' ''I]<1| [J'' '']<1|'' ''J}",
			"I I J J"
		);
	});
	it("works with (replace:) inserting text across collapsed regions", function() {
		expectMarkupToPrint("{[]<1|(replace:?1)[Good     golly!]}", "Good golly!");
		expectMarkupToPrint("{[]<1|}{(replace:?1)[Good     golly!]}", "Good golly!");
	});
	it("works with (replace:) inserting text into and out of collapsed regions", function() {
		expectMarkupToPrint("{[]<1|}(replace:?1)[Good     golly!]", "Good     golly!");
		expectMarkupToPrint("[]<2|{(replace:?2)[Good     golly!]}", "Good golly!");
		expectMarkupToPrint("(replace:?1)[Good     golly?]{[]<1|}", "Good     golly?");
		expectMarkupToPrint("{(replace:?2)[Good     golly?]}[]<2|", "Good golly?");
	});
	it("works with links in nested hooks", function() {
		expectMarkupToPrint("{A[ [[B]]]<1|}", "A B");
		expectMarkupToPrint("{[[[D]] ]<1|C}", "D C");
		expectMarkupToPrint("{E[ [[F]] ]<1|G}", "E F G");
	});
	it("will not affect text inside verbatim guards inside nested hooks", function() {
		var p = runPassage("{ A (if:true)[`    `] B }");
		expect(p.text()).toBe("A      B");
		p = runPassage("{ C (if:true)[ ` `B` ` ] D }");
		expect(p.text()).toBe("C  B  D");
	});
	it("works even when empty", function() {
		expectMarkupToPrint("A{}B","AB");
	});
});
