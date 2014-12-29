define(['utils', 'macros', 'utils/operationutils'], function(Utils, Macros, OperationUtils) {
	"use strict";
	/*
		A ChangerCommand is a command that is used to alter the way a particular
		Section renders the value. It does this by mutating a passed-in ChangeDescriptor
		object in some way.
		
		ChangerCommands are first-class values so that they can be saved and combined
		by the author to create "custom styles" for sections of story text.
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
		
		/*
			ChangerCommands are created and returned changer macro calls.
			The arguments passed to them are essentially direct representations
			of the macro call itself.
			For instance, (font: "Skia") would result in a call of
				ChangerCommand.create("font", ["Skia"])
			
			@param {String} macroName
			@param {Array} params
			@param {ChangerCommand} next
		*/
		create: function(macroName, params, next) {
			Utils.assert(params === undefined || Array.isArray(params));
			
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
		
		"TwineScript_is": function(other) {
			if (ChangerCommand.isPrototypeOf(other)) {
				return this.macroName === other.macroName &&
					OperationUtils.is(this.params, other.params) &&
					OperationUtils.is(this.next, other.next);
			}
		},
		
		TwineScript_Clone: function() {
			return this.create(this.macroName, this.params, this.next);
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
