const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const moment = require('moment');
const MsTranslator = require('mstranslator');

if (process.argv.length >= 5) {

  // Second parameter to constructor (true) indicates that 
  // the token should be auto-generated. 

  let apiKey = process.argv[2];
  let inputFile = process.argv[3];
  let destinationCodes = process.argv[4].split(',');
  
  let client = new MsTranslator({ api_key: apiKey }, true);

  function transformResponse(res) {
    return _.get(JSON.parse(res.text), ['data', 'translations', 0, 'translatedText'], '');
  }

  function iterLeaves(value, keyChain, accumulator, languageKey) {
    accumulator = accumulator || {};
    keyChain = keyChain || [];
    if (_.isObject(value)) {
        return _.chain(value).reduce((handlers, v, k) => {
            return handlers.concat(iterLeaves(v, keyChain.concat(k), accumulator, languageKey));
        }, []).flattenDeep().value();
    } else {
        return function () {
            console.log(_.template('Translating <%= value %> to <%= languageKey %>')({value, languageKey}));

            // Translates individual string to language code

            return new Promise((resolve, reject) => {

              let params = { text: value, from: 'en', to: languageKey };
              
              // Don't worry about access token, it will be auto-generated if needed. 
              client.translate(params, (err, data) => {

                if (err) { return reject(err); }
                console.log(data);

                //let text = transformResponse(data);
                _.set(accumulator, keyChain, data);
                return resolve(accumulator);
              });
            });
        };
    }
  }

  Promise.all(_.reduce(destinationCodes, (sum, languageKey) => {

    const tmpPath = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath);
    }

    const fileName = path.join(tmpPath, languageKey + '-' + moment().unix() + '.json');

    //Starts with the top level strings
    return sum.concat(_.reduce(iterLeaves(JSON.parse(fs.readFileSync(path.resolve(inputFile), 'utf-8')), undefined, undefined, languageKey), (promiseChain, fn) => {
        return promiseChain.then(fn);
    }, Promise.resolve()).then((payload) => {
        fs.writeFileSync(fileName, JSON.stringify(payload));
    }).then(_.partial(console.log, 'Successfully translated all nodes, file output at ' + fileName)));
  }, [])).then(() => {
    process.exit();
  });

} else {
  console.error('You must provide an input json file and a comma-separated list of destination language codes.');
}