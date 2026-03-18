let config = require('../config/nodeConfig');
let sg = require('@sendgrid/mail');
module.exports.sendEmail = async function(data, res){
    sg.setApiKey(config.sendgridKey);
    sg.setTimeout(30000);
    let msg = {
      to: data.to,
      from: config.mailFrom, // Use the email address or domain you verified above
      subject: data.subject,
      html: data.content,
      attachments: data.attachments
    };
    try {     
        console.info("reached here email")   
         await sg.send(msg);
    }
    catch(err) {
        console.error("err ======>", err)
          return Promise.reject(err)
    }
}