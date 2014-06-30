define(['twineparser'], function(twineParser) {
	"use strict";
	/**
		The Renderer takes the syntax tree from TwineMarked and returns a HTML string.
		
		@class Renderer
		@static
	*/
	
	/**
		Unescape HTML entities.
		For speed, convert common entities quickly, and convert others with jQuery.

		@method unescape
		@for Utils
		@param {String} text Text to convert
		@return {String} converted text
	*/
	function unescape(text) {
		var ret;
		if (text.length <= 1)
			return text;

		switch (text) {
			case "&lt;":
				return '<';
			case "&gt;":
				return '>';
			case "&amp;":
				return '&';
			case "&quot;":
				return '"';
			case "&#39;":
				return "'";
			case "&nbsp;":
				return String.fromCharCode(160);
			case "&zwnj;":
				return String.fromCharCode(8204);
			default:
				ret = document.createElement('p');
				ret.innerHTML = text;
				return ret.textContent;
		}
	}

	/**
		HTML-escape a string.
		
		@method escape
		@for Utils
		@param {String} text Text to escape
		@return {String} converted text
	*/
	function escape(text) {
		return text.replace(/&/g, '&amp;')
			.replace(/>/g, '&gt;'  ).replace(/</g, '&lt;' )
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	/**
		Takes a string containing a character or HTML entity, and wraps it into a
		<tw-char> tag, converting the entity if it is one.

		@method charToSpan
		@for Utils
		@param {String} character
		@return {String} Resultant HTML
	*/
	function charToSpan(c) {
		// Use single-quotes if the char is a double-quote.
		var quot = (c === "&#39;" ? '"' : "'"),
			value = unescape(c);
		switch(value) {
			case ' ': {
				value = "space";
				break;
			}
			case '\t': {
				value = "tab";
				break;
			}
		}
		return "<tw-char value=" +
			quot + value + quot + ">" +
			c + "</tw-char>";
	}

	/**
		Converts an entire string into individual characters, each enclosed
		by a <tw-char>.

		@method charSpanify
		@for Utils
		@param {String} text Source string
		@return {String} Resultant HTML
	*/
	function charSpanify(text) {
		if (typeof text !== "string") {
			throw new Error("charSpanify received a non-string:" + text);
		}
		return text.replace(/&[#\w]+;|./g, charToSpan);
	}
	
	/*
		This makes a basic enclosing HTML tag with no attributes, given the tag name,
		and renders the contained text.
	*/
	function renderTag(token, tagName) {
		return '<' + tagName + '>' + Renderer.render(token.children) + '</' + tagName + '>';
	}
	
	/*
		This makes a standard passage link.
	*/
	function renderLink(text, passage) {
		return '<tw-link class="link" passage-expr="' + escape(passage) + '">' + (text || passage) + '</tw-link>';
	}

	/*
		Text constant used by align().
		The string "text-align: " is selected by the debugmode CSS, so the one space
		must be present.
	*/
	var center = "text-align: center; max-width:50%; ";
	
	/*
		The public Renderer object.
	*/
	var Renderer = {
		
		/**
			Renderer accepts the same story options that Harlowe does.
			Currently it only makes use of { debug }.
			
			@property options
			@type Object
		*/
		options: {},
		
		/**
			Export these utility functions, so that Utils need not redefine them.
			They're pretty uniquely tied to the Twine code parsing field.
			
			@property {Object} Utils
		*/
		Utils: {
			unescape: unescape,
			escape: escape,
			charSpanify: charSpanify,
			charToSpan: charToSpan
		},
		
		/**
			The recursive rendering method.
			
			@method render
			@static
			@param {Array} tokens The TwineMarked tokens array.
			@return {String} The rendered HTML string.
		*/
		render: function render(tokens) {
			var token,
				// Cache the tokens array length
				len,
				// Hoisted var, used only by the numbered/bulleted case
				tagName,
				// Hoisted vars, used only by the align case
				style, body, align, j,
				
				// This is the for-i loop variable. Speed concerns lead me to use
				// a plain for-i loop for this renderer.
				i = 0,
				// The output string.
				out = '';
			
			if (!tokens) {
				return out;
			}
			len = tokens.length;
			for(; i < len; i += 1) {
				token = tokens[i];
				switch(token.type) {
					case "numbered":
					case "bulleted": {
						// Run through the tokens, consuming all consecutive list items
						tagName = (token.type === "numbered" ? "ol" : "ul");
						out += "<" + tagName + ">";
						
						while(i < len && tokens[i] && tokens[i].type === token.type) {
							out += renderTag(tokens[i], "li");
							i += 1;
							// If a <br> follows a listitem, ignore it.
							if (tokens[i] && tokens[i].type === "br") {
								i+=1;
							}
						}
						out += "</" + tagName + ">";
						break;
					}
					case "align": {
						while(token && token.type === "align") {
							style = '';
							body = '';
							align = token.align;
							j = (i += 1);
							
							/*
								Base case.
							*/
							if (align === "left") {
								break;
							}
							/*
								Crankforward until the end tag is found.
							*/
							while(i < len && tokens[i] && tokens[i].type !== "align") {
								i += 1;
							}
							
							body += render(tokens.slice(j, i));
							
							switch(align) {
								case "center":
									style += center + "margin:auto;";
									break;
								case "justify":
								case "right":
									style += "text-align: " + align + ";";
									break;
								default:
									if (+align) {
										style += center + "margin-left: " + align + "%;";
									}
							}
							
							out += '<tw-align ' + (style ? ('style="' + style + '"') : '')
								+ (Renderer.options.debug ? ' title="' + token.text + '"' : "")
								+ '>' + body + '</tw-align>\n';
							token = tokens[i];
						}
						break;
					}
					case "heading": {
						out += renderTag(token, 'h' + token.depth);
						break;
					}
					case "br":
					case "hr": {
						out += '<' + token.type + '>';
						break;
					}
					case "code": {
						out += '<pre>' + escape(token.code) + '</pre>';
						break;
					}
					case "paragraph": {
						out += renderTag(token, "p");
						break;
					}
					case "comment": {
						break;
					}
					case "url": {
						out += '<a class="link" href="' + escape(token.text) + '">' + charSpanify(token.text) + '</a>';
						break;
					}
					case "tag": {
						out += token.text;
						break;
					}
					case "del":
					case "strong":
					case "em": {
						out += renderTag(token, token.type);
						break;
					}
					case "bold": {
						out += renderTag(token, "b");
						break;
					}
					case "italic": {
						out += renderTag(token, "i");
						break;
					}
					case "twineLink": {
						out += renderLink(render(token.children) || undefined, token.passage);
						break;
					}
					case "hook": {
						out += '<tw-hook name="' + token.name + '"'
							// Debug mode: show the hook destination as a title.
							+ (Renderer.options.debug ? ' title="Hook: ?' + token.name + '"' : '')
							+ ' code="' + escape(token.innerText) + '">'
							// Insert a non-breaking space so that the hook can be selected
							// and used in a Scope.
							+'&#8203;'
							+'</tw-hook>';
						break;
					}
					/*
						Expressions
					*/
					case "hookRef":
					case "variable": 
					case "macro": {
						out += '<tw-expression type="' + token.type + '" name="' + token.name + '"'
							// Debug mode: show the macro name as a title.
							+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
							+ ' js="' + escape(twineParser(token)) + '">'
							+ '</tw-expression>';
						break;
					}
					/*
					case "is":
					case "to":
					case "or":
					case "and":
					case "not":
					case "isNot": {
						out += '<tw-operator text="' + token.text + '" name="' + token.type + '"></tw-operator>';
						break;
					}
					case "number":
					case "boolean":
					case "string": {
						out += token.text;
						break;
					}*/
					/*
						Base case
					*/
					default: {
						out += token.children ? render(token.children) : charSpanify(token.text);
						break;
					}
				}
			}
			return out;
		}
	};
	return Renderer;
});