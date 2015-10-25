define(['utils', 'internaltypes/twineerror'], ({toJSLiteral, insensitiveName}, TwineError) => {
	"use strict";

	/*
		Sadly, this list of TwineScript keywords needs to be kept in check manually.
	*/
	const keywords = ['it', 'its', 'time', 'and', 'or', 'not', 'contains', 'in', 'true', 'false', 'into', 'of', 'NaN'];

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
					+ ' parameter'
					+ (arity > 1 ? 's' : '')
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
				Check if the params collide with known TwineScript keywords.
			*/
			const keywordCollision = params.filter(e => keywords.indexOf(e) >-1);
			if (keywordCollision.length) {
				// TODO: Make this report multiple collisions at once.
				return TwineError.create('syntax', 'This lambda has a parameter named \''
						+ keywordCollision[0]
						+ '\', which is already a special syntax word.');
			}
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
				We run the JS code of this lambda, inserting the arguments by adding several "var" statements
				to the front of the code. The barenames in the JS code should match the parameters.
				TODO: Produce an error when they do not???
			*/
			return section.eval(this.params.map((name, i) => "var " + name + " = " + toJSLiteral(args[i]) + ";").join('') + this.jscode || '');
		},
	});
	return Lambda;
});
