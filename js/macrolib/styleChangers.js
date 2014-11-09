define(['macros', 'utils', 'datatypes/colour'], function(Macros, Utils, Colour) {
	"use strict";

	/*
		Built-in hook style changer macros.
		These produce ChangerCommands that apply CSS styling to their attached hooks.
		
		This module modifies the Macros module only, and exports nothing.
	*/
	var
		either = Macros.TypeSignature.either;
	
	Macros.addChanger
	
		// (hook:)
		// Allows the author to give a hook a computed tag name.
		(["hook"],
			function hook(_, name) {
				return Macros.ChangerCommand("hook", name);	
			},
			function(d, name) {
				d.attr = Object.assign(d.attr || {}, {
					name: name
				});
			},
			[String]
		)

		// (transition:)
		// Apply a CSS transition to a hook as it is inserted.
		(["transition", "t8n"],
			function transition(_, name, time) {
				return Macros.ChangerCommand("transition", name, time);
			},
			function(d, name, time) {
				d.transition     = name;
				d.transitionTime = time;
				return d;
			},
			[String]
		)
		
		// (font:)
		// A shortcut for applying a font to a span of text.
		("font",
			function font(_, family) {
				return Macros.ChangerCommand("font", family);
			},
			function(d, family) {
				d.code = "<span style='font-family:" + family + "'>" + d.code + "</span>";
				return d;
			},
			[String]
		)
		
		/*
			(text-colour:)
			A shortcut for applying a colour to a span of text.
			The (colour:) alias is one I feel a smidge less comfortable with. It
			should easily also refer to a value macro that coerces string to colour...
			But, I suppose this is the more well-trod use-case for this keyword.
		*/
		(["text-colour", "text-color", "color", "colour"],
			function textcolour(_, CSScolour) {
				/*
					Convert TwineScript CSS colours to bad old hexadecimal.
					This is important as it enables the ChangerCommand to be serialised
					as a string more easily.
				*/
				if (CSScolour && CSScolour.colour) {
					CSScolour = CSScolour.toHexString(CSScolour);
				}
				return Macros.ChangerCommand("text-colour", CSScolour);
			},
			function (d, CSScolour) {
				d.code = "<span style='color:" + CSScolour + "'>" + d.code + "</span>";
				return d;
			},
			[either(String,Colour)]
		)
		/*
			(background:)
			This sets the changer's background-color or background-image,
			depending on what is supplied.
		*/
		("background",
			function backgroundcolour(_, value) {
				//Convert TwineScript CSS colours to bad old hexadecimal.
				if (value && value.colour) {
					value = value.toHexString(value);
				}
				return Macros.ChangerCommand("background", value);
			},
			function (d, value) {
				var property;
				/*
					Different kinds of values can be supplied to this macro
				*/
				if (Colour.isHexString(value)) {
					property = "background-color";
				}
				else {
					/*
						When Harlowe can handle base64 image passages,
						this will invariably have to be re-worked.
					*/
					/*
						background-size:cover allows the image to fully cover the area
						without tiling, which I believe is slightly more desired.
					*/
					property = "background-size:cover; background-image";
					value = "url(" + value + ")";
				}
				d.code = "<span style='" + property + ":" + value + "'>" + d.code + "</span>";
				return d;
			},
			[either(String,Colour)]
		)
		
		/*
			(text-style:)
		*/
		("text-style",
			function textstyle(_, styleName) {
				return Macros.ChangerCommand("text-style", styleName);
			},
			(function() {
				/*
					This is a closure in which to cache the style-tagname mappings.
					
					These map style names, as input by the author as this macro's first argument,
					to HTML element tag names to wrap them with.
				*/
				var styleTagNames = Object.assign(Object.create(null), {
						bold:         "b",
						italic:       "i",
						underline:    "u",
						strike:       "s",
						superscript:  "sup",
						subscript:    "sub",
						blink:        "blink",
						mark:         "mark",
						delete:       "del",
					},
					/*
						These are the Twine extra styles.
					*/
					["outline", "shadow", "emboss", "condense", "expand", "blur", "blurrier",
						"smear", "mirror", "upside-down", "fade-in-out", "rumble", "shudder"]
						.reduce(function(obj, e) {
							obj[Utils.insensitiveName(e)] = "tw-" + e;
							return obj;
						}, {})
					);
				
				return function text_style(d, styleName) {
					var
						/*
							A pair of HTML strings to wrap the hook in. 
						*/
						wrapperHTML = ['', ''];
					
					/*
						The name should be insensitive to normalise both capitalisation,
						and hyphenation of names like "upside-down".
					*/
					styleName = Utils.insensitiveName(styleName);
					
					if (styleName in styleTagNames) {
						/*
							This is a bit of a hack to split the return value of
							wrapHTMLTag into an array of just the wrapper components.
						*/
						wrapperHTML = Utils.wrapHTMLTag("_", styleTagNames[styleName]).split("_");
					}
					d.code = wrapperHTML.join(d.code);
					return d;
				};
			}()),
			[String]
		);
});
