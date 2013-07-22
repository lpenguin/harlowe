define(['story', 'utils'], function(story, utils)
{
	"use strict";
	// Prototype object for states remembered by the game.
	var stateProto = Object.seal({
		// Variables
		variables: {},
		
		// Current passage ID
		passage: "",
		
		// Make a new state
		create: function(v, p)
		{
			var ret = Object.create(stateProto);
			ret.variables = (v ? utils.clone(v) : {});
			ret.passage = p || "";
			return ret;
		}
	}),
	
	// The present, after or while the current passage is executing.
	// This is pushed into recent when going forward.
	present = stateProto.create(),

	// The game state at the point the current passage began execution.
	// This is pushed into the past when going forward,
	// pushed into the future when going backward,
	// or used to serialise the game state.
	// (Revisiting the passage should thus cause it to behave identically to
	// the original visit.)
	recent = stateProto.create(),
	
	// Stack of previous states.
	past = [],
	
	// Stack of states wound back from.
	future = [],
	
	/*
		Values specific to the current passage, which
		are reset by changePassage();
	*/
	
	// Passage-specific scripts.
	scripts = {},
	
	// Passage-specific hook macros.
	hookMacros = {},
		
	/*
		The current game's state.
	*/
	state = Object.freeze({
		/*
			Getters/setters
		*/
		
		// Get the current passage.
		get passage() {
			return present.passage;
		},
		
		get variables() {
			return present.variables;
		},
		
		// Is there an undo cache?
		hasPast: function() {
			return past.length > 1;
		},
		
		// Is there a redo cache?
		hasFuture: function() {
			return future.length > 0;
		},
		
		// Query a variable's present value
		getVar: function(name) {
			if (present.variables[name])
			{
				return present.variables[name];
			}
			// No value found...
			return null;
		},
		
		setVar: function(name, value) {
			present.variables[name] = value;
		},
		
		// Does a variable have this value?
		varIs: function(name, val)
		{
			return this.getVar(name) === val;
		},
		
		// Did we ever visit this passage, given its name?
		// Return the number of times visited.
		passageNameVisited: function(name)
		{
			var id = story.getPassageID(name);
			
			return this.passageIDVisited(id);
		},
		
		// Did we ever visit this passage, given its id?
		// Return the number of times visited.
		passageIDVisited: function(id)
		{
			var ret;
			
			if (story.passageWithID(id) === null)
			{
				return 0;
			}

			ret = +(id === present.passage);
			
			past.forEach(function(state)
			{
				ret += +(id === state.passage);
			});
			
			return ret;
		},
		
		// Return how long ago this named passage has been visited.
		passageNameLastVisited: function(name)
		{
			var id = story.getPassageID(name);
			
			return this.passageIDLastVisited(id);
		},

		// Return how long ago this passage has been visited.
		passageIDLastVisited: function(id)
		{
			var ret, i;
			
			if (story.passageWithID(id) === null)
			{
				return Infinity;
			}
			
			if (id === present.passage)
			{
				return 0;
			}
			
			for (i = 0; i < past.length; i--)
			{
				if (past[i].passage === id)
				{
					return past.length-i;
				}
			}
			
			return Infinity;
		},
		
		// Return an array of names of all previously visited passages
		pastPassageNames: function()
		{
			var ret = [story.getPassageName(present.passage)];
			
			past.forEach(function(e)
			{
				ret.unshift(story.getPassageName(e.passage));
			});
			
			return ret;
		},
		
		// Add a hook function, one whose 'this' value is currently unknown.
		// callback: function to add.
		addScript: function(name, callback, args)
		{
			scripts[name] = [callback, args];
		},
		
		// Run a hook script in the context of a given object (usually an element).
		callScript: function(name, element)
		{
			if (scripts[name] && typeof scripts[name][0] === "function")
			{
				return (scripts[name][0]).apply(element, scripts[name][1]);
			}
		},
		
		/*
			Movers/shakers
		*/
		
		// Push the current state to the past, and create a new state.
		play: function(newPassageID)
		{
			// Push recent into the past.
			var pst = present;
			past.push(recent);
			// Create a new recent from present.
			present.passage = newPassageID;
			recent = stateProto.create(pst.variables, newPassageID);
			// Clear the future
			future = [];
			// Clear all scripts
			scripts = {};
		},
		
		// Rewind the state
		// arg: either a string (passage id) or a number of steps to rewind.
		rewind: function(arg)
		{
			var steps = 1,
				moved = false;
			
			if (arg)
			{
				if (typeof arg === "string")
				{
					steps = passageIDLastVisited(arg);
					if (steps === Infinity)
					{
						return;
					}
				}
				else if (typeof arg === "number")
				{
					steps = arg;
				}
			}
			for (; steps > 0 && past.length > 0; steps--)
			{
				moved = true;
				future.push(recent);
				present = past.pop();
				recent = utils.clone(present);
			}
			
			return moved;
		},
		
		// Undo the rewinding of a state
		// Currently only accepts numbers.
		fastForward: function(arg)
		{
			var steps = 1,
				moved = false;
			
			if (typeof arg === "number")
			{
				steps = arg;
			}
			for (; steps > 0 && future.length > 0; steps--)
			{
				moved = true;
				past.push(recent);
				present = future.pop();
				recent = utils.clone(present);
			}
			
			return moved;
		}
	});
	return state;
});