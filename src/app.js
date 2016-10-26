var C = require('./C');

(function(document){
	function getCardSet(card) {
		return (C.SETS.filter(function(set){
			return set.name === card['Edition'].replace('Extras: ', '');
		}) || []).reduce(function(result, val) {
			return (val && val.code) ? val.code : null;
		}, null);
	}

	var icon = {
		view: function(vnode) {
			return m('img', {src: 'https://cdn.rawgit.com/mtgjson/mtgjson/master/web/images/2.png' });
		}
	}

	var Home = {
		oninit: function(vnode){
			vnode.state.cards = m.request({
				method: 'GET',
				url: 'Inventory_eldamar_2016.October.07.csv',
				initialValue: [],
				deserialize: function(res) {
					res = res.split('\n').filter(function(val){
						return val.length;
					});

					return res.reduce(function(cards, line, index) {
						if (index === 0) 
							return cards;

						return cards.concat([
							line.replace(/"[^"]+"/g, function(value) {
								return value.replace(',', '%2C');
							}).split(',').reduce(function(card, value, index) {
								card[res[0].split(',')[index]] = value.replace('%2C', ',');
								return card;
							}, {}),
						]);
					}, []);
				}
			}).run(function(cards){
				// Get list of available sets
				var sets = cards.reduce(function(sets, card) {
					// console.log(getCardSet(card), card['Edition'])
					if (getCardSet(card) && sets.indexOf(getCardSet(card)) > -1)
						return sets;
					return sets.concat([getCardSet(card)]);
				}, []);

				console.log(sets);


				sets.map(function(set){
					return m.request({
						method: 'GET',
						url: '/set/' + set,
					});
				});

				return cards;
			}).catch(function(err) {
				throw(err);
			});

			
		},
		view: function(vnode){
			return vnode.state.cards().map(function(card) {
				console.log(card.);


				return m('div', card['Count'] + 'x' + card['Name'] );
			});
		}
	};

	m.route(document.body, '/', {
		'/': Home,
	});
})(window.document);
