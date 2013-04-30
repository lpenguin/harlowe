require.config({
	shim:
	{
		'showdown': { exports: 'Showdown' }
	}
});

define(['jquery', 'showdown', 'macros'], function ($, Showdown)
{
	var markdown = new Showdown.converter();

	$(document).ready(function()
	{
		$('body').on('click', 'a[data-twinelink]', function (e)
		{
			showName($(this).attr('data-twinelink'));
			e.preventDefault();
		});
		
		showId($('div[data-role="twinestory"]').attr('data-startnode'));
	});

	function render (source)
	{
		// basic Markdown

		var html = markdown.makeHtml(source);

		// replace [[ ]] with twine links

		// [[link|display text]] format

		html = html.replace(/\[\[(.*?)\|(.*)?\]\]/g, function (match, p1, p2)
		{
			return '<a href="#' + escape(p1.replace(/\s/g, '')) + '" data-twinelink="' + p1 + '">' +
				   p2 + '</a>';	
		});

		// [[link]] format

		html = html.replace(/\[\[(.*?)\]\]/g, function (match, p1)
		{
			return '<a href="#' + escape(p1.replace(/\s/g, '')) + '" data-twinelink="' + p1 + '">' + p1 + '</a>';
		});

		// convert macro invocations to spans

		var macros = [];

		// <<macro>>inner content<</macro>> format

		html = html.replace(/&lt;&lt;(\w+).*?&lt;&lt;\/\1&gt;&gt;/g, function (match, p1)
		{
			macros.push([p1, match]);
			return '<span data-macro="' + macros.length + '"></span>';
		});

		// <<macro>>inner content<<endmacro>> format

		html = html.replace(/&lt;&lt;(\w+).*?&lt;&lt;end\1&gt;&gt;/g, function (match, p1)
		{
			macros.push([p1, match]);
			return '<span data-macro="' + macros.length + '"></span>';
		});

		// <<macro>> without closing <</macro>>

		html = html.replace(/&lt;&lt;(\w+).*?&gt;&gt;/g, function (match, p1)
		{
			macros.push([p1, match]);
			return '<span data-macro="' + macros.length + '"></span>';
		});

		// convert into real element, then render macros into their spans

		html = $(html);

		for (var i = 0; i < macros.length; i++)
		{
			var span = html.find('span[data-macro="' + (i + 1) + '"]');

			if (window.story.macros[macros[i][0]])
			{
				var macro = window.story.macros[macros[i][0]];

				// rawCall is the entire macro invocation, rawArgs are all arguments,
				// rawContents is what's between an <<macro>> and <</macro>> call

				var rawCall = macros[i][1].replace(/&lt;/g, '<').replace(/&gt;/g, '>');
				var rawArgs = rawCall.replace(/^.*?\s/, '').replace(/>>.*/, '');
				var contentStart = new RegExp('^<<' + macros[i][0] + '.*?>>', 'i');
				var contentEnd = new RegExp('<<((end)|\/)' + macros[i][0] + '.*?>>$', 'i');
				var rawContents = rawCall.replace(contentStart, '').replace(contentEnd, '');

				// tokenize arguments
				// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
				// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]

				var args = [''];
				var argIdx = 0;
				var quoteChar;

				for (var i = 0; i < rawArgs.length; i++)
					switch (rawArgs[i])
					{
						case '"':
						case "'":
						if (quoteChar == rawArgs[i])
							quoteChar = null;
						else
							if (! quoteChar)
								quoteChar = rawArgs[i];
							else
								args[argIdx] += rawArgs[i];
						break;

						case ' ':
						if (quoteChar)
							args[argIdx] += rawArgs[i];
						else
							args[++argIdx] = '';
						break;

						case '\\':
						if (i < rawArgs.length - 1 && rawArgs[i + 1] == quoteChar)
						{
							args[argIdx] += quoteChar;
							i++;
						}
						else
							args[argIdx] += rawArgs[i];
						break;

						default:
						args[argIdx] += rawArgs[i];
					};

				var result = macro.apply({
					rawCall: rawCall,
					rawArgs: rawArgs,
					rawContents: rawContents,
					el: span }, args);

				// Markdown adds a <p> tag around content which we need to remove
				// we also have to coerce the result to a string
				
				if (result !== null)
					span.html(render(result + '').html().replace(/^<p>/i, '').replace(/<\/p>$/i, ''));
			}
			else
				span.html('No macro named ' + macros[i][0]);
		};

		return html;
	};

	function showId (id, el)
	{
		var passage = $('div[data-role="twinestory"] div[data-id="' + id + '"]');

		if (passage.size() == 0)
			throw new Error("No passage exists with id " + id);

		el = el || $('#story');	
		var container = $('<section><a class="permalink" href="#' + passage.attr('data-name') + '"' +
				  ' title="Permanent link to this passage">&para;</a></section>');
		container.append(render(passage.html()));
		el.empty().append(container);
	};

	function showName (name, el)
	{
		var passage = $('div[data-role="twinestory"] div[data-name="' + name + '"]');

		if (passage.size() == 0)
			throw new Error("No passage exists with name " + name);

		el = el || $('#story');	
		var container = $('<section><a class="permalink" href="#' + passage.attr('data-name') + '"' +
				  ' title="Permanent link to this passage">&para;</a></section>');
		container.append(render(passage.html()));
		el.empty().append(container);
	};
});
