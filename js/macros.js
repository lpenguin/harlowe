window.story = window.story || {};
window.story.macros = window.story.macros || {};

window.story.macros.set = function()
{
	try
	{
		eval(this.rawArgs);
	}
	catch (e)
	{
		return e.message;
	}
};

window.story.macros.print = function()
{
	try
	{
		return eval(this.rawArgs);
	}
	catch (e)
	{
		return e.message;
	}
};

window.story.macros.script = function()
{
	try
	{
		eval(this.rawContents);
	}
	catch (e)
	{
		return e.message;
	}
};

window.story.macros.if = function()
{
	try
	{
		if (eval(this.rawArgs))
			return this.rawContents;
	}
	catch (e)
	{
		return e.message;
	}
};
