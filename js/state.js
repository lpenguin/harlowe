define(['story', 'utils', 'lzstring'], function(Story, Utils, LZString) {
	"use strict";
	/*
		State
		Singleton controlling the running game state.
		
		Internal object type: Moment
	*/

	// Prototype object for states remembered by the game.
	var Moment = {
		// Current passage ID
		passage: "",
		
		// Variables
		variables: null,

		/**
			Make a new Moment that comes temporally after this.
			This is usually a fresh Moment, but the State deserialiser
			must re-create prior sessions' Moments.
			Thus, pre-set variables may be supplied to this method.
			
			@method create
			@param {String} p The ID of the passage that the player is at in this moment.
			@param {Object} [v]	Variables to include in this moment.
			@returns {Moment} created object
		*/
		create: function (p, v) {
			var ret = Object.create(Moment);
			// Variables are stored as deltas of the previous state's variables.
			// This is implemented using JS's prototype chain :o
			ret.passage = p || "";
			// For the first moment, this becomes a call to Object.create(null),
			// keeping the prototype chain clean.
			ret.variables = Utils.create(this.variables, v, true);
			return ret;
		}
	}
	
	// Stack of previous states.
	// This includes both the past (moments the player has created) as well as the future (moments
	// the player has undone).
	// Count begins at 0 (the game start).
	var timeline = [ ];
	
	// Index to the game state just when the current passage was entered.
	// This represents where the player is within the timeline.
	// Everything beyond this index is the future. Everything before and including is the past.
	// It usually equals timeline.length-1, except when the player undos.
	var recent = -1;
	
	// The present - the resultant game state after the current passage executed.
	// This is a 'potential moment' - a moment that could become the newest to enter the timeline.
	// This is pushed onto the timeline (becoming "recent") when going forward,
	// and discarded when going backward.
	// Its passage ID should equal that of recent.
	var present = Moment.create();

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
		get pastLength() {
			return recent;
		},

		// Is there a redo cache?
		get futureLength() {
			return (timeline.length - 1) - recent;
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
			var i, ret = 0;

			if (!Story.passageWithID(id)) {
				return 0;
			}
			for (i = 0; i <= recent; i++) {
				ret += +(id === timeline[i].passage);
			};

			return ret;
		},

		// Return how long ago this named passage has been visited.
		passageNameLastVisited: function (name) {
			var id = Story.getPassageID(name);

			return this.passageIDLastVisited(id);
		},

		// Return how long ago this passage has been visited.
		passageIDLastVisited: function (id) {
			var i;

			if (!Story.passageWithID(id)) {
				return Infinity;
			}

			if (id === present.passage) {
				return 0;
			}

			for (i = recent; i > 0; i--) {
				if (timeline[i].passage === id) {
					return (recent-i) + 1;
				}
			}

			return Infinity;
		},
		
		// Returns the ID of the previous passage visited.
		previousPassage: function () {
			return timeline[recent].passage;
		},

		// Return an array of names of all previously visited passages
		pastPassageNames: function () {
			var i, ret = [Story.getPassageName(present.passage)];

			for (i = recent; i > 0; i--) {
				ret.unshift(Story.getPassageName(timeline[i].passage));
			};

			return ret;
		},

		/*
			Movers/shakers
		*/
		
		// Create a new present after altering the state
		newPresent: function(newPassageID) {
			present = (timeline[recent] || Moment).create(newPassageID);
		},

		// Push the present state to the timeline, and create a new state.
		play: function (newPassageID) {
			if (!present) {
				Utils.impossible("State.play","present is undefined!");
			}
			// Assign the passage ID
			present.passage = newPassageID;
			// Clear the future, and add the present to the timeline
			timeline = timeline.slice(0,recent+1).concat(present);
			recent += 1;
			
			// Create a new present
			this.newPresent(newPassageID);
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
			for (; steps > 0 && recent >= 0; steps--) {
				moved = true;
				recent -= 1;
			}
			if (moved) {
				this.newPresent(timeline[recent].passage);
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
			for (; steps > 0 && timeline.length > 0; steps--) {
				moved = true;
				recent += 1;
			}
			if (moved) {
				this.newPresent(timeline[recent].passage);
			}
			return moved;
		},
		
		/*
			A smaller alternative to an LZString compressed JSON.stringify()
			-First line: comma-separated variable names array
			-Then, for each Moment:
				- passage name + newline,
				- then for each variable, index into variable names array : variable data JSON, then newline.
				- then, newline.
			-Then, present passage.
			Note: this currently doesn't record the future (the redo cache).
		*/
		save: function() {
			var i, ret = "", error = 0,
				variableKeys = [],
				futuremostVariables = timeline[timeline.length-1].variables;
			// Assemble variableKeys
			// Intentionally unguarded for-in, thanks to Object.create(null)
			for (i in futuremostVariables) {
				variableKeys.push(i);
			};
			// Intentional array->string coercion
			// ASSUMPTION: variable names cannot contain commas or newlines.
			ret += variableKeys + '\n';
			// Only record the past
			timeline.slice(0,recent+1).forEach(function(t) {
				var key, keys = Object.keys(t.variables), i = 0;
				// Add the passage name
				ret += t.passage + '\n';
				while(i++ < keys.length) {
					// Only get the own variables for this moment.
					key = keys[i];
					ret += variableKeys.indexOf(key) + ":";
					try {
						ret += JSON.stringify(t.variables[key]) + '\n';
					} catch(e) {
						error += 1;
						ret += 'null\n';
					}
				};
				ret += '\n';
			});
			if (error) {
				Utils.impossible("State.save", "failed to serialise " + error + " variable" + (error>1 ? "s" : "") + "!\n"+e);
			}
			ret += "\n" + recent + "\n" + present.passage;
			// Compress the string
			return LZString.compressToBase64(ret);
		},
		
		// Deserialiser
		load: function(string) {
			var // RegExp matches,
				momentMatch, variableMatch, tempMatch,
				// Temps
				variableTemp, lastPushedObject, variableKeys,
				newTimeline = [],
				newRecent = -1,
				newPresentPassage = "",
				variableRE,
				momentRE = /\n(.+)\n(.(?:.|\n(?!\n))*)?/g;
			
			// Decompress the string
			if (!(string = LZString.decompressFromBase64(string)) {
				//Failed to load - exit in disgrace.
				// Since this could be human input error, this isn't really "impossible"
				// TODO: what to do instead?
				Utils.impossible("State.load", "couldn't decompress!");
				return false;
			}
			// Now read it
			try {
				variableKeys = string.match(/^.*/)[0].split(',');
				// Read the value of recent and presentPassage
				tempMatch = string.match(/\n\n(\d+)\n(.*)$/);
				newRecent = +tempMatch[1];
				newPresentPassage = tempMatch[2];
				// Read each of the Moments
				while (momentMatch = momentRE.exec(string)) {
					variableTemp = {};
					// A fresh regexp for each moment
					variableRE = /(\d+):(.*)/g;
					// Read the variables
					while (variableMatch = variableRE.exec(momentMatch[2])) {
						// Restore the variable name from the key
						variableTemp[variableKeys[variableMatch[1]]] = JSON.parse(variableMatch[2]);
					}
					// Push into newTimeline, restoring the prototype chain
					newTimeline.push(lastPushedObject =
						(lastPushedObject || Moment).create(momentMatch[1], variableTemp));
				}
			} catch(e) {
				// Same as above regarding this not being "impossible"
				Utils.impossible("State.load", "couldn't parse!");
				return false;
			}
			recent = newRecent;
			timeline = newTimeline;
			this.newPresent(newPresentPassage);
			Utils.log("Loaded a game state (" + timeline.length-1 + " moments)"); 
			return true;
		},
	};
	Utils.log("State module ready!");
	Object.seal(Moment);
	return Object.freeze(State);
});
