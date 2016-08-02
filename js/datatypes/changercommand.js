define(['utils', 'utils/operationutils'], ({impossible}, {is}) => {
	"use strict";
	/*
		A ChangerCommand is a command that is used to alter the way a particular
		Section renders the value. It does this by mutating a passed-in ChangeDescriptor
		object in some way.
		
		ChangerCommands are first-class values so that they can be saved and combined
		by the author to create "custom styles" for sections of story text.
		
		Other commands are generated by the macros in macrolib/commands.
	*/
	const
		// Private collection of command definitions, populated by register()
		commandRegistry = {};

	const ChangerCommand = {
		
		changer: true,
		
		TwineScript_TypeName:
			"a changer command",
		
		TwineScript_Print() {
			return "`[A '" + this.macroName + "' command]`";
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
		create(macroName, params = [], next = null) {
			if(!Array.isArray(params)) {
				impossible('ChangerCommand.create', 'params was not an array');
			}
			
			return Object.assign(Object.create(this), {
				macroName,
				params,
				/*
					The next property links this changer to one it has been composed
					with. In this way, composed ChangerCommands are linked lists.
				*/
				next,
				TwineScript_ObjectName:   "a ("  + macroName + ":) command",
			});
		},
		
		/*
			Changer composition is performed using the + operator.
			This is the basis for advanced use of changer macros -
			(transition:) + (background:), etc., provide sophisticated
			styling.
		*/
		"TwineScript_+"(other) {
			/*
				Make a copy of this changer to return.
			*/
			const clone = this.TwineScript_Clone();
			/*
				Attach the other changer to the "tail" (the end of the
				"next" chain) of this changer.
			*/
			let tail = clone;
			while (tail.next) {
				tail = tail.next;
			}
			tail.next = other;
			return clone;
		},
		
		"TwineScript_is"(other) {
			if (ChangerCommand.isPrototypeOf(other)) {
				return this.macroName === other.macroName &&
					is(this.params, other.params) &&
					is(this.next, other.next);
			}
		},
		
		TwineScript_Clone() {
			return this.create(this.macroName, this.params, this.next);
		},
		
		/*
			Only Section calls this, at the point where a
			ChangerCommand is ready to be run on a descriptor.
		*/
		run(desc) {
			/*
				We need to spread the params array.
			*/
			commandRegistry[this.macroName](desc, ...this.params);
			if (this.next) {
				this.next.run(desc);
			}
		},

		/*
			Changer Command functions added via Macros.addChanger() will register their functions
			here, so that ChangerCommand.run() can access them.
		*/
		register(name, fn) {
			commandRegistry[name] = fn;
		},

	};
	return Object.freeze(ChangerCommand);
});
