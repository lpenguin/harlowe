define([], function(){
	/*
		Colours are first-class objects in TwineScript.
		You can't do much with them, though - just add them.
	*/
	"use strict";
	var Colour = Object.freeze({
		colour: true,
		TwineScript_ObjectName: "a colour",
		toString: function() {
			return "<tw-colour style='background-color:rgb("
				+ [this.r, this.g, this.b] + ");'></span>";
		},
		toJSON: function() {
			return Object.assign({ colour: true }, this);
		},
		/*
			This static method converts a string comprising a CSS hex colour
			into an {r,g,b} object.
			This, of course, doesn't attempt to trim the string, or
			perform "flex hex" parsing to over-long strings.
			(http://scrappy-do.blogspot.com/2004/08/little-rant-about-microsoft-internet.html)
		*/
		hexToRGB: function(str) {
			// Just in case...
			if (typeof str !== "string") {
				return str;
			}
			// Trim off the "#", if any.
			str = str.replace("#", '');
			/*
				If a 3-char hex colour was passed, convert it to a 6-char colour.
			*/
			str = str.replace(/^([\da-fA-F])([\da-fA-F])([\da-fA-F])$/, "$1$1$2$2$3$3");
			
			return {
				r: parseInt(str.slice(0,2), 16),
				g: parseInt(str.slice(2,4), 16),
				b: parseInt(str.slice(4,6), 16),
			};
		},
		/*
			And this performs the reverse of the above - returning a 6-char colour
			when given an {r,g,b} object. (No, this doesn't create a 3-char colour
			if one was detected. Sorry.)
		*/
		RGBToHex: function(rgbObj) {
			var singleDigit = /^([\da-fA-F])$/;
			
			// Just in case...
			if (typeof rgbObj === "string") {
				return rgbObj;
			}
			return "#"
				/*
					Number.toString() won't have a leading 0 unless
					we manually insert it.
				*/
				+ rgbObj.r.toString(16).replace(singleDigit, "0$1")
				+ rgbObj.g.toString(16).replace(singleDigit, "0$1")
				+ rgbObj.b.toString(16).replace(singleDigit, "0$1");
		},
		/*
			This constructor accepts an object containing r, g and b numeric properties,
			or a string comprising a CSS hex colour.
		*/
		create: function(rgbObj) {
			if (typeof rgbObj === "string") {
				return this.create(this.hexToRGB(rgbObj));
			}
			return Object.assign(Object.create(this), rgbObj);
		},
	});
	return Colour;
});
