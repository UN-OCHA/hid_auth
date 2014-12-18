var nodemailer = require('nodemailer');
var config = require('./config');

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
  host: config.smtpHost || 'localhost',
  port: config.smtpPort || 25,
  auth: {
    user: config.smtpUser || null,
    pass: config.smtpPass || null
  }
});

module.exports = transporter;
