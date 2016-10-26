const fs = require('fs');
const path = require('path');
const url = require('url');

const commandLineArgs = require('command-line-args');
const mkdirp = require('mkdirp');
const fetch = require('node-fetch');

const C = require('../src/C');

const options = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean },
  { name: 'src', type: String, multiple: true, defaultOption: true },
  { name: 'output', alias: 'o', type: String },
]);

Promise.all(options.src.map((src) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(src), (err, data) => {
      if (err) reject(err);
      resolve(data.toString('UTF-8'));
    });
  }).then((data) => {
    data = data.split('\n').filter((val) => {
      return val.length;
    });

    return data.reduce((cards, line, index) => {
      if (index === 0) {
        return cards;
      }

      var ref = data[0].split(',').map((val) => {
        return val.charAt(0).toLowerCase() + 
          val.slice(1).replace(' ', '');
      });

      return cards.concat([
        line.replace(/"[^"]+"/g, (value)  =>  {
          return value.replace(',', '%2C');
        }).split(',').reduce((card, value, index) => {
          card[ref[index]] = value.replace('%2C', ',');
          return card;
        }, {}),
      ]);
    }, []);
  });
})).then((args) => {
  // Merge cards from all the inputs
  return args.reduce((result, cards) => {
    return cards.filter(a => !result.find(b => b.number == a.number))
      .reduce((result, card) => result.concat([card]), result);
  }, []);
}).then((cards) => {
  function getCardSet(card) {
    return (C.SETS.filter((set) => {
      return set.name === card.edition.replace('Extras: ', '');
    }) || []).reduce((result, val) => {
      return (val && val.code) ? val.code : null;
    }, null);
  }

  // TODO: Store set data on disk
  return Promise.all(cards.reduce((sets, card) => {
    if (getCardSet(card) && sets.indexOf(getCardSet(card)) > -1)
      return sets;
    return sets.concat([getCardSet(card)]);
  }, []).filter((set) => set).map((set) => {
    return fetch('https://cdn.rawgit.com/mtgjson/mtgjson/master/json/' +
      set.toUpperCase() + '.json')
    .then(res => res.json()).then(function(set) {
      console.log('Downloaded set', set.name);
      // Merging the extra information from the set with our cards
      return cards.filter(card => getCardSet(card) === set.code).map(a => {
        return Object.assign(a, set.cards.find(b => b.number === a.cardNumber));
      });
    });
  })).then(() => cards); // return the list of cards
}).then((cards) => {
  // Download artwork
  mkdirp(path.resolve(options.output + 'assets/cards/'));

  let promise = Promise.resolve();

  cards.map((card) => {
    if (!card.id)
      return;

    let extname = path.extname(url.parse(card.imageURL).path);
    let imagePath = path.resolve(options.output + 'assets/cards/' + card.id);

    function stat(path) {
      return new Promise((resolve, reject) => {
        fs.stat(path, function(err, stat) { 
          if (!err || stat) reject(path);
          resolve(path);
        });
      });
    }

    // Make sure that we do not already have the artwork for this card.
    Promise.all([
      stat(imagePath + extname),
      stat(imagePath + '.png'),
    ]).then(() => {
      // Process one image at a time
      promise = promise.then(() => {
        console.log('fetching', card.imageURL);
        return fetch(card.imageURL);
      }).then((res) => {
        return new Promise((resolve) => {
          let png = false;
          res.body.pipe(fs.createWriteStream(imagePath + extname));

          // Most of the time the image is actually a png
          res.body.on('data', (data) => {
            if (String.fromCharCode(
              data[1], data[2], data[3]).toUpperCase() === 'PNG') {
              png = true;
            }
          });

          res.body.on('end', () => {
            card.imageURL = imagePath.replace(path.resolve(options.output) + '/', '') +png ? '.png' : extname;
            resolve(png);
          });
        });
      }).then((png) => {
        console.log('fetched', card.imageURL);
        if (!png)
          return;

        console.log('Rename', imagePath + extname, '=>', imagePath + '.png');
        return new Promise((resolve) => {
          fs.rename(imagePath + extname, imagePath + '.png', resolve);
        });
      });
    }).catch((url) => {
      // console.log('ignoring', card.imageURL);
      card.imageURL = url.replace(path.resolve(options.output) + '/', '');
    });

    return card;
  });

  // Send cards to the next step
  promise = promise.then(() => cards);

  return promise;
}).then((cards) => {
  // Write the cards javascript file
  return new Promise((resolve) => {
    fs.readFile(path.resolve(__dirname + '/../src/index.html'), (err, data) => {
      if (err) throw err;
      resolve(data);
    });
  }).then((data) => {

    var code = 'var cards = ' + JSON.stringify(cards) + ';';

    fs.writeFile(path.resolve(options.output + 'index.html'),
      data.toString().replace('// {{cards}}', code), (err) => {
          if (err) throw err;
          console.log('saved');
        });
  });

  // fs.writeFile(path.resolve(options.output + 'cards.js'),
  //   '\'use strict\';' + '\n' + 'window.cards = ' + 
  //   JSON.stringify(cards, null, 2), (err) => {
  //     if (err) throw err;
  //     console.log('saved');
  //   });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
