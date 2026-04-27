const fs = require("fs");


const FILE_PATH = "./medication-prod-fhir.json"; // path to your JSON file
const original_file = "./medication-master-prod.json"

    // Read all data
    const records = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    const file2 = JSON.parse(fs.readFileSync(original_file, "utf8"));

    let updated_medication = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [],
    };
    for (let index = 0; index < records.entry.length; index++) {
      let rec = records.entry[index];
      console.log("index: ", index,  rec, file2[0])
      const original_record_index = file2.findIndex(
        (e) => e.code === rec.resource.code.coding[0].code
      );
      console.log("original_record_index: ", original_record_index)
      if (original_record_index != -1) {
        let updated_resource = {
          fullUrl: rec.fullUrl,
          resource: rec.resource,
          request: {
            method: "PUT",
            url: "Medication/" + rec.resource.id,
          },
        };

        updated_resource.resource.ingredient = [
          {
            itemCodeableConcept: {
              coding: [
                {
                  system: "http://heartcare.org",
                  code: file2[original_record_index].code,
                  display: `${file2[original_record_index].primary_name} ${file2[original_record_index].dosage} mg`,
                },
              ],
            },
            strength: {
              numerator: {
                value: file2[original_record_index].dosage,
                system: "http://unitsofmeasure.org",
                code: "mg",
              },
              denominator: {
                value: 1,
                system: "http://unitsofmeasure.org",
                code: "mg",
              },
            },
          },
        ];

        updated_medication.entry.push(updated_resource);
      }
    }

    fs.writeFileSync(
      "updated-med-ingredient.json",
      JSON.stringify(updated_medication, null, 2),
      "utf-8"
    );
    console.log(`FHIR CodeSystem saved to: updated-med-ingredient.json`);


