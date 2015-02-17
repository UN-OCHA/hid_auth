var bunyan = require("bunyan"),
  log = bunyan.createLogger({
  	name: 'contactsid_auth',
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
