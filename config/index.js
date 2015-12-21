var nodeEnv = process.env.NODE_ENV || 'dockerdev';
var config = {
  dockerdev: require('./dockerdev'),
  blackmeshdev: require('./blackmeshdev'),
  blackmeshtest: require('./blackmeshtest'),
  test: require('./test'),
  prod: require('./prod'),
  dockerprod: require('./dockerprod')
};

module.exports = config[nodeEnv];
