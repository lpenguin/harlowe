describe("save macros", function() {
	'use strict';
	
	function retrieveStoredState(itemName) {
		var storedItem = localStorage.getItem(itemName);
		
		expect(function() {
			storedItem = JSON.parse(storedItem);
		}).not.toThrow();
		expect(storedItem).not.toBe(null);
		return storedItem;
	}
	
	describe("the (savegame:) macro", function() {
		it("accepts 1 or 2 strings", function() {
			expectMarkupToNotError("(savegame:'1')");
			expectMarkupToNotError("(savegame:'1','A')");
			expectMarkupToError("(savegame:)");
			expectMarkupToError("(savegame:2)");
			expectMarkupToError("(savegame:true)");
			expectMarkupToError("(savegame:'1','1','1')");
		});
		it("saves the game in localStorage in JSON format", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect(runPassage("(savegame:'1','Filename')", "qux").find('tw-error').length).toBe(0);
			
			retrieveStoredState("(Saved Game) 1");
		});
		it("works from the start of the game", function() {
			expect(runPassage("(savegame:'1','Filename')", "qux").find('tw-error').length).toBe(0);
			
			retrieveStoredState("(Saved Game) 1");
		});
		it("stores lots of data", function() {
			Array(1000).join().split(',').forEach(function(e) {
				runPassage("(set:$V" + e + " to " + e + ")","P"+e);
			});
			expect(runPassage("(savegame:'1','Filename')", "qux").find('tw-error').length).toBe(0);
			
			retrieveStoredState("(Saved Game) 1");
		});
		it("stores the save file's name", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect(runPassage("(savegame:'1','Quux')", "qux").find('tw-error').length).toBe(0);
			
			var storedItem = localStorage.getItem("(Saved Game Filename) 1");
			expect(storedItem).toBe("Quux");
		});
	});
	describe("the (loadgame:) macro", function() {
		it("accepts 1 string", function() {
			runPassage("(savegame:'1','Filename')");
			expectMarkupToError("(loadgame:)");
			expectMarkupToError("(loadgame:2)");
			expectMarkupToError("(loadgame:true)");
			expectMarkupToError("(loadgame:'1','1')");
		});
		it("loads a saved game, restoring the game history and navigating to the saved passage", function(done) {
			runPassage("uno", "uno");
			runPassage("dos(savegame:'1','Filename')", "dos");
			runPassage("tres", "tres");
			runPassage("cuatro(loadgame:'1')", "cuatro");
			requestAnimationFrame(function() {
				expect($("tw-passage").last().text()).toMatch("dos");
				expectMarkupToPrint("(history:)","Start,uno,dos");
				done();
			});
		});
		it("restores the saved game's variables", function(done) {
			runPassage("(set:$foo to 'egg')(set:$bar to 2)(set:$baz to true)", "uno");
			runPassage("(set:$bar to it + 2)(savegame:'1','Filename')", "dos");
			runPassage("(set:$bar to it + 2)(set:$foo to 'nut')", "tres");
			runPassage("(set:$bar to it + 2)(loadgame:'1')", "cuatro");
			requestAnimationFrame(function() {
				expectMarkupToPrint("$foo $bar (text: $baz)","egg 4 true");
				done();
			});
		});
	});
});
