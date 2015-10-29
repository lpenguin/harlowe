define(['utils', 'internaltypes/varscope', 'internaltypes/twineerror'], ({toJSLiteral, insensitiveName, plural}, VarScope, TwineError) => {
	"use strict";
	/*
		Lambdas are user-created TwineScript functions. Their only purpose is to be passed to functional macros
		like (converted:), (filtered:) and (combined:), which serve as TwineScript's map/filter/reduce equivalents.
	*/
	const Lambda = Object.freeze({
		lambda: true,
		TwineScript_TypeName:   "a lambda",
		TwineScript_ObjectName: "a lambda",

		TwineScript_Print() {
			// TODO: Make this string more detailed.
			return "[A lambda]";
		},

		TwineScript_is(other) {
			/*
				Lambdas are equal if their body is equivalent given parameter renaming
				(a.k.a alpha equivalence)
				TODO: Implement the above.
			*/
			return other === this;
		},

		/*
			This checks if the lambda does not have the given arity, and, if so, returns a TwineError to the effect.
			This localises all type-checking of that effect.
		*/
		checkArity(arity) {
			if (this.params.length !== arity) {
				return TwineError.create('macrocall', 'This lambda should have '
					+ arity
					+ plural(arity, ' parameter')
					+ ', not '
					+ this.params.length
					+ '.');
			}
		},

		/*
			Lambdas consist of a parameters list (an array of names) and compiled JS code comprising its body.
		*/
		create(params, jscode) {
			/*
				For the following comparisons, the params' insensitive names are used.
			*/
			const insensitiveParams = params.map(insensitiveName);
			/*
				Check if all of the params are unique or not.
			*/
			const nonunique = params.filter((e,i)=>insensitiveParams.indexOf(insensitiveName(e)) !== i);
			if (nonunique.length) {
				return TwineError.create('syntax', 'This lambda has two parameters named \'' + nonunique[0] + '\'.',
					'Lambdas should have all-unique parameter names.');
			}
			/*
				All checks have now succeeded.
			*/
			return Object.assign(Object.create(this), { params, jscode });
		},

		/*
			Macros call this method to apply the lambda to a series of provided values.
			This needs to have the macro's section passed in so that its JS code can be eval()'d in
			the correct scope.
		*/
		apply(section, ...args) {
			/*
				We run the JS code of this lambda, inserting the arguments by adding them to a "tempVariables"
				object. The tempVariable references in the code are compiled to VarRefs for tempVariables.
			*/
			section.stack.unshift(Object.assign(Object.create(null), {tempVariables: Object.create(VarScope)}));
			return section.eval(this.params.map((name, i) => "section.stack[0].tempVariables['" + name + "'] = " + toJSLiteral(args[i])).join(";") + ";" + this.jscode || '');
		},
	});
	return Lambda;
});
