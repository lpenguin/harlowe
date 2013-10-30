define(['story', 'utils'], function(Story, Utils) {
	"use strict";
	/*
		State
		Singleton controlling the running game state.
		
		Internal object type: StateInstance
	*/

	// Prototype object for states remembered by the game.
	var StateInstance = {
		// Variables
		variables: {},

		// Current passage ID
		passage: "",

		// Make a new state
		create: function (v, p) {
			var ret = Object.create(StateInstance);
			ret.variables = (v ? Utils.clone(v) : {});
			ret.passage = p || "";
			return ret;
		}
	};

	// The present, after or while the current passage is executing.
	// This is pushed into recent when going forward.
	var present = StateInstance.create();

	// The game state at the point the current passage began execution.
	// This is pushed into the past when going forward,
	// pushed into the future when going backward,
	// or used to serialise the game state.
	// (Revisiting the passage should thus cause it to behave identically to
	// the original visit.)
	var recent = StateInstance.create();

	// Stack of previous states.
	var past = [];

	// Stack of states wound back from.
	var future = [];

	/*
		Values specific to the current passage, which
		are reset by changePassage();
	*/

	// Passage-specific hook macros.
	var hookMacros = {};

	/*
		The current game's state.
	*/
	var State = {
		/*
			Getters/setters
		*/

		// Get the current passage ID.
		// Used by <<set>> and other state-altering macros.
		get passage() {
			return present.passage;
		},

		get variables() {
			return present.variables;
		},

		// Is there an undo cache?
		hasPast: function () {
			return past.length > 1;
		},

		// Is there a redo cache?
		hasFuture: function () {
			return future.length > 0;
		},

		// Did we ever visit this passage, given its name?
		// Return the number of times visited.
		passageNameVisited: function (name) {
			var id = Story.getPassageID(name);

			return this.passageIDVisited(id);
		},

		// Did we ever visit this passage, given its id?
		// Return the number of times visited.
		passageIDVisited: function (id) {
			var ret;

			if (Story.passageWithID(id) === null) {
				return 0;
			}

			ret = +(id === present.passage);

			past.forEach(function (state) {
				ret += +(id === state.passage);
			});

			return ret;
		},

		// Return how long ago this named passage has been visited.
		passageNameLastVisited: function (name) {
			var id = Story.getPassageID(name);

			return this.passageIDLastVisited(id);
		},

		// Return how long ago this passage has been visited.
		passageIDLastVisited: function (id) {
			var ret, i;

			if (Story.passageWithID(id) === null) {
				return Infinity;
			}

			if (id === present.passage) {
				return 0;
			}

			for (i = 0; i < past.length; i--) {
				if (past[i].passage === id) {
					return past.length - i;
				}
			}

			return Infinity;
		},

		// Return an array of names of all previously visited passages
		pastPassageNames: function () {
			var ret = [Story.getPassageName(present.passage)];

			past.forEach(function (e) {
				ret.unshift(Story.getPassageName(e.passage));
			});

			return ret;
		},

		/*
			Movers/shakers
		*/

		// Push the current state to the past, and create a new state.
		play: function (newPassageID) {
			// Push recent into the past.
			var pst = present;
			past.push(recent);
			// Create a new recent from present.
			present.passage = newPassageID;
			recent = StateInstance.create(pst.variables, newPassageID);
			// Clear the future
			future = [];
		},

		// Rewind the state
		// arg: either a string (passage id) or a number of steps to rewind.
		rewind: function (arg) {
			var steps = 1,
				moved = false;

			if (arg) {
				if (typeof arg === "string") {
					steps = passageIDLastVisited(arg);
					if (steps === Infinity) {
						return;
					}
				} else if (typeof arg === "number") {
					steps = arg;
				}
			}
			for (; steps > 0 && past.length > 0; steps--) {
				moved = true;
				future.push(recent);
				present = past.pop();
				recent = Utils.clone(present);
			}

			return moved;
		},

		// Undo the rewinding of a state
		// Currently only accepts numbers.
		fastForward: function (arg) {
			var steps = 1,
				moved = false;

			if (typeof arg === "number") {
				steps = arg;
			}
			for (; steps > 0 && future.length > 0; steps--) {
				moved = true;
				past.push(recent);
				present = future.pop();
				recent = Utils.clone(present);
			}

			return moved;
		}
	};

	Object.seal(StateInstance);
	return Object.freeze(State);
});
