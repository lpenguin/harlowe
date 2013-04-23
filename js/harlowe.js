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
			return '<a href="#' + _.escape(p1.replace(/\s/g, '')) + '" data-twinelink="' + p1 + '">' +
				   p2 + '</a>';	
		});

		// [[link]] format

		html = html.replace(/\[\[(.*?)\]\]/g, function (match, p1)
		{
			return '<a href="#' + _.escape(p1.replace(/\s/g, '')) + '" data-twinelink="' + p1 + '">' + p1 + '</a>';
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
			var span = html.find('span[data-macro="' + i + '"]');

			if (window.story.macros[macros[i][0]])
			{
				// tokenize arguments
				// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
				// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]

				var rawCall = macros[i][1].replace(/&lt;/g, '<').replace(/&gt;/g, '>');

				console.log('rawCall', rawCall);

				var rawArgs = rawCall.replace(/^.*?\s/, '').replace(/>>.*/, '');

				console.log('rawArgs', rawArgs);
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
		el.append(container);
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
		el.append(container);
	};
});
