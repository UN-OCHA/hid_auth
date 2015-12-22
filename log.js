var bunyan = require('bunyan'),
  _ = require('lodash'),
  userSerializer = function (user) {
    return _.pick(user, function (value, key, object) {
      return ['user_id', 'email', 'email_recovery', 'name_given', 'name_family', 'authorized_services', 'active', 'roles'].indexOf(key) !== -1;
    });
  },
  log = bunyan.createLogger({
    name: process.env.APP_NAME,
    serializers: {
      req: bunyan.stdSerializers.req,
      user: userSerializer
    },
    streams: [
      {
        level: 'info',
        stream: process.stdout
      },
      {
        level: 'info',
        path: '/var/log/hid_auth.log'
      }
    ]
  });

module.exports = log;
