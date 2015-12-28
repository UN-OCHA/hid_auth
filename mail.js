var nodemailer = require('nodemailer');
var path = require('path');
var _ = require('lodash');
var templatesDir = path.resolve(__dirname, 'templates');
var EmailTemplate = require('email-templates').EmailTemplate;

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 25,
  auth: {
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null
  }
});

transporter.sendTemplate = function (templateName, options, fn) {
  var templateDir = path.join(templatesDir, templateName);
  var template = new EmailTemplate(templateDir);
  var locals = _.clone(options);

  template.render(locals, function (err, result) {
    if (err) {
      return fn(err);
    }
    transporter.sendMail({
      from: locals.from || 'Humanitarian ID <info@humanitarian.id>',
      to: locals.to,
      subject: locals.subject,
      cc: locals.cc || '',
      html: result.html,
      text: result.text
    }, function (err, info) {
      if (err) {
        return fn(err);
      }
      return fn(null, info);
    });
  });
};


module.exports = transporter;
