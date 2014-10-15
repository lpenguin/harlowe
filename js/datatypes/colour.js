define(['utils'], function(Utils){
	/*
		Colours are first-class objects in TwineScript.
		You can't do much with them, though - just add them.
	*/
	"use strict";
	var Colour,
		/*
			These RegExps check for HTML #fff and #ffffff format colours.
		*/
		singleDigit   = /^([\da-fA-F])$/,
		tripleDigit   = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		sextupleDigit = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])$/;

	/*
		This private function converts a string comprising a CSS hex colour
		into an {r,g,b} object.
		This, of course, doesn't attempt to trim the string, or
		perform "flex hex" parsing to over-long strings.
		(http://scrappy-do.blogspot.com/2004/08/little-rant-about-microsoft-internet.html)
	*/
	function hexToRGB(str) {
		// Assume that any non-strings passed in here are already valid {r,g,b}s.
		if (typeof str !== "string") {
			return str;
		}
		// Trim off the "#", if any.
		str = str.replace("#", '');
		/*
			If a 3-char hex colour was passed, convert it to a 6-char colour.
		*/
		str = str.replace(tripleDigit, "$1$1$2$2$3$3");
		
		return {
			r: parseInt(str.slice(0,2), 16),
			g: parseInt(str.slice(2,4), 16),
			b: parseInt(str.slice(4,6), 16),
		};
	}

	Colour = Object.freeze({
		colour: true,
		TwineScript_ObjectName: "a colour",
		toString: function() {
			return "<tw-colour style='background-color:rgb("
				+ [this.r, this.g, this.b].join(',') + ");'></span>";
		},
		toJSON: function() {
			return Object.assign({ colour: true }, this);
		},
		/*
			This converts the colour into a 6-char HTML hex string.
			(No, this doesn't create a 3-char colour if one was possible. Sorry.)
		*/
		toHexString: function() {
			Utils.assert(this !== Colour);
			return "#"
				/*
					Number.toString() won't have a leading 0 unless
					we manually insert it.
				*/
				+ (this.r).toString(16).replace(singleDigit, "0$1")
				+ (this.g).toString(16).replace(singleDigit, "0$1")
				+ (this.b).toString(16).replace(singleDigit, "0$1");
		},
		/*
			This constructor accepts an object containing r, g and b numeric properties,
			or a string comprising a CSS hex colour.
		*/
		create: function(rgbObj) {
			if (typeof rgbObj === "string") {
				return this.create(hexToRGB(rgbObj));
			}
			return Object.assign(Object.create(this), rgbObj);
		},
		/*
			This static method determines if a given string matches a HTML hex colour format.
		*/
		isHexString: function(str) {
			return (typeof str === "string" && str[0] === "#"
				&& (str.slice(1).match(tripleDigit) || str.slice(1).match(sextupleDigit)));
		},
	});
	return Colour;
});
