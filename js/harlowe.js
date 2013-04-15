require.config({
	shim:
	{
		'underscore': { exports: '_' },
		'showdown': { exports: 'Showdown' }
	}
});

define(['jquery', 'underscore', 'showdown'], function ($, _, Showdown)
{
	var markdown = new Showdown.converter();
	console.log('harlowe starting');

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
		// jQuery will escape out the underscore leaders

		var template = _.template(source.replace(/&lt;%/g, '<%').replace(/%&gt;/g, '%>'));
		var html = markdown.makeHtml(template());

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

		return html;
	};

	function showId (id, el)
	{
		var passage = $('div[data-role="twinestory"] div[data-id="' + id + '"]');

		el = el || $('#story');	
		el.append('<section><a class="permalink" href="#' + passage.attr('data-name') + '"' +
				  ' title="Permanent link to this passage">&para;</a>' +
				  render(passage.html()) + '</section>');
	};

	function showName (name, el)
	{
		var passage = $('div[data-role="twinestory"] div[data-name="' + name + '"]');

		el = el || $('#story');	
		el.append('<section><a class="permalink" href="#' + passage.attr('data-name') + '"' +
				  ' title="Permanent link to this passage">&para;</a>' +
				  render(passage.html()) + '</section>');
	};
});
