
/**
 * marked - a markdown parser
 * Copyright (c) 2011-2013, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked 
 *
 * Modified by Leon Arnott, 2013
 */

;(function() {
"use strict";
/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){3,} *\n*/,
  blockquote: /^( *>[^\n]+(\n[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment|closed|closing) *(?:\n{2,}|\s*$)/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', /\n+(?=(?: *[-*_]){3,} *(?:\n+|$))/)
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

function updateBlockGrammars() {
  block.paragraph = replace(block.paragraph)
    ('hr', block.hr)
    ('heading', block.heading)
    ('lheading', block.lheading)
    ('blockquote', block.blockquote)
    ('tag', '<' + block._tag)
    ('def', block.def)
    ();
    
  // Permit custom block syntax to be included in the paragraph regex
  for (i in block) {
    if (block[i].inParagraph) {
      block.paragraph = replace(block.paragraph)(i, block[i])();
    }
  }
  
  // Normal Block Grammar
  block.normal = merge({}, block);
  // GFM Block Grammar
  block.gfm = merge({}, block.normal, {
    fences: /^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/,
    paragraph: /^/
  });
  block.gfm.paragraph = replace(block.paragraph)
    ('(?!', '(?!' + block.gfm.fences.source.replace('\\1', '\\2') + '|')
    ();
  block.tables = merge({}, block.gfm, {
    nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
    table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
  });
};
updateBlockGrammars();

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || marked.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

Lexer.setRule = function(name, regex, inParagraph) {
  var obj = {};
  if (inParagraph) {
    regex.inParagraph = true;
  }
  if (regex) {
    if (block[name]) {
      block[name] = regex;
    }
    else {
      // Add new rule to the start
      // of the for..in chain
      obj[name] = regex;
      block = merge(obj, block);
    }
  }
};

Lexer.setFunc = function(name, func) {
  if (func) {
    Lexer.prototype.funcs[name] = func;
  }
}

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.funcs = {

  newline: function(cap) {
    if (cap[0].length > 1) {
      this.tokens.push({
        type: 'space'
      });
    }
  },
  
  code: function(cap) {
    cap = cap[0].replace(/^ {4}/gm, '');
    this.tokens.push({
      type: 'code',
      text: !this.options.pedantic
        ? cap.replace(/\n+$/, '')
      : cap
    });
  },

  fences: function(cap) {
    this.tokens.push({
      type: 'code',
      lang: cap[2],
      text: cap[3]
    });
  },

  heading: function(cap) {
    this.tokens.push({
      type: 'heading',
      depth: cap[1].length,
      text: cap[2]
    });
  },

  nptable: function(cap) {
    var i, item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
    };

    for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
    }

    for (i = 0; i < item.cells.length; i++) {
      item.cells[i] = item.cells[i].split(/ *\| */);
    }

    this.tokens.push(item);
  },

  lheading: function(cap) {
    this.tokens.push({
      type: 'heading',
      depth: cap[2] === '=' ? 1 : 2,
      text: cap[1]
    });
  },

  hr: function() {
    this.tokens.push({
      type: 'hr'
    });
  },

  blockquote: function(cap, top) {
    this.tokens.push({
        type: 'blockquote_start'
    });

    cap = cap[0].replace(/^ *> ?/gm, '');

    // Pass `top` to keep the current
    // "toplevel" state. This is exactly
    // how markdown.pl works.
    this.token(cap, top);
    this.tokens.push({
        type: 'blockquote_end'
    });
  },

  list: function(cap, top, src) {
    var l, i, b, space, item, next, loose,
    bull = cap[2];

    this.tokens.push({
    type: 'list_start',
    ordered: bull.length > 1
    });

    // Get each top-level item.
    cap = cap[0].match(this.rules.item);

    next = false;
    l = cap.length;
    i = 0;

    for (; i < l; i++) {
    item = cap[i];

    // Remove the list item's bullet
    // so it is seen as the next token.
    space = item.length;
    item = item.replace(/^ *([*+-]|\d+\.) +/, '');

    // Outdent whatever the
    // list item contains. Hacky.
    if (~item.indexOf('\n ')) {
      space -= item.length;
      item = !this.options.pedantic
        ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
        : item.replace(/^ {1,4}/gm, '');
    }

    // Determine whether the next list item belongs here.
    // Backpedal if it does not belong in this list.
    if (this.options.smartLists && i !== l - 1) {
      b = block.bullet.exec(cap[i+1])[0];
      if (bull !== b && !(bull.length > 1 && b.length > 1)) {
        src = cap.slice(i + 1).join('\n') + src;
        i = l - 1;
      }
    }

    // Determine whether item is loose or not.
    // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
    // for discount behavior.
    loose = next || /\n\n(?!\s*$)/.test(item);
    if (i !== l - 1) {
      next = item[item.length-1] === '\n';
      if (!loose) loose = next;
    }

    this.tokens.push({
      type: loose
        ? 'loose_item_start'
        : 'list_item_start'
    });

    // Recurse.
    this.token(item, false);

    this.tokens.push({
      type: 'list_item_end'
    });
    }

    this.tokens.push({
    type: 'list_end'
    });

    return src;
  },

  html: function(cap) {
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script',
        text: cap[0]
      });
  },

  def: function(cap) {
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
  },

  table: function(cap) {
      var i,
      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);
  },

  paragraph: function(cap) {
      this.tokens.push({
        type: 'paragraph',
        text: cap[1][cap[1].length-1] === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
  },

  text: function(cap) {
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
  }
};

Lexer.prototype.token = function(src, top) {
  var src = src.replace(/^ +$/gm, '')
    , rs
    , r
    , cap
    , ret
    , done;

  while (src) {
    done = false;
    for(rs in this.rules) {
      r = this.rules[rs];
      if (this.rules.hasOwnProperty(rs) && r.constructor === RegExp && this.funcs[rs]) {
        // top-level paragraph requires top
        if ((r !== this.rules.paragraph || top) && (cap = r.exec(src))) {
          src = src.slice(cap[0].length);
          if (ret = this.funcs[rs].call(this, cap, top, src)) {
            src = ret;
          }
          done = true;
          break;
        }
      }
    }
    if (src && !done) {
      throw new
        Error('Block lexer infinite loop on byte: ' + src.charAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/,
};

inline._inside = /(?:\[[^\]]*\]|[^\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([^\s]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

function updateInlineGrammars() {
  //Normal Inline Grammar
  inline.normal = merge({}, inline);

  // Pedantic Inline Grammar
  inline.pedantic = merge({}, inline.normal, {
    strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
    em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
  });

  //GFM Inline Grammar
  inline.gfm = merge({}, inline.normal, {
    escape: replace(inline.escape)('])', '~|])')(),
    url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    del: /^~~(?=\S)([\s\S]*?\S)~~/,
    text: replace(inline.text)
      (']|', '~]|')
      ('|', '|https?://|')
      ()
  });

  //GFM + Line Breaks Inline Grammar
  inline.breaks = merge({}, inline.gfm, {
    br: replace(inline.br)('{2,}', '*')(),
    text: replace(inline.gfm.text)('{2,}', '*')()
  });
};
updateInlineGrammars();

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    .replace(/--/g, '\u2014')
    .replace(/'([^']*)'/g, '\u2018$1\u2019')
    .replace(/"([^"]*)"/g, '\u201C$1\u201D')
    .replace(/\.{3}/g, '\u2026');
};

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || marked.defaults;
  this.links = links;
  this.rules = inline.normal;
  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

InlineLexer.setRule = function(name, regex, end) {
  var obj = {};
  if (regex) {
    if (inline[name] || end) {
      inline[name] = regex;
    }
    else {
      // Add new rule to the start
      // of the for..in chain
      obj[name] = regex;
      inline = merge(obj, inline);
    }
  }
};

InlineLexer.setFunc = function(name, func) {
  if (func) {
    InlineLexer.prototype.funcs[name] = func;
  }
};

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */
 
InlineLexer.prototype.funcs = {

  escape: function(cap) {
    return cap[1];
  },

  autolink: function(cap) {
    var text, href;
      if (cap[2] === '@') {
        text = cap[1][6] === ':'
          ? this.mangle(cap[1].slice(7))
          : this.mangle(cap[1]);
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      return '<a href="'
        + href
        + '">'
        + text
        + '</a>';
  },

  url: function(cap, src) {
      var text = escape(cap[1])
      , href = text;
      return '<a href="'
        + href
        + '">'
        + text
        + '</a>';
  },

  tag: function(cap) {
    return this.options.sanitize
        ? escape(cap[0])
        : cap[0];
  },

  link: function(cap) {
      return this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      });
  },

  strong: function(cap) {
    return '<strong>'
        + this.output(cap[2] || cap[1])
        + '</strong>';
  },

  em: function(cap) {
    return '<em>'
        + this.output(cap[2] || cap[1])
        + '</em>';
  },

  code: function(cap) {
    return '<code>'
        + escape(cap[2], true)
        + '</code>';
  },

  br: function(cap) {
    return '<br>';
  },

  del: function(cap) {
    return '<del>'
        + this.output(cap[1])
        + '</del>';
  },

  text: function(cap) {
    return escape(this.smartypants(cap[0]));
  },

  nolink : function(cap) {
    var link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
    link = this.links[link.toLowerCase()];
    if (link && link.href) {
        return this.outputLink(cap, link);
    }
  }
};
InlineLexer.prototype.funcs.reflink = InlineLexer.prototype.funcs.nolink; 

InlineLexer.prototype.output = function(src) {
  var out = ''
    , done
    , r
    , rs
    , ret
    , cap;

  while (src) {
    done = false;
    for(rs in this.rules) {
      r = this.rules[rs];
     
      if (this.rules.hasOwnProperty(rs) && r.constructor === RegExp && this.funcs[rs]) {
        if (cap = r.exec(src)) {
          src = src.slice(cap[0].length);
          if (ret = this.funcs[rs].call(this, cap, src)) {
            out += ret;
          }
          // Special case for reflinks
          else if (rs == "reflink" || rs == "nolink") {
            out += cap[0][0];
            src = cap[0].slice(1) + src;
          }
          done = true;
          break;
        }
      }
    }
    if (src && !done) {
      throw new
        Error('Inline lexer infinite loop on byte: ' + src.charAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  if (cap[0][0] !== '!') {
    return '<a href="'
      + escape(link.href)
      + '"'
      + (link.title
      ? ' title="'
      + escape(link.title)
      + '"'
      : '')
      + '>'
      + this.output(cap[1])
      + '</a>';
  } else {
    return '<img src="'
      + escape(link.href)
      + '" alt="'
      + escape(cap[1])
      + '"'
      + (link.title
      ? ' title="'
      + escape(link.title)
      + '"'
      : '')
      + '>';
  }
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || marked.defaults;
}

Parser.setFunc = function(name, func) {
  if (func) {
      Parser.prototype.funcs[name] = func;
  }
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options) {
  var parser = new Parser(options);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options);
  this.tokens = src.reverse();

  var out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length-1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body);
};

/**
 * Parse Current Token
 */
 
Parser.prototype.funcs = {
    space: function() {
      return '';
    },
    
    hr: function() {
      return '<hr>\n';
    },
    
    heading: function() {
      return '<h'
        + this.token.depth
        + '>'
        + this.inline.output(this.token.text)
        + '</h'
        + this.token.depth
        + '>\n';
    },
    
    code: function() {
      if (this.options.highlight) {
        var code = this.options.highlight(this.token.text, this.token.lang);
        if (code != null && code !== this.token.text) {
          this.token.escaped = true;
          this.token.text = code;
        }
      }

      if (!this.token.escaped) {
        this.token.text = escape(this.token.text, true);
      }

      return '<pre><code'
        + (this.token.lang
        ? ' class="'
        + this.options.langPrefix
        + this.token.lang
        + '"'
        : '')
        + '>'
        + this.token.text
        + '</code></pre>\n';
    },
    
    table: function() {
      var body = ''
        , heading
        , i
        , row
        , cell
        , j;

      // header
      body += '<thead>\n<tr>\n';
      for (i = 0; i < this.token.header.length; i++) {
        heading = this.inline.output(this.token.header[i]);
        body += this.token.align[i]
          ? '<th align="' + this.token.align[i] + '">' + heading + '</th>\n'
          : '<th>' + heading + '</th>\n';
      }
      body += '</tr>\n</thead>\n';

      // body
      body += '<tbody>\n'
      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];
        body += '<tr>\n';
        for (j = 0; j < row.length; j++) {
          cell = this.inline.output(row[j]);
          body += this.token.align[j]
            ? '<td align="' + this.token.align[j] + '">' + cell + '</td>\n'
            : '<td>' + cell + '</td>\n';
        }
        body += '</tr>\n';
      }
      body += '</tbody>\n';

      return '<table>\n'
        + body
        + '</table>\n';
    },
    
    blockquote_start: function() {
      var body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return '<blockquote>\n'
        + body
        + '</blockquote>\n';
    },
    
    list_start: function() {
      var type = this.token.ordered ? 'ol' : 'ul'
        , body = '';

      while (this.next().type !== 'list_end') {
        body += this.tok();
      }

      return '<'
        + type
        + '>\n'
        + body
        + '</'
        + type
        + '>\n';
    },
    
    list_item_start: function() {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text'
          ? this.parseText()
          : this.tok();
      }

      return '<li>'
        + body
        + '</li>\n';
    },
    
    loose_item_start: function() {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return '<li>'
        + body
        + '</li>\n';
    },
    
    html: function() {
      return !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text;
    },
    
    paragraph: function() {
      return '<p>'
        + this.inline.output(this.token.text)
        + '</p>\n';
    },
    
    text: function() {
      return '<p>'
        + this.parseText()
        + '</p>\n';
    }
}

Parser.prototype.tok = function() {
  return this.funcs[this.token.type].call(this);
}

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (({}).hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}

/**
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    if (opt) opt = merge({}, marked.defaults, opt);

    var highlight = opt.highlight
      , tokens
      , pending
      , i = 0;

    try {
      tokens = Lexer.lex(src, opt)
    } catch (e) {
      return callback(e);
    }

    pending = tokens.length;

    var done = function(hi) {
      var out, err;

      if (hi !== true) {
        delete opt.highlight;
      }

      try {
        out = Parser.parse(tokens, opt);
      } catch (e) {
        err = e;
      }

      opt.highlight = highlight;

      return err
        ? callback(err)
        : callback(null, out);
    };

    if (!highlight || highlight.length < 3) {
      return done(true);
    }

    if (!pending) return done();

    for (; i < tokens.length; i++) {
      (function(token) {
        if (token.type !== 'code') {
          return --pending || done();
        }
        return highlight(token.text, token.lang, function(err, code) {
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false
};

/**
 * Expose
 */

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

marked.escape = escape;

marked.update = function() {
  updateBlockGrammars();
  updateInlineGrammars();
}

if (typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.marked = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());