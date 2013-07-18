define(['story', 'utils'], function(story, utils)
{
	// Values remembered by the game.
	var stateProto = {
		// Variables
		variables: {},
		
		// Current passage ID
		passage: "",
	};
	
	// The current game's state.
	return {
	
		// The present.
		present: Object.create(stateProto),
	
		// Stack of previous states.
		past: [],
		
		// Stack of states wound back from.
		future: [],
		
		/*
			Values specific to the current passage, which
			are reset by changePassage();
		*/
		
		// Passage-specific scripts.
		scripts: {},
		
		/*
			Getters/setters
		*/
		
		// Get/set the current passage.
		getPresentPassageID: function() {
			return this.present.passage;
		},
		
		setPresentPassageID: function(val) {
			this.present.passage = val;
		},
		
		// Query a variable's present value
		getVar: function(name) {
			if (this.variables[name])
			{
				return this.variables[name];
			}
			// No value found...
			return null;
		},
		
		// Does a variable have this value?
		variableIs: function(name, val)
		{
			return this.getVar(name) === val;
		},
		
		// Did a variable ever have this value?
		// Return the number of times it did.
		// (Return value may not be that useful.)
		variableWas: function(name, val)
		{
			var ret = +(this.variableIs(name, val));
			
			this.past.forEach(function(state)
			{
				ret += +(this.variableIs.call(state, name, val));
			}
			.bind(this));
			
			return ret;
		},
		
		// Did we ever visit this passage, given its name?
		// Return the number of times visited.
		passageNameVisited: function(name)
		{
			var id = story.getPassageID(name);
			
			return this.passageIdVisited(id);
		},
		
		// Did we ever visit this passage, given its id?
		// Return the number of times visited.
		passageIdVisited: function(id)
		{
			var ret;
			
			if (story.passageWithId(id) === null)
			{
				return 0;
			}
			
			ret = +(id === this.passage);
			
			this.past.forEach(function(state)
			{
				ret += +(id === state.passage);
			});
			
			return ret;
		},
		
		// Return how long ago this named passage has been visited.
		passageNameLastVisited: function(name)
		{
			var id = story.getPassageID(name);
			
			return this.passageIdLastVisited(id);
		},

		// Return how long ago this passage has been visited.
		passageIdLastVisited: function(id)
		{
			var ret, i;
			
			if (story.passageWithId(id) === null)
			{
				return Infinity;
			}
			
			if (id === this.passage)
			{
				return 0;
			}
			
			for (i = 0; i < this.past.length; i--)
			{
				if (this.past[i].passage === id)
				{
					return past.length-i;
				}
			}
			
			return Infinity;
		},
		
		// Return an array of names of all previously visited passages
		pastPassageNames: function()
		{
			var ret = [story.getPassageName(this.passage)];
			
			this.past.forEach(function(e)
			{
				ret.unshift(story.getPassageName(e.passage));
			});
			
			return ret;
		},
		
		/*
			Movers/shakers
		*/
		
		// Push the current state to the past, and create a new state.
		pushPast: function()
		{
			this.past.push(this.present);
			this.present = Object.create(stateProto);
			this.present.variables = this.present.variables;
			this.future = [];
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
					steps = passageIdLastVisited(arg);
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
			for (; steps > 0 && this.past.length > 0; steps--)
			{
				moved = true;
				this.future.push(this.present);
				this.present = this.past.pop();
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
			for (; steps > 0 && this.future.length > 0; steps--)
			{
				moved = true;
				this.past.push(this.present);
				this.present = this.future.pop();
			}
			
			return moved;
		}
	};
});