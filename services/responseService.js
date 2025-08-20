const getDataError = (element, resType) => {
  let error;
  switch (element.response.status) {
    case "201 Created":
      error = null;
      break;
    case "200 OK":
      if (resType == "Schedule") {
        error = "Schedule already exists";
      }
       else {
        error = null;
      }
      break;
    default:
      error = element.response.outcome;
      break;
  }
  return error;
};

const getFhirId = (element, reqMethod) => {
  let fhirId;
  switch (element.response.status) {
    case "200 OK":
    case "201 Created":
      fhirId = element.response.location.substring(
        element.response.location.indexOf("/") + 1,
        element.response.location.indexOf("/_history")
      );
      break;
    default:
      if (["PATCH", "patch"].includes(reqMethod)) {
        fhirId = element.fullUrl.substring(
          element.fullUrl.indexOf("/") + 1,
          element.fullUrl.length
        );
      } else {
        fhirId = null;
      }
      break;
  }
  return fhirId;
};

const getResponseData = (element, reqMethod) => {
  let data = {};
  let fullUrl = element.fullUrl.substring(
    element.fullUrl.indexOf("/") + 1,
    element.fullUrl.length
  );
  let id = fullUrl.includes("uuid:") ? fullUrl.split("uuid:")[1] : fullUrl;
  data.status = element.response.status;
  data.id = ["patch", "PATCH", "put", "PUT"].includes(reqMethod) ? null : id;
  console.info("data is: ", data, "  element is: ", element, reqMethod, id)
  return data;
};

const setDefaultResponse = (resType, reqMethod, responseData) => {
  let response = [];
  let filteredData = responseData;
  filteredData.forEach((element) => {
    let data = getResponseData(element, reqMethod);
    data.err = getDataError(element, resType);
    data.fhirId = getFhirId(element, reqMethod);
    response.push(data);
  });
  console.info("response", response);
  return response;
};

const setDefaultAssessmentResponse = (resType, reqMethod, responseData) => {
  let response = [];
  let filteredData = responseData;
  filteredData.forEach((element) => {
    let data = getResponseData(element, reqMethod);
    data.err = getDataError(element, resType);
    data.fhirId = getFhirId(element, reqMethod);
    if(element.response.status === "200 OK" && element.resource.identifier) {
      const identifierUuid = Array.isArray(element.resource.identifier)? element.resource.identifier[0].value : element.resource.identifier.value;
        data.err = "Duplicate record exists.";
    }
    response.push(data);
  });
  console.info("response", response);
  return response;
};

module.exports = { getResponseData, setDefaultResponse, setDefaultAssessmentResponse };
