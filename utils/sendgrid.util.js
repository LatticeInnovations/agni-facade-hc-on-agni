let config = require('../config/nodeConfig');

const Mailgun = require("mailgun.js");
const formData = require("form-data");

const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: "api",
  key: config.mailgunApiKey
});

module.exports.sendEmail = async function (data, res) {

  const msg = {
    from: config.mailFrom,
    to: data.to,
    subject: data.subject,
    html: data.content
  };

  if (data.attachments) {

    msg.attachment = data.attachments.map(file => ({
      filename: file.filename,
      data: Buffer.from(file.data),
      contentType: "application/pdf"
    }));

  }

  try {

    console.info("Sending email via Mailgun");

    const response = await mg.messages.create(
      config.mailgunDomain,
      msg
    );

    console.info("Mailgun response:", response.id);

    return response;

  } catch (err) {

    console.error("Mailgun error ======>", err);

    throw err;

  }

};