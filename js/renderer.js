define(['utils', 'twinemarkup', 'twinescript'], function(Utils, TwineMarkup, TwineScript) {
	"use strict";
	/**
		The Renderer takes the syntax tree from TwineMarkup and returns a HTML string.
		
		@class Renderer
		@static
	*/
	
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
	var center = "text-align: center; max-width:50%; ",
		escape = Utils.escape,
		charSpanify = Utils.charSpanify,
		/*
			The public Renderer object.
		*/
		Renderer = {
		
		/**
			Renderer accepts the same story options that Harlowe does.
			Currently it only makes use of { debug }.
			
			@property options
			@type Object
		*/
		options: {},
		
		/**
			A composition of TwineMarkup.lex and Renderer.render,
			but with a (currently rudimentary) memoizer.
			This could be replaced with _.compose and _.memoize.
		*/
		exec: (function() {
			/*
				These two vars cache the previously rendered source text, and
				the syntax tree returned by TwineMarkup.lex from that.
			*/
			var cachedInput,
				cachedOutput;
		
			return function(src) {
				// If a non-string is passed into here, there's really nothing to do.
				if (typeof src !== "string") {
					Utils.impossible("Renderer.exec", "source was not a string, but " + typeof src);
					return "";
				}
				
				if (src === cachedInput) {
					return cachedOutput;
				}
				cachedInput = src;
				cachedOutput = this.render(TwineMarkup.lex(src).children);
				return cachedOutput;
			};
		}()),
		
		/**
			The recursive rendering method.
			
			@method render
			@static
			@param {Array} tokens A TwineMarkup token array.
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
					case "inlineUrl": {
						out += '<a class="link" href="' + escape(token.text) + '">' + charSpanify(token.text) + '</a>';
						break;
					}
					case "tag": {
						out += token.text;
						break;
					}
					case "sub": // Note: there's no sub syntax yet.
					case "sup":
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
						out += '<tw-hook '
							+ (token.name ? 'name="' + token.name + '"' : '')
							// Debug mode: show the hook destination as a title.
							+ ((Renderer.options.debug && token.name) ? ' title="Hook: ?' + token.name + '"' : '')
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
						out += '<tw-expression type="' + token.type + '" name="' + token.text + '"'
							// Debug mode: show the macro name as a title.
							+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
							+ ' js="' + escape(TwineScript.compile(token)) + '">'
							+ '</tw-expression>';
						break;
					}
					/*
						Base case
					*/
					default: {
						out += token.children && token.children.length ? render(token.children) : charSpanify(token.text);
						break;
					}
				}
			}
			return out;
		}
	};
	Utils.log("Renderer module ready!");
	
	/*
	DEBUG
	*/
	window.REPL = function(a) { var r = TwineScript.compile(TwineMarkup.lex("(print:"+a+")"));console.log(r);return TwineScript.environ({}).eval(r);};
	window.LEX = function(a) { var r = TwineMarkup.lex(a); return (r.length===1 ? r[0] : r); };
	
	return Object.freeze(Renderer);
});
