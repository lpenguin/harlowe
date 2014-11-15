define(['macros'], function(Macros) {
	"use strict";
	/*
		A ChangerCommand is an author-facing function that is used to mutate a ChangeDescriptor
		 object, that itself is used to alter a Section's rendering.
		
		This decorator function accepts a function (which defines the ChangerCommand's 
		internal implementation), the name of the macro that created it, and some
		author-supplied configuration parameters, and creates a partial 
		function augmented with the necessary TwineScript related methods.
		
		For instance, for (transition: "dissolve"), the name would be 
		"transition" and params would be ["dissolve"].
		
		Since it basically transforms an existing function without modifying its prototype,
		it isn't really a "class", and thus isn't a prototype object with a .create() method.
	*/
	var ChangerCommand = {
		
		changer: true,
		
		get TwineScript_ObjectName() {
			return "a ("  + this.macroName + ":) command";
		},
		
		TwineScript_TypeName:
			"a changer command",
		
		TwineScript_Print: function() {
			return "[A '" + this.macroName + "' command]";
		},
		
		create: function(macroName, params, next) {
			return Object.assign(Object.create(this), {
				macroName:                macroName,
				params:                   params,
				/*
					The next property links this changer to one it has been composed
					with. In this way, composed ChangerCommands are linked lists.
				*/
				next:                     next || null,
			});
		},
		
		/*
			Changer composition is performed using the + operator.
			This is the basis for advanced use of changer macros - 
			(transition:) + (background:), etc., provide sophisticated
			styling.
		*/
		"TwineScript_+": function(other) {
			var ret = this.TwineScript_Clone();
			while (ret.next) {
				ret = ret.next;
			}
			ret.next = other;
			return ret;
		},
		
		TwineScript_Clone: function() {
			return ChangerCommand.create(this.macroName, this.params, this.next);
		},
		
		/*
			It is here where the ChangerCommand and its registered macro function
			are finally reunited. Only Section calls this, at the point where a
			ChangerCommand is ready to be run on a descriptor.
			
			TODO: This should probably be rewritten in a more functional fashion.
		*/
		run: function(desc) {
			/*
				We need to spread the params array.
			*/
			Macros.getChangerFn(this.macroName).apply(0, [desc].concat(this.params));
			if (this.next) {
				this.next.run(desc);
			}
		},
	};
	return Object.freeze(ChangerCommand);
});
