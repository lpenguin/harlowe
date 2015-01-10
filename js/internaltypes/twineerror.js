define(['jquery'], function($) {
	"use strict";
	/*
		TwineErrors are errors created by the TwineScript runtime. They are supplied with as much
		information as they can, in order to give the author sufficient assistance in
		understanding the error.
	*/
	
	/*
		This dictionary supplies extra explanations for the error types.
	*/
	var errorExplanations = {
		operation: "You tried to use an operation on some data, but the data's type was incorrect.",
		macrocall: "You tried to use a macro, but it wasn't written correctly.",
		datatype: "You tried to use a macro, but gave the wrong type of data to it.",
		property: "You tried to access a value in a string/array/datamap, but I couldn't find it.",
		unimplemented: "I currently don't have this particular feature. I'm sorry.",
		javascript: "This error message was reported by your browser's Javascript engine. "
					+"It usually means that an expression was badly written.",
	},
	
	TwineError = {
		
		create: function(type, message) {
			return Object.assign(Object.create(this), {
				/*
					The type of the TwineError consists of one of the following strings:
					"property" - used for accessing an incorrect property.
					"operation" - used for applying incorrect operations to certain data.
					"macrocall" - used for macro call errors, such as parameter length.
					"datatype" - used for macro parameter type errors
					"unimplemented" - when a feature isn't available
					"javascript" - should only 
				*/
				type: type,
				message: message
			});
		},
	
		/*
			This utility function converts a Javascript Error into a TwineError.
			This allows them to be render()ed by Section.
		*/
		fromError: function(error) {
			return TwineError.create("javascript", "\u2615 " + error.message);
		},
		
		/*
			Twine warnings are just errors with a special "warning" bit.
		*/
		createWarning: function(type, message) {
			return Object.assign(this.create(type, message), {
				warning: true,
			});
		},
		
		render: function(titleText) {
			var errorElement = $("<tw-error class='"
					+ (this.warning ? "warning" : "error")
					+ "' title='" + titleText + "'>" + this.message + "</tw-error>"),
				/*
					The explanation text element.
				*/
				explanationElement = $("<tw-error-explanation>")
					.text(errorExplanations[this.type])
					.hide(),
				/*
					The button to reveal the explanation consists of a rightward arrowhead
					which is rotated when the explanation is unfolded down.
				*/
				explanationButton = $("<tw-error-explanation-button tabindex=0>")
					/*
						The arrowhead must be in its own <span> so that it can be rotated.
						The CSS class "folddown-arrowhead" is used exclusively for this kind of thing.
					*/
					.html("<span class='folddown-arrowhead'>&#9658;</span>");
					
			/*
				Wire up the explanation button to reveal the error explanation.
			*/
			explanationButton.on('click', function() {
				explanationElement.toggle();
				explanationButton.children(".folddown-arrowhead").css(
					'transform',
					'rotate(' + (explanationElement.is(':visible') ? '90deg' : '0deg') + ')'
				);
			});
			
			errorElement.append(explanationButton).append(explanationElement);
			
			return errorElement;
		},
	};
	return TwineError;
});
