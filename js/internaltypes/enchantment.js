define(['jquery', 'utils'], ($, Utils) => {
	'use strict';
	/*
		Enchantments are special styling that is applied to selected elements of a
		passage by a macro. Enchantments are registered with a Section by pushing
		them onto the Section's "enchantments" array, whereupon the Section will
		automatically run updateEnchantments() whenever its DOM is permuted.
	*/

	const Enchantment = {
		/*
			Creates an Enchantment based on the given descriptor object.
			The descriptor should have {scope, attr, data} properties.

			The scope is shared with both enchantData methods:
			disenchant removes the <tw-enchantment> elements
			set on the scope, and enchantScope creates an updated
			scope to enchant.
		*/
		create(descriptor) {
			Utils.assertMustHave(descriptor, ['scope','attr','data']);

			return Object.assign(Object.create(this), {
				/*
					A store for the <tw-enchantment> wrappers created
					by enchantScope.
					
					This is a case of a jQuery object being used as a
					data structure rather than as a query result set.
					Search function calls for DOM elements 'contained' in
					these enchantments is more succinct using jQuery
					than using a plain Array or Set.
				*/
				enchantments: $(),
			}, descriptor);
		},
		/*
			This method enchants the scope, applying the macro's enchantment's
			classes to the matched elements.
		*/
		enchantScope() {
			const {scope, attr, data} = this;
			/*
				Reset the enchantments store, to prepare for the insertion of
				a fresh set of <tw-enchantment>s.
			*/
			this.enchantments = $();
			
			/*
				Now, enchant each selected word or hook within the scope.
			*/
			scope.forEach((e) => {
				/*
					Create a fresh <tw-enchantment>, and wrap the elements in it.

					It's a little odd that the generated wrapper must be retrieved
					using a terminating .parent(), but oh well.
				*/
				const wrapping = e.wrapAll("<tw-enchantment>").parent();

				/*
					Apply the attr and data now.
				*/
				if (attr) {
					wrapping.attr(attr);
				}
				if (data) {
					wrapping.data(data);
				}
				
				/*
					Store the wrapping in the Section's enchantments list.
				*/
				this.enchantments = this.enchantments.add(wrapping);
			});
		},
		/*
			This method removes the enchantment wrappers installed by enchantScope().
			This is called by Section whenever the scope's DOM may have been changed,
			so that enchantScope() can then select the newly selected regions.
		*/
		disenchant() {
			/*
				Clear all existing <tw-enchantment> wrapper elements placed by
				the previous call to enchantScope().
			*/
			this.enchantments.each(function() {
				$(this).contents().unwrap();
			});
		},

	};
	return Object.freeze(Enchantment);
});
