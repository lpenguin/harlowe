window.story = window.story || {};
window.story.macros = window.story.macros || {};

window.story.macros.test = function()
{
	this.el.css('color', 'blue');
	
	var args = '';

	for (var i = 0; i < arguments.length; i++)
		args += arguments[i] + ', ';

	return 'This is the test macro.<br><br>Raw args: ' + this.rawArgs +
	       '<br><br>Raw call: ' + this.rawCall.replace(/\</g, '&lt;') +
		   '<br><br>Parsed args: [' + args.substr(0, args.length - 2) + ']';
};
