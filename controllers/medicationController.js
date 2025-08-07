let Medication = require("../class/medication");
const MedicationKnowledge = require("../class/MedicationKnowledge")
const axios = require("axios")
let config = require("../config/nodeConfig");
const {fetchResource, getTransformedResult, handleError, buildFHIRResource, patchFHIRResource} = require("../services/helperFunctions");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let {medicineSaveSchema, medicineUpdateSchema, medicinePatchSchema} = require("../utils/Validator/medicationValidator");
const {validateRequest} = require("../utils/validateRequest");
const { v4: uuidv4 } = require('uuid');

//  save medicine data
let saveMedicationData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, medicineSaveSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "medicines",
            requestType: "post",
            apiName: "add-medicine",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        console.log("req body: ", req.body)
        for (let medicine of req.body) {
            //  add a check if medicine already exists
            const existingMedicine = await fetchResource("Medication", {code: medicine.code, _total: "accurate"}, token)
            if(existingMedicine.total > 0 && existingMedicine.entry)
                    return res.status(400).json({ status: 0, message: "Medicine already exists." })

            const medicationResource = buildFHIRResource(Medication, medicine);
            const medBundle = await bundleStructure.setBundlePost(medicationResource, null, medicine.uuid, "POST", "identifier");
            const knowledgeBundles= await Promise.all(
                [...(medicine.brandList.length ? medicine.brandList : [null])
                  ].map(async e => {
                    const knowledgeResource= buildFHIRResource(MedicationKnowledge, {
                        categoryId: medicine.categoryId,
                        categoryName: medicine.categoryName,
                        brandName: e?.name || null,
                        classId: medicine.classId,
                        className: medicine.className,
                        medicineId: "urn:uuid:" + medicine.uuid,
                        code: medicine.code,
                        name: medicine.name,
                        dosage: medicine.dosage
                      })
                    return  await bundleStructure.setBundlePost(knowledgeResource, null, uuidv4(), "POST", "identifier");
                                
                  })
            ) 
            
            resourceResult.push(medBundle, ...knowledgeBundles)
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Medicine data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setMedicineSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "Medicine data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveMedicationData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

//  save medication data
let updateMedicationData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, medicineUpdateSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "medicines",
            requestType: "post",
            apiName: "add-medicine",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        console.log("req body: ", req.body)
        for (let medicine of req.body) {
            //  add a check if medicine already exists
            const existingMedicine = await fetchResource("Medication", {code: medicine.code, _total: "accurate"}, token)
            if(existingMedicine.total > 1 && existingMedicine.entry)
                    return res.status(400).json({ status: 0, message: "Medicine already exists." });
            const existingMedKnowledge =  await fetchResource("MedicationKnowledge", {code: medicine.code, _total: "accurate"}, token)
            console.log("existingMedKnowledge: ", existingMedKnowledge)
            const medicationResource = buildFHIRResource(Medication, medicine);
            const medBundle = await bundleStructure.setBundlePut(medicationResource, null, medicine.fhirId, "PUT", "identifier");
            const brandNames = existingMedKnowledge.entry.map(e => { return {
                  id: e.resource.id,
                  name: e.resource?.synonym?.[0]
                };
              });
            const updatedBrandNames = medicine.brandList;
            const arr1Names = new Set(brandNames.map(item => item.name));
            const arr2Names = new Set(updatedBrandNames.map(item => item.name));
            console.log("arr1Names: ", arr1Names, "arr2Names: ", arr2Names)
            // Find removed (in arr1, not in arr2)
            const removed = brandNames.filter(item => !arr2Names.has(item.name));

            // Find added (in arr2, not in arr1)
            const added = updatedBrandNames.filter(item => !arr1Names.has(item.name));

            console.log("arr1Names:", arr1Names, brandNames);
            console.log("arr2Names:", arr2Names);
            console.log("removed: ", removed, " added: ", added)
            const knowledgeBundles= await Promise.all(
                [...(added.length ? added : [null])
                  ].map(async e => {
                    const knowledgeResource= buildFHIRResource(MedicationKnowledge, {
                        categoryId: medicine.categoryId,
                        categoryName: medicine.categoryName,
                        brandName: e?.name || null,
                        classId: medicine.classId,
                        className: medicine.className,
                        medicineId: "Medication/" + medicine.fhirId,
                        code: medicine.code,
                        name: medicine.name,
                        dosage: medicine.dosage
                      })
                    return  await bundleStructure.setBundlePost(knowledgeResource, null, uuidv4(), "POST", "identifier");
                                
                  })
            ) 

            const deletedResources = await deleteMedicationKnowledgeResources(removed)
            
            resourceResult.push(medBundle, ...knowledgeBundles, ...deletedResources)
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Medicine data updated.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setMedicineSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "Medicine data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveMedicationData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

const deleteMedicationKnowledgeResources = async (ids) => {
    const bundlesList = []
    ids.forEach(async (data) => {
        const deletedResource = await bundleStructure.setBundleDelete("MedicationKnowledge", data.id);
        bundlesList.push(deletedResource)
    })
   return bundlesList;           
}

const setMedicineSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    console.log("responseData: ", responseData)
    filteredData = responseData.filter(e => (e.resource && e.resource.resourceType == "Medication")|| (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("Medication", type, filteredData);
    return response;
}

//  Get Practitioner data
let getMedicationList = async function (req, res) {
    try {
        let queryParams = req.query
        queryParams._total = "accurate";
        queryParams.status = "active";
        const token = req.accessToken;
        const resourceUrlData = { link: config.baseUrl + "Medication", reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }
        let responseData = await fetchResource("Medication", queryParams, token);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }          
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        const resourceResult =  await Promise.all(responseData.entry.map(async element => {
            const FHIRData = element.resource;            
            const medicationData = getTransformedResult(Medication, FHIRData);
            const existingMedKnowledge =  await fetchResource("MedicationKnowledge", {code: medicationData.code, _total: "accurate"}, token)
            console.log("existingMedKnowledge: ", existingMedKnowledge)
            const brandList = existingMedKnowledge.entry.map(e=> getTransformedResult(MedicationKnowledge, e.resource));
            
            medicationData.classId = brandList[0].classId
            medicationData.className = brandList[0].className
            medicationData.categoryId = brandList[0].categoryId
            medicationData.categoryName = brandList[0].categoryName
            medicationData.brandList = brandList.map(e=> e?.brandName).filter(e=> e != null);            
            console.log("medicationData: ", medicationData)
            return medicationData;
        }));
        
        return res.status(200).json({ status: resStatus, message: "Medicines list fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(error) {
        console.error("medication get api Error: ", error)
        return handleError(res, error)
    }
}

const patchMedicationData = async function(req, res) {
    try {
        const validatedBody = validateRequest(req.body, medicinePatchSchema, res);
        if (!validatedBody) return;
        const resourceType = "Medication";
        const reqInput = req.body;
        const token = req.accessToken;
        let resourceResult = [];
      for (let inputData of reqInput) {
        const resourceSavedResult = await fetchResource(resourceType, {_id: inputData.fhirId }, token)
        const resourceSavedData = resourceSavedResult.entry || [];
        if (resourceSavedData.length != 1) {
            const statusCode = 500
            return handleError(res, "Medicine Id " + inputData.fhirId + " does not exist.", statusCode, "Medicine Id " + inputData.fhirId + " does not exist.")
        }        
        const medicationPatchResource = patchFHIRResource(Medication, inputData, resourceSavedData[0].resource)
        console.log("medicationPatchResource: ", medicationPatchResource)
        let resourceData = [...medicationPatchResource];
        let patchResource = await bundleStructure.setBundlePatch(resourceData,resourceType + "/"+inputData.fhirId);        
        resourceResult.push(patchResource);
       
      }
    const bundleData = await bundleStructure.getBundleJSON({resourceResult: resourceResult, errData: []})  
    console.info(bundleData)
    // return res.status(201).json({ status: 1, message: "Medication name updated.", data: bundleData.bundle })  
    const response = await axios.post(config.baseUrl, bundleData.bundle, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/fhir+json'
        }
    }); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setMedicineSaveResponse(bundleData.bundle.entry, response.data.entry, "patch");
        const responseData = [...resourceResponse, ...bundleData.errData];
        res.status(201).json({ status: 1, message: "Medication status updated.", data: responseData })
    }
    else {
        return handleError(res, response)
    }
    }  catch(error) {
            console.error("patchMedicationData Error",error)
            return handleError(res, error)
    }
}



module.exports = {
    saveMedicationData,
    updateMedicationData,
    getMedicationList,
    patchMedicationData
}