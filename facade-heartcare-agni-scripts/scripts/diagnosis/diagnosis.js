const fs = require('fs');
const csv = require("csv-parser");

function csvToCodeSystem(csvFilePath, outputJsonPath) {
  const codeSystem = {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/diagnosis",
    version: "1.0.0",
    name: "DiagnosisCodes",
    status: "active",
    content: "complete",
    property: [
      {
        code: "diagnosis_id",
        uri: "http://example.org/fhir/CodeSystem/diagnosis-id",
        description: "Internal diagnosis ID",
        type: "integer"
      }
    ],
    concept: []
  };

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      console.log(row)
      if (row.diagnosis_id && row.code && row.display) {
        codeSystem.concept.push({
          code: row.code,
          display: row.display,
          property: [
            {
              code: "diagnosis_id",
              valueInteger: parseInt(row.diagnosis_id)
            }
          ]
        });
      }
      else {
        console.log("fields missing")
      }
    })
    .on('end', () => {
      fs.writeFileSync(outputJsonPath, JSON.stringify(codeSystem, null, 2), 'utf-8');
      console.log(`FHIR CodeSystem saved to: ${outputJsonPath}`);
    });
}

// Example usage:
csvToCodeSystem('diagnosis_list.csv', 'diagnosis_codesystem_prod.json');
