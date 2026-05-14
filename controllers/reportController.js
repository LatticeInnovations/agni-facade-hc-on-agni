const jwt = require("jsonwebtoken");
const escapeHtml = require("escape-html");
const { ReportToken } = require("../models");
const facadeUrl = process.env.facadeUrl;
const { fetchPatient } = require("../services/email/fhirService");

const renderPage = ({ title, body }) => `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #ffffff;
    }
    .card {
      background: #ffffff;
      padding: 30px 40px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-align: center;
      width: 320px;
    }
    h3, h4, h5 {
      margin-bottom: 15px;
      color: #333;
    }
    input {
      width: 100%;
      padding: 10px;
      margin-bottom: 15px;
      border-radius: 8px;
      border: 1px solid #ccc;
      font-size: 14px;
    }
    button {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 8px;
      background: #2575fc;
      color: white;
      font-size: 16px;
      cursor: pointer;
      transition: 0.3s;
    }
    button:hover {
      background: #1a5edb;
    }
    .error {
      color: red;
      font-size: 14px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>
`;

exports.getAccessPage = async (req, res) => {
  const { token } = req.params;

  if (!/^[a-zA-Z0-9._-]+$/.test(token)) {
    return res.send(renderPage({
        title: "Error",
        body: `<p class="error">Something went wrong</p>`
      }));
  }

  const html = renderPage({
    title: "Download Report",
    body: `
      <h4>Enter Your DOB to Download Report</h4>
      <form method="POST" action="${facadeUrl}api/v1/verify">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />

        <input
          id="dob"
          name="dob"
          placeholder="YYYY-MM-DD"
          maxlength="10"
          autocomplete="bday"
          pattern="\\d{4}-\\d{2}-\\d{2}"
          required
        />

        <button type="submit">Submit</button>
      </form>

      <script>
        const dobInput = document.getElementById("dob");

        dobInput.addEventListener("input", (e) => {
          let value = e.target.value.replace(/\\D/g, "");

          if (value.length > 4 && value.length <= 6) {
            value =
              value.slice(0, 4) +
              "-" +
              value.slice(4);
          } else if (value.length > 6) {
            value =
              value.slice(0, 4) +
              "-" +
              value.slice(4, 6) +
              "-" +
              value.slice(6, 8);
          }

          e.target.value = value;
        });
      </script>
    `
  });

  res.send(html);
};

exports.verifyDob = async (req, res) => {
  const { token } = req.body;
  const { dob } = req.body;

  if (!/^[a-zA-Z0-9._-]+$/.test(token)) {
    return res.send(renderPage({
      title: "Error",
      body: `<p class="error">Something went wrong</p>`
    }));
  }

  const report = await ReportToken.findOne({
      where: { token: token }
    });

  if (!report) {
    return res.send(renderPage({
        title: "Error",
        body: `<p class="error">Something went wrong</p>`
        }));
    }

  const patient = await fetchPatient(report.patientId);

  if (patient.birthDate !== dob) {
      return res.send(renderPage({
        title: "Error",
        body: `<p class="error">Incorrect DOB</p>`
      }));
    }

  const signedToken = jwt.sign(
    { token }, 
    process.env.REPORT_SECRET, 
    { expiresIn: '10m' }
  );

  const signedUrl = `${facadeUrl}api/v1/download/${signedToken}`;

  const html = renderPage({
      title: "Download Report",
      body: `
        <form method="GET" action="${escapeHtml(signedUrl)}">
          <button>Download Report</button>
        </form>
      `
    });

    res.send(html);
};

exports.downloadReport = async (req, res) => {
  const { token: signedToken } = req.params;

  try {
    const decoded = jwt.verify(signedToken, process.env.REPORT_SECRET);

    const report = await ReportToken.findOne({
      where: { token: decoded.token }
    });

    if (!report) {
        return res.send(renderPage({
            title: "Error",
            body: `<p class="error">Something went wrong</p>`
        }));
    }

    const filePath = `uploads/${report.fileName}`;

    res.download(filePath);

  } catch (err) {
    console.error("JWT ERROR:", err);
    return res.send(renderPage({
            title: "Error",
            body: `<p class="error">Link expired or invalid</p>`
        }));
  }
};