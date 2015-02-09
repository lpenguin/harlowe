describe("save macros", function() {
	'use strict';
	
	function retrieveStoredItem(itemName) {
		var storedItem = localStorage.getItem(itemName);
		
		expect(function() {
			storedItem = JSON.parse(storedItem);
		}).not.toThrow();
		expect(storedItem).not.toBe(null);
		return storedItem;
	}
	
	describe("the (savegame:) macro", function() {
		it("saves the game in localStorage in JSON format", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect(runPassage("(savegame:'1','Filename')", "qux").find('tw-error').length).toBe(0);
			
			retrieveStoredItem("(Saved Game) 1");
		});
		it("works from the start of the game", function() {
			expect(runPassage("(savegame:'1','Filename')", "qux").find('tw-error').length).toBe(0);
			
			retrieveStoredItem("(Saved Game) 1");
		});
		it("stores the save file's name", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect(runPassage("(savegame:'1','Quux')", "qux").find('tw-error').length).toBe(0);
			
			var storedItem = retrieveStoredItem("(Saved Game) 1");
			expect(storedItem.filename).toBe("Quux");
		});
	});
});
